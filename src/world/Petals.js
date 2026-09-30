import * as THREE from 'three';
import { CONFIG, ARENA_RADIUS } from '../config.js';
import { MAP_PALETTE, resolveColor } from '../voxel/palettes.js';

const AIR = 1;
const REST = 2;
const FADE = 3;
const FREE = 0;
const DEG = Math.PI / 180;

/**
 * Sakura petals (spec §4) — one pooled InstancedMesh, world clock.
 *
 * Instance layout: [0, pool) falling petals · [pool, pool + floorCarpet) resting carpet on the play
 * floor (movable, never fades) · then a static carpet under the trees (never updated).
 * Falling petals spawn inside canopies (weighted by cube count) or upwind off-screen, drift with the
 * wind + gusts, flutter and tumble, land, rest 4–8 s, shrink out and recycle.
 *
 * API: impulse(center, radius, strength) · sweep(origin, dir, arcDeg, reach, strength, spin) ·
 *      vortex(center, radius, strength). All work on airborne and resting petals.
 */
export class Petals {
  constructor({ groundHeightAt, canopyPoints, treeBases, wind }) {
    this.groundHeightAt = groundHeightAt;
    this.canopyPoints = canopyPoints;
    this.treeBases = treeBases;
    this.wind = wind;
    this.material = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
    this.material.name = 'petals';
    this.geometry = new THREE.BoxGeometry(1, 1, 1);
    this.mesh = null;
    this._tmp = new THREE.Vector3();
    this.build();
  }

  build() {
    const P = CONFIG.map.petals;
    if (this.mesh) {
      this.mesh.parent?.remove(this.mesh);
      this.mesh.dispose();
    }
    this.pool = CONFIG.quality.petalCount;
    this.carpet = P.floorCarpet;
    this.treeCarpet = P.treeCarpet;
    const n = this.pool + this.carpet + this.treeCarpet;
    this.total = n;
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, n);
    mesh.name = 'petals';
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh = mesh;

    const f = (k) => new Float32Array(n);
    this.px = f(); this.py = f(); this.pz = f();
    this.vx = f(); this.vy = f(); this.vz = f();
    this.ra = f(); this.rb = f(); this.sa = f(); this.sb = f();
    this.ph = f(); this.ff = f(); this.fall = f();
    this.timer = f(); this.scale = f(); this.ground = f();
    this.state = new Uint8Array(n);
    this.isCarpet = new Uint8Array(n);
    this._spawnAcc = 0;
    this._t = 0;

