import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG, ENV_VOXEL, ENV_BIG_VOXEL, ARENA_RADIUS } from '../config.js';
import { buildPart, makeRng, hash01 } from '../voxel/VoxelBuilder.js';
import { MAP_PALETTE } from '../voxel/palettes.js';
import { makeSwayMaterial, makeSwayDepthMaterial } from './mapMaterials.js';
import { arenaDir } from './ArenaBounds.js';

const U = ENV_VOXEL; // bark grid (0.25 m)
const B = ENV_BIG_VOXEL; // canopy grid (0.5 m)
const TREE_PALETTE = { ...MAP_PALETTE, leaf: '#6b7d3a', barkLight: '#3d3133' };

// Smooth 3D value noise in [0, 1] (for bumpy canopy surfaces).
function valueNoise3(x, y, z, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t) => t * t * (3 - 2 * t);
  const u = s(xf), v = s(yf), w = s(zf);
  const h = (a, b, c) => hash01(seed, a, b * 131 + c, c);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
    l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v),
    w,
  );
}

/**
 * Seeded, deliberately chunky sakura tree (spec §4, IMG-02).
 * Trunk: stair-stepped leaning curve of 0.25 m blocks tapering from ~1 m to 0.5 m, root flare and
 * a rock mound. 2–4 branches (depth 2). Canopy: 3–5 overlapping ellipsoid clusters on a 0.5 m grid,
 * noisy stepped surface, a few outliers and gaps, shell only (interior cubes are never visible).
 * Everything in tree-local meters with the base at the origin.
 * @returns {{ bark, blossoms, clusterOf, clusters, forkY, topY, maxR }}
 */
