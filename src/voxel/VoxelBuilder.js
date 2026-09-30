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

// Small seeded PRNG (mulberry32) for procedural generators.
export function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KEY_OFF = 1024;
const cellKey = (x, y, z) => ((x + KEY_OFF) * 2048 + (y + KEY_OFF)) * 2048 + (z + KEY_OFF);

// Collects quads into position/normal/color arrays (+ optional extra attributes).
// extraSizes: { attributeName: itemSize }. Set `extraFn(name, x, y, z)` (x/y/z = vertex position
// in the part's local meters) before calling quad() to supply per-vertex extra values.
export class QuadSink {
  constructor(extraSizes = {}) {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.idx = [];
    this.extra = {};
    for (const name in extraSizes) this.extra[name] = { size: extraSizes[name], data: [] };
    this.extraFn = null;
  }
  get vertexCount() {
    return this.pos.length / 3;
  }
  // Quad on the face of axis a (0..2) with sign sg at plane coordinate w, spanning u0..u1, v0..v1
  // (grid units). Final vertex = (grid + origin) * scale.
  quad(a, sg, w, u0, u1, v0, v1, r, g, b, scale = 1, ox = 0, oy = 0, oz = 0) {
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
      const x = (c[0] + ox) * scale, y = (c[1] + oy) * scale, z = (c[2] + oz) * scale;
      this.pos.push(x, y, z);
      this.nor.push(n[0], n[1], n[2]);
      this.col.push(r, g, b);
      for (const name in this.extra) {
        const vals = this.extraFn ? this.extraFn(name, x, y, z) : null;
        const e = this.extra[name];
        for (let k = 0; k < e.size; k++) e.data.push(vals ? vals[k] : 0);
      }
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  toGeometry() {
    if (this.idx.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    for (const name in this.extra) g.setAttribute(name, new THREE.Float32BufferAttribute(this.extra[name].data, this.extra[name].size));
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

// Split every box into 1×1×1 cells (so per-block jitter shows on big boxes).
export function splitCells(boxes) {
  const out = [];
  for (const b of boxes) {
    if (b.s[0] === 1 && b.s[1] === 1 && b.s[2] === 1) {
      out.push(b);
      continue;
    }
    for (let x = 0; x < b.s[0]; x++)
      for (let y = 0; y < b.s[1]; y++)
        for (let z = 0; z < b.s[2]; z++) out.push({ ...b, p: [b.p[0] + x, b.p[1] + y, b.p[2] + z], s: [1, 1, 1] });
  }
  return out;
}

/**
 * Build a voxel part.
 * @param {Array} boxes  box list (integer voxel units)
 * @param {Object} palette  key → hex
 * @param {Object} opts
 *   voxelSize  meters per voxel (VOXEL, BOSS_VOXEL, ENV_VOXEL, ...)
 *   jitter     ±brightness jitter per box (default CONFIG.voxel.jitter)
 *   seed       jitter seed
 *   split      split boxes into single cells first (per-block jitter on big boxes)
 *   cullHidden drop faces (and so fully hidden boxes) covered by neighbouring boxes; overlaps resolve last-box-wins
 *   occluders  extra boxes that only hide faces (never rendered), e.g. a floor slab above a wall
 *   origin     [x, y, z] offset in voxel units applied after snapping (may be fractional, e.g. -0.5 to center a column)
 *   faceShade  { top, bottom, side } brightness multipliers per face direction
 *   attributes { name: { size, fn(box, x, y, z, center) → array } } extra per-vertex attributes
 *              (x/y/z = vertex in local meters, center = box center in local meters)
 *   castShadow / receiveShadow
 *   roughness / metalness  opaque material
 *   material / emissiveMaterial  material overrides
 *   name
 * @returns {{group, opaqueMesh, emissiveMesh, boxes, voxelSize, triangles}}
 */
export function buildPart(boxes, palette, opts = {}) {
  const {
    voxelSize = VOXEL,
    jitter = CONFIG.voxel.jitter,
    seed = 1,
    split = false,
    cullHidden = true,
    occluders = null,
    origin = [0, 0, 0],
    faceShade = null,
    attributes = null,
    castShadow = true,
    receiveShadow = true,
    roughness,
    metalness,
    material = null,
    emissiveMaterial = null,
    name = 'voxelPart',
  } = opts;

  let list = boxes.map(snapBox);
  if (split) list = splitCells(list);

  // Occupancy: cell → index of the last box covering it (-1 for occluders).
  let owner = null;
  if (cullHidden) {
    owner = new Map();
    const mark = (b, i) => {
      const [x0, y0, z0] = b.p;
      for (let x = x0; x < x0 + b.s[0]; x++)
        for (let y = y0; y < y0 + b.s[1]; y++)
          for (let z = z0; z < z0 + b.s[2]; z++) owner.set(cellKey(x, y, z), i);
    };
    if (occluders) occluders.map(snapBox).forEach((b) => mark(b, -1));
    list.forEach(mark);
  }

  const extraSizes = {};
  if (attributes) for (const n in attributes) extraSizes[n] = attributes[n].size;
  const opaque = new QuadSink(extraSizes);
  const emissive = new QuadSink(extraSizes);
  const [ox, oy, oz] = origin;
  const cell = [0, 0, 0];
  const nb = [0, 0, 0];
  const center = [0, 0, 0];
  let curBox = null;
  const extraFn = attributes ? (n, x, y, z) => attributes[n].fn(curBox, x, y, z, center) : null;
  opaque.extraFn = extraFn;
  emissive.extraFn = extraFn;

  const shadeFor = (a, sg) => {
    if (!faceShade) return 1;
    if (a === 1) return sg > 0 ? faceShade.top ?? 1 : faceShade.bottom ?? 1;
    return faceShade.side ?? 1;
  };

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
    curBox = b;
    for (let k = 0; k < 3; k++) center[k] = (b.p[k] + b.s[k] / 2 + origin[k]) * voxelSize;

    for (let a = 0; a < 3; a++) {
      const u = (a + 1) % 3;
      const v = (a + 2) % 3;
      for (const sg of [-1, 1]) {
        const sh = isEmissive ? 1 : shadeFor(a, sg);
        const fr = r * sh, fg = g * sh, fb = bl * sh;
        const w = sg > 0 ? b.p[a] + b.s[a] : b.p[a];
        const u0 = b.p[u], u1 = b.p[u] + b.s[u];
        const v0 = b.p[v], v1 = b.p[v] + b.s[v];
        if (!cullHidden) {
          sink.quad(a, sg, w, u0, u1, v0, v1, fr, fg, fb, voxelSize, ox, oy, oz);
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
          sink.quad(a, sg, w, u0, u1, v0, v1, fr, fg, fb, voxelSize, ox, oy, oz);
          continue;
        }
        // Partially covered: merge visible cells into strips along v.
        for (let cu = u0; cu < u1; cu++) {
          let start = -1;
          for (let cv = v0; cv <= v1; cv++) {
            const on = cv < v1 && vis[(cu - u0) * (v1 - v0) + (cv - v0)] === 1;
            if (on && start < 0) start = cv;
            if (!on && start >= 0) {
              sink.quad(a, sg, w, cu, cu + 1, start, cv, fr, fg, fb, voxelSize, ox, oy, oz);
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
    emissiveMesh = new THREE.Mesh(eg, emissiveMaterial || getEmissiveMaterial());
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
  constructor(extraSizes = {}) {
    this.sink = new QuadSink(extraSizes);
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
        this.sink.quad(a, sg, sg > 0 ? mx[a] : mn[a], mn[u], mx[u], mn[v], mx[v], r, g, b);
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