    // Colors: varied pale sakura pinks (non-emissive).
    const keys = ['sakura2', 'sakura2', 'sakura2', 'sakura1', 'sakura1', 'sakura3'];
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      col.copy(resolveColor(MAP_PALETTE, keys[Math.floor(Math.random() * keys.length)])).multiplyScalar(0.9 + Math.random() * 0.15);
      mesh.setColorAt(i, col);
    }

    for (let i = 0; i < this.pool; i++) {
      this.state[i] = FREE;
      this._writeHidden(i);
    }
    // Floor carpet: resting petals on the play floor, denser toward the trees.
    for (let k = 0; k < this.carpet; k++) {
      const i = this.pool + k;
      this.isCarpet[i] = 1;
      this._placeOnFloor(i);
    }
    // Static carpet under the trees.
    for (let k = 0; k < this.treeCarpet; k++) {
      const i = this.pool + this.carpet + k;
      const base = this.treeBases[Math.floor(Math.random() * this.treeBases.length)];
      if (!base) {
        this._writeHidden(i);
        continue;
      }
      const a = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 1.4) * base.spread;
      const x = base.x + Math.sin(a) * r;
      const z = base.z + Math.cos(a) * r;
      const g = this.groundHeightAt(x, z);
      if (g == null) {
        this._writeHidden(i);
        continue;
      }
      this._setRest(i, x, g, z);
      this._write(i);
    }
    // Pre-warm: scatter some falling petals mid-air so the first frame already has motion.
    for (let i = 0; i < this.pool * 0.6; i++) {
      this._spawn(i);
      this.py[i] -= Math.random() * 6;
      if (this.py[i] < this.ground[i] + 0.3) this.py[i] = this.ground[i] + 0.3 + Math.random() * 3;
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  _placeOnFloor(i) {
    // Biased toward the trees: pick a tree direction, land between mid-floor and the rim.
    let x, z;
    const base = this.treeBases[Math.floor(Math.random() * this.treeBases.length)];
    if (base && Math.random() < 0.7) {
      const dx = base.x, dz = base.z;
      const l = Math.hypot(dx, dz) || 1;
      const r = ARENA_RADIUS * (1 - Math.pow(Math.random(), 1.8) * 0.75) - 0.2;
      const spread = (Math.random() - 0.5) * 0.9;
      const a = Math.atan2(dx / l, dz / l) + spread;
      x = Math.sin(a) * r;
      z = Math.cos(a) * r;
    } else {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * (ARENA_RADIUS - 0.3);
      x = Math.sin(a) * r;
      z = Math.cos(a) * r;
    }
    const g = this.groundHeightAt(x, z) ?? 0;
    this._setRest(i, x, g, z);
    this._write(i);
  }

  _setRest(i, x, g, z) {
    const P = CONFIG.map.petals;
    this.px[i] = x; this.pz[i] = z;
    this.ground[i] = g;
    this.py[i] = g + P.size * 0.2;
    this.vx[i] = this.vy[i] = this.vz[i] = 0;
    this.ra[i] = 0;
    this.rb[i] = Math.random() * Math.PI * 2;
    this.scale[i] = 1;
    this.state[i] = REST;
    this.timer[i] = this.isCarpet[i] ? Infinity : P.rest[0] + Math.random() * (P.rest[1] - P.rest[0]);
  }

  _spawn(i) {
    const P = CONFIG.map.petals;
    const pts = this.canopyPoints;
    let x, y, z;
    if (Math.random() < P.offscreenFrac || !pts.length) {
      // Upwind, outside the frame, drifting in.
      const w = this.wind.dir;
      const side = (Math.random() - 0.5) * 48;
      x = -w.x * 30 + -w.y * side;
      z = -w.y * 30 + w.x * side;
      y = 2 + Math.random() * 10;
    } else {
      const p = pts[Math.floor(Math.random() * pts.length)];
      x = p.x + (Math.random() - 0.5) * 0.5;
      y = p.y - 0.2 - Math.random() * 0.2;
      z = p.z + (Math.random() - 0.5) * 0.5;
    }
    this.px[i] = x; this.py[i] = y; this.pz[i] = z;
    this.vx[i] = this.wind.velocity.x * 0.5;
    this.vy[i] = -0.2;
    this.vz[i] = this.wind.velocity.z * 0.5;
    this.ra[i] = Math.random() * 6.28;
    this.rb[i] = Math.random() * 6.28;
    this.sa[i] = (P.spin[0] + Math.random() * (P.spin[1] - P.spin[0])) * (Math.random() < 0.5 ? -1 : 1);
    this.sb[i] = (P.spin[0] + Math.random() * (P.spin[1] - P.spin[0])) * 0.5;
    this.ph[i] = Math.random() * 6.28;
    this.ff[i] = (P.flutterFreq[0] + Math.random() * (P.flutterFreq[1] - P.flutterFreq[0])) * Math.PI * 2;
    this.fall[i] = P.fall[0] + Math.random() * (P.fall[1] - P.fall[0]);
    this.scale[i] = 1;
    this.state[i] = AIR;
    this.ground[i] = -Infinity;
  }

  // ── Gameplay API (later stages) ─────────────────────────────────────────
  // Push petals outward from center (XZ), strongest at the center; resting petals hop up.
  impulse(center, radius, strength) {
    const P = CONFIG.map.petals;
    for (let i = 0; i < this.pool + this.carpet; i++) {
      const s = this.state[i];
      if (s === FREE) continue;
      const dx = this.px[i] - center.x, dz = this.pz[i] - center.z;
      const d = Math.hypot(dx, dz);
      if (d > radius || Math.abs(this.py[i] - center.y) > radius + 1) continue;
      const k = strength * (1 - d / radius);
      const nx = d > 1e-4 ? dx / d : Math.random() - 0.5;
      const nz = d > 1e-4 ? dz / d : Math.random() - 0.5;
      this._kick(i, nx * k, k * (s === AIR ? 0.25 : P.hop), nz * k);
    }
  }

  // Push petals along an arc (whip strikes): inside `reach` and within ±arcDeg/2 of dir,
  // tangentially in the sweep direction (spin = +1 counter-clockwise from above, −1 clockwise) plus outward.
  sweep(origin, dir, arcDeg, reach, strength, spin = 1) {
    const P = CONFIG.map.petals;
    const half = (arcDeg * DEG) / 2;
    const base = Math.atan2(dir.x, dir.z);
    for (let i = 0; i < this.pool + this.carpet; i++) {
      const s = this.state[i];
      if (s === FREE) continue;
      const dx = this.px[i] - origin.x, dz = this.pz[i] - origin.z;
      const d = Math.hypot(dx, dz);
      if (d > reach || d < 1e-4) continue;
      let da = Math.atan2(dx, dz) - base;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) > half) continue;
      const nx = dx / d, nz = dz / d;
      const tx = nz * spin, tz = -nx * spin; // tangent
      const k = strength * (0.4 + 0.6 * (d / reach));
      this._kick(i, (tx * 0.8 + nx * 0.4) * k, k * (s === AIR ? 0.15 : P.hop * 0.7), (tz * 0.8 + nz * 0.4) * k);
    }
  }

  // Swirl petals around center with an inward/upward pull.
  vortex(center, radius, strength) {
    for (let i = 0; i < this.pool + this.carpet; i++) {
      if (this.state[i] === FREE) continue;
      const dx = this.px[i] - center.x, dz = this.pz[i] - center.z;
      const d = Math.hypot(dx, dz);
      if (d > radius || d < 1e-4) continue;
      const k = strength * (1 - d / radius);
      const nx = dx / d, nz = dz / d;
      this._kick(i, (nz - nx * 0.4) * k, k * 0.6, (-nx - nz * 0.4) * k);
    }
  }

  _kick(i, x, y, z) {
    if (this.state[i] !== AIR) {
      this.state[i] = AIR;
      this.ground[i] = -Infinity;
      this.fall[i] = this.fall[i] || CONFIG.map.petals.fall[0];
      this.ff[i] = this.ff[i] || 9;
      this.sa[i] = this.sa[i] || 4;
      this.sb[i] = this.sb[i] || 2;
      this.scale[i] = 1;
      this.py[i] += 0.02;
    }
    this.vx[i] += x;
    this.vy[i] += y;
    this.vz[i] += z;
  }

  // ── Simulation (world clock) ───────────────────────────────────────────
  update(dt) {
    if (dt <= 0) return;
    const P = CONFIG.map.petals;
    this._t += dt;
    const t = this._t;
    const wv = this.wind.velocity;
    const wd = this.wind.dir;
    const relax = Math.min(1, P.drag * dt);
    const active = this.pool + this.carpet;

    // Spawn
    this._spawnAcc += P.spawnRate * dt;
    for (let i = 0; i < this.pool && this._spawnAcc >= 1; i++) {
      if (this.state[i] !== FREE) continue;
      this._spawn(i);
      this._spawnAcc -= 1;
    }
    this._spawnAcc = Math.min(this._spawnAcc, 4);

    let carpetMoved = false;
    for (let i = 0; i < active; i++) {
      const s = this.state[i];
      if (s === FREE) continue;
      if (s === AIR) {
        const fl = Math.sin(t * this.ff[i] + this.ph[i]) * P.flutterAmp;
        const tx = wv.x - wd.y * fl;
        const tz = wv.z + wd.x * fl;
        const ty = -this.fall[i] * (0.75 + 0.25 * Math.sin(t * this.ff[i] * 0.5 + this.ph[i]));
        this.vx[i] += (tx - this.vx[i]) * relax;
        this.vz[i] += (tz - this.vz[i]) * relax;
        this.vy[i] += (ty - this.vy[i]) * relax;
        if (Math.random() < P.liftChance * dt) this.vy[i] += P.liftStrength * (0.5 + Math.random());
        this.px[i] += this.vx[i] * dt;
        this.py[i] += this.vy[i] * dt;
        this.pz[i] += this.vz[i] * dt;
        this.ra[i] += this.sa[i] * dt;
        this.rb[i] += this.sb[i] * dt;
        if (this.vy[i] < 0) {
          const g = this.groundHeightAt(this.px[i], this.pz[i]);
          if (g != null && this.py[i] <= g + P.size * 0.3) {
            this._setRest(i, this.px[i], g, this.pz[i]);
          } else if (this.py[i] < P.voidY) {
            this.state[i] = this.isCarpet[i] ? AIR : FREE;
            if (this.isCarpet[i]) this._placeOnFloor(i);
          }
        }
        if (this.isCarpet[i]) carpetMoved = true;
      } else if (s === REST) {
        if (this.isCarpet[i]) continue;
        this.timer[i] -= dt;
        if (this.timer[i] <= 0) {
          this.state[i] = FADE;
          this.timer[i] = P.fade;
        }
      } else if (s === FADE) {
        this.timer[i] -= dt;
        this.scale[i] = Math.max(0, this.timer[i] / P.fade);
        if (this.timer[i] <= 0) this.state[i] = FREE;
      }
      if (this.state[i] === FREE) this._writeHidden(i);
      else this._write(i);
    }
    const im = this.mesh.instanceMatrix;
    im.clearUpdateRanges();
    im.addUpdateRange(0, (carpetMoved || this._carpetDirty ? active : this.pool) * 16);
    this._carpetDirty = carpetMoved;
    im.needsUpdate = true;
  }

  _write(i) {
    const P = CONFIG.map.petals;
    const e = this.mesh.instanceMatrix.array;
    const o = i * 16;
    const resting = this.state[i] !== AIR;
    const a = resting ? 0 : this.ra[i];
    const b = this.rb[i];
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    const s = P.size * this.scale[i];
    const sx = s, sy = s * (resting ? 0.35 : 0.5), sz = s;
    // R = Ry(b) · Rx(a), columns scaled by (sx, sy, sz), column-major.
    e[o] = cb * sx; e[o + 1] = 0; e[o + 2] = -sb * sx; e[o + 3] = 0;
    e[o + 4] = sb * sa * sy; e[o + 5] = ca * sy; e[o + 6] = cb * sa * sy; e[o + 7] = 0;
    e[o + 8] = sb * ca * sz; e[o + 9] = -sa * sz; e[o + 10] = cb * ca * sz; e[o + 11] = 0;
    e[o + 12] = this.px[i]; e[o + 13] = this.py[i]; e[o + 14] = this.pz[i]; e[o + 15] = 1;
  }

  _writeHidden(i) {
    const e = this.mesh.instanceMatrix.array;
    const o = i * 16;
    for (let k = 0; k < 16; k++) e[o + k] = 0;
    e[o + 15] = 1;
    e[o + 13] = -1000;
  }

  get airborneCount() {
    let c = 0;
    for (let i = 0; i < this.pool; i++) if (this.state[i] === AIR) c++;
    return c;
  }
}