export function generateTree({ seed, height, hero = false, leanDir = new THREE.Vector3(1, 0, 0), density = 1, colorBalance = 0.35, greenCubes = [1, 3] }) {
  const rng = makeRng(seed);
  const rr = (a, b) => a + (b - a) * rng();
  const bark = [];
  const H = height;

  // ── Trunk (bark units = 0.25 m)
  const trunkH = H * (hero ? rr(0.38, 0.43) : rr(0.36, 0.44));
  const t0 = hero ? 6 : H > 7 ? 5 : 4; // base thickness (blocks)
  const t1 = hero ? 3 : 2; // at the fork
  const lean = new THREE.Vector3(leanDir.x, 0, leanDir.z).normalize();
  const perp = new THREE.Vector3(-lean.z, 0, lean.x);
  const leanM = trunkH * rr(0.28, 0.45);
  const sCurve = rr(-0.35, 0.35);
  const layers = Math.max(2, Math.round(trunkH / (2 * U)));
  let fork = new THREE.Vector3();
  const trunkCol = (y) => {
    const h = hash01(seed, 3, y);
    return h < 0.12 ? 'moss' : h < 0.4 ? 'barkLight' : 'bark';
  };
  for (let k = 0; k < layers; k++) {
    const t = k / (layers - 1);
    const off = lean.clone().multiplyScalar(leanM * Math.pow(t, 1.6)).addScaledVector(perp, sCurve * Math.sin(t * Math.PI));
    const th = Math.round(t0 + (t1 - t0) * t);
    const cx = off.x / U, cz = off.z / U;
    bark.push({ p: [Math.round(cx - th / 2), k * 2, Math.round(cz - th / 2)], s: [th, 2, th], c: trunkCol(k), w: 0 });
    if (k === layers - 1) fork = new THREE.Vector3(off.x, (k + 1) * 2 * U, off.z);
  }
  // Root flare + rock mound.
  bark.push({ p: [-Math.ceil((t0 + 2) / 2), 0, -Math.ceil((t0 + 2) / 2)], s: [t0 + 2, 1, t0 + 2], c: 'bark', w: 0 });
  const roots = hero ? 5 : 3;
  for (let i = 0; i < roots; i++) {
    const a = (i / roots) * Math.PI * 2 + rr(0, 1);
    const d = t0 / 2 + rr(1, 2.5);
    bark.push({ p: [Math.round(Math.sin(a) * d) - 1, 0, Math.round(Math.cos(a) * d) - 1], s: [2, 1, 2], c: 'bark', w: 0 });
  }
  const rocks = hero ? 9 : 5;
  for (let i = 0; i < rocks; i++) {
    const a = rr(0, Math.PI * 2);
    const d = rr(0.6, 1.6) * (hero ? 1.3 : 1);
    const hgt = rng() < 0.4 ? 3 : 2;
    bark.push({
      p: [Math.round((Math.sin(a) * d) / U) - 1, -1, Math.round((Math.cos(a) * d) / U) - 1],
      s: [2, hgt, 2],
      c: rng() < 0.35 ? 'moss' : rng() < 0.5 ? 'basalt1' : 'basalt2',
      w: 0,
    });
  }

  // ── Branches (depth 2); tips become canopy cluster centers.
  const clusters = [];
  const rBase = (0.95 + H * rr(0.11, 0.13)) * density; // floor keeps small trees lush
  const addBranch = (start, dir, length, thick, depth) => {
    const steps = Math.max(2, Math.round(length / U));
    let tip = start.clone();
    for (let s = 1; s <= steps; s++) {
      const f = s / steps;
      const p = start.clone().addScaledVector(dir, f * length);
      const th = f < 0.55 ? thick : Math.max(1, thick - 1);
      bark.push({
        p: [Math.round(p.x / U - th / 2), Math.round(p.y / U - th / 2), Math.round(p.z / U - th / 2)],
        s: [th, th, th],
        c: 'bark',
        w: 0.35 * f * (depth === 1 ? 0.8 : 1),
      });
      tip = p;
    }
    if (depth === 1) {
      // one sub-branch from ~60% along
      const from = start.clone().addScaledVector(dir, 0.6 * length);
      const sub = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (rng() < 0.5 ? -1 : 1) * rr(0.6, 1.0));
      sub.y += 0.25;
      sub.normalize();
      const subTip = addBranch(from, sub, length * rr(0.45, 0.6), Math.max(1, thick - 1), 2);
      clusters.push({ c: subTip.clone().add(new THREE.Vector3(0, -rBase * rr(0.0, 0.3), 0)), s: rr(0.7, 0.85) });
    }
    return tip;
  };
  const nBranch = hero ? 4 : 2 + (rng() < 0.6 ? 1 : 0);
  const az0 = Math.atan2(lean.x, lean.z) + rr(-0.4, 0.4);
  for (let i = 0; i < nBranch; i++) {
    const az = az0 + (i / nBranch) * Math.PI * 2 + rr(-0.35, 0.35);
    const el = i % 2 === 0 ? rr(0.25, 0.55) : rr(0.6, 1.05); // alternate low/high clumps
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    // Branches continuing the lean grow longer.
    const along = Math.max(0, dir.x * lean.x + dir.z * lean.z);
    const len = H * (hero ? rr(0.32, 0.42) : rr(0.26, 0.36)) * (0.85 + 0.35 * along);
    const tip = addBranch(fork, dir, len, hero ? 3 : 2, 1);
    clusters.push({ c: tip.clone().add(new THREE.Vector3(0, rBase * rr(0.05, 0.45), 0)), s: rr(0.95, 1.15) });
  }
  clusters.push({ c: fork.clone().add(new THREE.Vector3(lean.x * 0.5, (H - trunkH) * 0.62, lean.z * 0.5)), s: rr(1.0, 1.15) });
  // Keep the 3–5 largest clusters (spec §4).
  clusters.sort((a, b) => b.s - a.s);
  clusters.length = Math.min(clusters.length, 5);
  for (const cl of clusters) {
    const rx = rBase * cl.s;
    cl.r = [rx * rr(0.95, 1.12), rx * rr(0.72, 0.9), rx * rr(0.95, 1.12)];
  }

  // ── Canopy fill on the 0.5 m grid.
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  for (const cl of clusters) {
    const c = cl.c.toArray();
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], Math.floor((c[k] - cl.r[k] * 1.3) / B));
      max[k] = Math.max(max[k], Math.ceil((c[k] + cl.r[k] * 1.3) / B));
    }
  }
  const filled = new Map();
  const key = (x, y, z) => ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);
  const nearest = (x, y, z) => {
    let best = Infinity;
    let bi = 0;
    clusters.forEach((cl, i) => {
      let dy = (y - cl.c.y) / cl.r[1];
      if (dy < -0.45) dy *= 1.2; // slightly flatter bottoms
      const d = Math.hypot((x - cl.c.x) / cl.r[0], dy, (z - cl.c.z) / cl.r[2]);
      if (d < best) {
        best = d;
        bi = i;
      }
    });
    return [best, bi];
  };
  for (let x = min[0]; x <= max[0]; x++)
    for (let y = min[1]; y <= max[1]; y++)
      for (let z = min[2]; z <= max[2]; z++) {
        const px = (x + 0.5) * B, py = (y + 0.5) * B, pz = (z + 0.5) * B;
        const [d, ci] = nearest(px, py, pz);
        const n = valueNoise3(x * 0.42, y * 0.42, z * 0.42, seed);
        const thr = 1 + (n - 0.5) * 0.4;
        const hsh = hash01(seed, x, y * 57 + z, 11);
        let on = d < thr;
        if (!on && d < thr + 0.25 && hsh < 0.05) on = true; // outliers
        if (on && d > thr * 0.72 && hsh > 0.935) on = false; // gaps
        if (on) filled.set(key(x, y, z), { x, y, z, ci, d });
      }
  // Shell only.
  const blossoms = [];
  const clusterOf = [];
  let topY = -Infinity;
  const cubes = [];
  for (const c of filled.values()) {
    const { x, y, z } = c;
    const exposed =
      !filled.has(key(x + 1, y, z)) || !filled.has(key(x - 1, y, z)) || !filled.has(key(x, y + 1, z)) ||
      !filled.has(key(x, y - 1, z)) || !filled.has(key(x, y, z + 1)) || !filled.has(key(x, y, z - 1));
    if (!exposed) continue;
    cubes.push(c);
    topY = Math.max(topY, (y + 1) * B);
  }
  // Colors: more pale pink and white than saturated pink; whiter on top; per-cluster patches.
  const clusterBias = clusters.map(() => rr(-0.25, 0.25));
  const nGreen = Math.round(rr(greenCubes[0], greenCubes[1] + 0.99) - 0.49);
  const greenSet = new Set();
  while (greenSet.size < Math.min(nGreen, cubes.length)) greenSet.add(Math.floor(rng() * cubes.length));
  let maxR = 0;
  cubes.forEach((c, idx) => {
    const cl = clusters[c.ci];
    const up = ((c.y + 0.5) * B - cl.c.y) / cl.r[1]; // -1 bottom .. 1 top
    const patch = valueNoise3(c.x * 0.3 + 7, c.y * 0.3, c.z * 0.3, seed + 5);
    const pink = THREE.MathUtils.clamp(colorBalance + clusterBias[c.ci] + (patch - 0.5) * 0.6 - up * 0.25, 0, 1);
    const r = hash01(seed, c.x, c.y * 131 + c.z, 29);
    let col;
    if (greenSet.has(idx)) col = 'leaf';
    else if (r < pink * 0.55) col = 'sakura2'; // soft saturated pink
    else if (r < pink * 0.55 + 0.4) col = 'sakura1'; // pale pink
    else if (r < 0.88) col = 'sakura3'; // very pale
    else col = 'sakuraWhite';
    blossoms.push({ p: [c.x, c.y, c.z], s: [1, 1, 1], c: col });
    clusterOf.push(c.ci);
    maxR = Math.max(maxR, Math.hypot((c.x + 0.5) * B, (c.z + 0.5) * B));
  });

  return { bark, blossoms, clusterOf, clusters, forkY: fork.y, topY, maxR };
}

