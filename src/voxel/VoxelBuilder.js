import * as THREE from 'three';
import { CONFIG, VOXEL } from '../config.js';
import { resolveColor } from './palettes.js';

// Voxel parts (spec §12).
// A part is a list of boxes in integer voxel units:
//   { p: [x, y, z], s: [w, h, d], c: 'paletteKey', e?: emissiveIntensity | true, j?: jitterOverride }
// p is the min corner, s the size. Every box snaps to the part's block grid (voxelSize).
// buildPart merges all boxes into one opaque mesh (MeshStandardMaterial, flat shaded) and one
// emissive mesh (MeshBasicMaterial, vertex colors scaled above 1 so they bloom).

const _materials = new Map();

export function getOpaqueMaterial(roughness = CONFIG.voxel.roughness, metalness = CONFIG.voxel.metalness) {
  const key = `o:${roughness}:${metalness}`;
  let m = _materials.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness, metalness });
    m.name = 'voxelOpaque';
    _materials.set(key, m);
  }
  return m;
}

export function getEmissiveMaterial() {
  let m = _materials.get('e');
  if (!m) {
    m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    m.name = 'voxelEmissive';
    _materials.set('e', m);
  }
  return m;
}

// Mirrored copies of boxes across the plane x = axis (voxel units). Use axis 0.5 for models
// with a center column spanning [0, 1]. Returns only the copies.
export function mirrorX(boxes, axis = 0) {
  return boxes.map((b) => ({ ...b, p: [2 * axis - b.p[0] - b.s[0], b.p[1], b.p[2]], s: [...b.s] }));
}

// Originals plus their mirrored copies.
export function withMirrorX(boxes, axis = 0) {
  return [...boxes, ...mirrorX(boxes, axis)];
}