// ── The grove: placement (spec §4), play-area occlusion check with outward nudging, merged meshes.
export class SakuraGrove {
  constructor({ groundHeightAt, camera }) {
    this.group = new THREE.Group();
    this.group.name = 'sakura';
    this.groundHeightAt = groundHeightAt;
    this.camera = camera;
    this.barkMat = makeSwayMaterial('bark', 0);
    this.blossomMat = makeSwayMaterial('blossom', CONFIG.map.trees.emissiveLift);
    this.depthMat = makeSwayDepthMaterial();
    this.highlight = null;
    this.build();
  }

  build() {
    this.dispose();
    const T = CONFIG.map.trees;
    this.trees = T.placement.map((pl, i) => {
      const dir = arenaDir(pl.angleDeg);
      // Hero tree leans toward the torii / center; others lean outward-ish so canopies stay off the play area.
      const lean = pl.hero
        ? dir.clone().negate().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.5)
        : dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (hash01(T.seed, i) - 0.5) * 1.4);
      const data = generateTree({
        seed: T.seed + i * 977,
        height: pl.height,
        hero: !!pl.hero,
        leanDir: lean,
        density: T.density,
        colorBalance: T.colorBalance,
        greenCubes: T.greenCubes,
      });
      const tree = { index: i, placement: pl, dir, radius: pl.radius, data, position: new THREE.Vector3(), nudged: 0 };
      this._place(tree);
      return tree;
    });

    // Nudge outward until no blossom covers the play area from the game camera.
    const C = T.check;
    for (const tree of this.trees) {
      let guard = 0;
      while (this._violations(tree).size > 0 && guard < C.nudgeMax) {
        tree.radius += C.nudgeStep;
        tree.nudged += C.nudgeStep;
        this._place(tree);
        guard++;
      }
      if (tree.nudged > 0) console.info(`[sakura] tree ${tree.index} nudged outward ${tree.nudged.toFixed(1)} m`);
    }
    this._buildMeshes();
    this.updateCheck();
  }

  _place(tree) {
    tree.position.copy(tree.dir).multiplyScalar(tree.radius);
    const g = this.groundHeightAt(tree.position.x, tree.position.z);
    tree.position.y = g == null ? -1 : g;
  }

  // World-space centers of the tree's blossom cubes.
  _cubeCenters(tree) {
    const out = [];
    for (const b of tree.data.blossoms) {
      out.push(
        new THREE.Vector3((b.p[0] + 0.5) * B + tree.position.x, (b.p[1] + 0.5) * B + tree.position.y, (b.p[2] + 0.5) * B + tree.position.z),
      );
    }
    return out;
  }

  // Clusters whose cubes sit between the fixed camera and the play volume
  // (cylinder of ARENA_RADIUS + margin, from the floor up to character height).
  _violations(tree) {
    const C = CONFIG.map.trees.check;
    const cam = this.camera.position;
    const R = ARENA_RADIUS + C.margin;
    const bad = new Set();
    const centers = this._cubeCenters(tree);
    centers.forEach((p, idx) => {
      const dx = p.x - cam.x, dy = p.y - cam.y, dz = p.z - cam.z;
      // Ray cam + t·d, t = 1 at the cube. XZ circle.
      const a = dx * dx + dz * dz;
      const b = 2 * (cam.x * dx + cam.z * dz);
      const c = cam.x * cam.x + cam.z * cam.z - R * R;
      const disc = b * b - 4 * a * c;
      if (disc < 0 || a < 1e-9) return;
      const sq = Math.sqrt(disc);
      let t0 = (-b - sq) / (2 * a);
      let t1 = (-b + sq) / (2 * a);
      if (dy < 0) {
        const ty0 = (C.height - cam.y) / dy; // enters the top of the volume
        const ty1 = (0 - cam.y) / dy; // reaches the floor
        t0 = Math.max(t0, ty0);
        t1 = Math.min(t1, ty1);
      } else return;
      if (t0 <= t1 && t1 > 1) bad.add(tree.data.clusterOf[idx]);
    });
    return bad;
  }

  _buildMeshes() {
    const T = CONFIG.map.trees;
    const groups = { near: { bark: [], blossom: [] }, far: { bark: [], blossom: [] } };
    this.canopyPoints = [];
    for (const tree of this.trees) {
      const d = tree.data;
      const pos = tree.position;
      const fork = d.forkY;
      const span = Math.max(0.5, d.topY - fork);
      const maxR = Math.max(0.5, d.maxR);
      const grp = tree.radius < T.nearRadius ? groups.near : groups.far;
      const barkPart = buildPart(d.bark, TREE_PALETTE, {
        voxelSize: U,
        origin: [pos.x / U, pos.y / U, pos.z / U],
        seed: tree.index * 13 + 1,
        jitter: 0.08,
        faceShade: { top: T.barkTopShade, side: 1, bottom: 0.7 },
        attributes: { aSway: { size: 4, fn: (box, x, y, z, c) => [c[0], c[1], c[2], box.w ?? 0] } },
        material: this.barkMat,
        name: `tree${tree.index}:bark`,
      });
      const blossomPart = buildPart(d.blossoms, TREE_PALETTE, {
        voxelSize: B,
        origin: [pos.x / B, pos.y / B, pos.z / B],
        seed: tree.index * 13 + 2,
        jitter: 0.05,
        faceShade: { top: T.topShade, side: 1, bottom: T.bottomShade },
        attributes: {
          aSway: {
            size: 4,
            fn: (box, x, y, z, c) => {
              const up = THREE.MathUtils.clamp((c[1] - pos.y - fork) / span, 0, 1);
              const out = THREE.MathUtils.clamp(Math.hypot(c[0] - pos.x, c[2] - pos.z) / maxR, 0, 1);
              return [c[0], c[1], c[2], 0.25 + 0.45 * up + 0.3 * out];
            },
          },
        },
        material: this.blossomMat,
        name: `tree${tree.index}:blossom`,
      });
      if (barkPart.opaqueMesh) grp.bark.push(barkPart.opaqueMesh.geometry);
      if (blossomPart.opaqueMesh) grp.blossom.push(blossomPart.opaqueMesh.geometry);
      for (const p of this._cubeCenters(tree)) this.canopyPoints.push(p);
      tree.cubeCount = d.blossoms.length;
    }
    this.meshes = [];
    for (const name of ['near', 'far']) {
      const g = groups[name];
      for (const kind of ['bark', 'blossom']) {
        if (!g[kind].length) continue;
        const geo = mergeGeometries(g[kind]);
        g[kind].forEach((x) => x.dispose());
        const mesh = new THREE.Mesh(geo, kind === 'bark' ? this.barkMat : this.blossomMat);
        mesh.name = `sakura:${name}:${kind}`;
        mesh.customDepthMaterial = this.depthMat;
        mesh.receiveShadow = true;
        mesh.userData.shadowGroup = name;
        this.meshes.push(mesh);
        this.group.add(mesh);
      }
    }
    this.applyShadows();
  }

  applyShadows() {
    for (const m of this.meshes) m.castShadow = m.userData.shadowGroup === 'near' && CONFIG.quality.treeShadows;
  }

  // Debug: highlight blossom clusters that cover the play area from the current fixed camera.
  updateCheck() {
    if (this.highlight) {
      this.group.remove(this.highlight);
      this.highlight.geometry.dispose();
      this.highlight.material.dispose();
      this.highlight = null;
    }
    this.violationCount = 0;
    if (!CONFIG.map.debug.canopyCheck) return;
    const cubes = [];
    for (const tree of this.trees) {
      const bad = this._violations(tree);
      if (!bad.size) continue;
      this.violationCount += bad.size;
      const centers = this._cubeCenters(tree);
      tree.data.clusterOf.forEach((ci, idx) => {
        if (bad.has(ci)) cubes.push(centers[idx]);
      });
    }
    if (!cubes.length) {
      console.info('[sakura] canopy check: no blossom cluster covers the play area');
      return;
    }
    console.warn(`[sakura] canopy check: ${this.violationCount} cluster(s) cover the play area`);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff2040, transparent: true, opacity: 0.55, depthTest: false, toneMapped: false });
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(B * 1.05, B * 1.05, B * 1.05), mat, cubes.length);
    const m = new THREE.Matrix4();
    cubes.forEach((p, i) => mesh.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z)));
    mesh.renderOrder = 10;
    this.highlight = mesh;
    this.group.add(mesh);
  }

  get cubeCounts() {
    return this.trees.map((t) => t.cubeCount);
  }

  dispose() {
    if (this.meshes) for (const m of this.meshes) {
      this.group.remove(m);
      m.geometry.dispose();
    }
    this.meshes = [];
  }
}