// Deterministic hash → [0, 1).
export function hash01(a, b = 0, c = 0, d = 0) {
  let h = (a | 0) * 374761393 + (b | 0) * 668265263 + (c | 0) * 2147483647 + (d | 0) * 1274126177;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

const KEY_OFF = 1024;
const cellKey = (x, y, z) => ((x + KEY_OFF) * 2048 + (y + KEY_OFF)) * 2048 + (z + KEY_OFF);

// Collects quads into position/normal/color arrays.
class QuadSink {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.idx = [];
  }
  get vertexCount() {
    return this.pos.length / 3;
  }
  // Quad on the face of axis a (0..2) with sign sg at plane coordinate w, spanning u0..u1, v0..v1.
  quad(a, sg, w, u0, u1, v0, v1, r, g, b, scale, ox, oy, oz) {
    const u = (a + 1) % 3;
    const v = (a + 2) % 3;
    const base = this.vertexCount;
    const corners = sg > 0 ? [[u0, v0], [u1, v0], [u1, v1], [u0, v1]] : [[u0, v0], [u0, v1], [u1, v1], [u1, v0]];
    const c = [0, 0, 0];
    const n = [0, 0, 0];
    n[a] = sg;
    for (const [cu, cv] of corners) {
      c[a] = w;
      c[u] = cu;
      c[v] = cv;
      this.pos.push((c[0] + ox) * scale, (c[1] + oy) * scale, (c[2] + oz) * scale);
      this.nor.push(n[0], n[1], n[2]);
      this.col.push(r, g, b);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  toGeometry() {
    if (this.idx.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.vertexCount > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

function snapBox(b, index) {
  const p = b.p.map(Math.round);
  const s = b.s.map((v) => Math.max(1, Math.round(v)));
  if (import.meta.env?.DEV) {
    const off = b.p.some((v, i) => v !== p[i]) || b.s.some((v, i) => v !== s[i]);
    if (off) console.debug(`[voxel] box ${index} snapped to grid`, b.p, b.s, '→', p, s);
  }
  return { ...b, p, s };
}

/**
 * Build a voxel part.
 * @param {Array} boxes  box list (integer voxel units)
 * @param {Object} palette  key → hex
 * @param {Object} opts
 *   voxelSize  meters per voxel (VOXEL, BOSS_VOXEL, ENV_VOXEL, ...)
 *   jitter     ±brightness jitter per box (default CONFIG.voxel.jitter)
 *   seed       jitter seed
 *   cullHidden drop faces (and so fully hidden boxes) covered by neighbouring boxes; overlaps resolve last-box-wins
 *   origin     [x, y, z] offset in voxel units applied after snapping (may be fractional, e.g. -0.5 to center a column)
 *   castShadow / receiveShadow
 *   roughness / metalness  opaque material
 *   material   opaque material override
 *   name
 * @returns {{group, opaqueMesh, emissiveMesh, boxes, voxelSize, triangles}}
 */
export function buildPart(boxes, palette, opts = {}) {
  const {
    voxelSize = VOXEL,
    jitter = CONFIG.voxel.jitter,
    seed = 1,
    cullHidden = true,
    origin = [0, 0, 0],
    castShadow = true,
    receiveShadow = true,
    roughness,
    metalness,
    material = null, // optional opaque material override (e.g. getBlockEdgeMaterial)
    name = 'voxelPart',
  } = opts;

  const list = boxes.map(snapBox);

  // Occupancy: cell → index of the last box covering it.
  let owner = null;
  if (cullHidden) {
    owner = new Map();
    list.forEach((b, i) => {
      const [x0, y0, z0] = b.p;
      for (let x = x0; x < x0 + b.s[0]; x++)
        for (let y = y0; y < y0 + b.s[1]; y++)
          for (let z = z0; z < z0 + b.s[2]; z++) owner.set(cellKey(x, y, z), i);
    });
  }

  const opaque = new QuadSink();
  const emissive = new QuadSink();
  const [ox, oy, oz] = origin;
  const cell = [0, 0, 0];
  const nb = [0, 0, 0];

  list.forEach((b, i) => {
    const base = resolveColor(palette, b.c);
    const jit = b.j ?? jitter;
    const f = 1 + (hash01(seed, i, b.p[0] * 31 + b.p[2], b.p[1]) * 2 - 1) * jit;
    let r = base.r * f, g = base.g * f, bl = base.b * f;
    const isEmissive = b.e != null && b.e !== false && b.e !== 0;
    if (isEmissive) {
      const k = b.e === true ? CONFIG.voxel.emissiveDefault : b.e;
      r *= k; g *= k; bl *= k;
    }
    const sink = isEmissive ? emissive : opaque;

    for (let a = 0; a < 3; a++) {
      const u = (a + 1) % 3;
      const v = (a + 2) % 3;
      for (const sg of [-1, 1]) {
        const w = sg > 0 ? b.p[a] + b.s[a] : b.p[a];
        const u0 = b.p[u], u1 = b.p[u] + b.s[u];
        const v0 = b.p[v], v1 = b.p[v] + b.s[v];
        if (!cullHidden) {
          sink.quad(a, sg, w, u0, u1, v0, v1, r, g, bl, voxelSize, ox, oy, oz);
          continue;
        }
        // Per-cell visibility on this face: cell owned by this box and neighbour empty.
        const layer = sg > 0 ? w - 1 : w; // box cell layer touching the face
        const nLayer = sg > 0 ? w : w - 1; // neighbour layer
        let visible = 0;
        const total = (u1 - u0) * (v1 - v0);
        const vis = new Uint8Array(total);
        let k = 0;
        for (let cu = u0; cu < u1; cu++) {
          for (let cv = v0; cv < v1; cv++, k++) {
            cell[a] = layer; cell[u] = cu; cell[v] = cv;
            nb[a] = nLayer; nb[u] = cu; nb[v] = cv;
            if (owner.get(cellKey(cell[0], cell[1], cell[2])) !== i) continue;
            if (owner.has(cellKey(nb[0], nb[1], nb[2]))) continue;
            vis[k] = 1;
            visible++;
          }
        }
        if (visible === 0) continue;
        if (visible === total) {
          sink.quad(a, sg, w, u0, u1, v0, v1, r, g, bl, voxelSize, ox, oy, oz);
          continue;
        }
        // Partially covered: merge visible cells into strips along v.
        for (let cu = u0; cu < u1; cu++) {
          let start = -1;
          for (let cv = v0; cv <= v1; cv++) {
            const on = cv < v1 && vis[(cu - u0) * (v1 - v0) + (cv - v0)] === 1;
            if (on && start < 0) start = cv;
            if (!on && start >= 0) {
              sink.quad(a, sg, w, cu, cu + 1, start, cv, r, g, bl, voxelSize, ox, oy, oz);
              start = -1;
            }
          }
        }
      }
    }
  });

  const group = new THREE.Group();
  group.name = name;
  let opaqueMesh = null;
  let emissiveMesh = null;
  const og = opaque.toGeometry();
  if (og) {
    opaqueMesh = new THREE.Mesh(og, material || getOpaqueMaterial(roughness, metalness));
    opaqueMesh.name = `${name}:opaque`;
    opaqueMesh.castShadow = castShadow;
    opaqueMesh.receiveShadow = receiveShadow;
    group.add(opaqueMesh);
  }
  const eg = emissive.toGeometry();
  if (eg) {
    emissiveMesh = new THREE.Mesh(eg, getEmissiveMaterial());
    emissiveMesh.name = `${name}:emissive`;
    emissiveMesh.castShadow = castShadow;
    group.add(emissiveMesh);
  }

  const triangles = (opaque.idx.length + emissive.idx.length) / 3;
  const part = { group, opaqueMesh, emissiveMesh, boxes: list, voxelSize, origin: [...origin], palette, triangles };
  group.userData.part = part; // kept for death shatter (Stage 3)
  return part;
}

// Free-form box batch for non-grid geometry (glow seams, decals). Same vertex-color materials.
export class BoxBatch {
  constructor() {
    this.sink = new QuadSink();
  }
  // Axis-aligned box from min (x0,y0,z0) to max (x1,y1,z1) in meters; color is a THREE.Color (linear).
  add(x0, y0, z0, x1, y1, z1, color, intensity = 1, skipBottom = true) {
    const r = color.r * intensity, g = color.g * intensity, b = color.b * intensity;
    const mn = [x0, y0, z0];
    const mx = [x1, y1, z1];
    for (let a = 0; a < 3; a++) {
      const u = (a + 1) % 3;
      const v = (a + 2) % 3;
      for (const sg of [-1, 1]) {
        if (skipBottom && a === 1 && sg < 0) continue;
        this.sink.quad(a, sg, sg > 0 ? mx[a] : mn[a], mn[u], mx[u], mn[v], mx[v], r, g, b, 1, 0, 0, 0);
      }
    }
  }
  toMesh(material, name = 'boxBatch') {
    const geo = this.sink.toGeometry();
    if (!geo) return null;
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = name;
    return mesh;
  }
}
