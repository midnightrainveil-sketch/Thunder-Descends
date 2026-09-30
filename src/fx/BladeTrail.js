import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Ribbon trail (reusable): a band between two moving points (e.g. blade base and tip), sampled
// every frame while active, each sample fading out over `lifetime`. Driven by whatever clock the
// owner passes (the hero's trails use the hero clock → they freeze in hitstop / slow in Q aim).
// Additive HDR color so it blooms. Fixed-size buffers, no per-frame allocations.
// cfg = { samples, lifetime, color, intensity, opacity, baseAlpha? }
export class RibbonTrail {
  constructor(cfg) {
    const T = cfg;
    this.cfg = cfg;
    this.n = T.samples;
    this.base = Array.from({ length: this.n }, () => new THREE.Vector3());
    this.tip = Array.from({ length: this.n }, () => new THREE.Vector3());
    this.age = new Float32Array(this.n).fill(Infinity);
    this.head = 0; // index of the newest sample
    this.count = 0;
    this.active = false;

    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.n * 2 * 3);
    this.colors = new Float32Array(this.n * 2 * 4);
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 4).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let k = 0; k < this.n - 1; k++) {
      const a = 2 * k;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(idx);
    geo.setDrawRange(0, 0);
    this.material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = 'ribbonTrail';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.color = new THREE.Color(T.color);
  }

  start() {
    this.active = true;
  }

  stop() {
    this.active = false;
  }

  clear() {
    this.age.fill(Infinity);
    this.count = 0;
    this.mesh.geometry.setDrawRange(0, 0);
  }

  // dt = hero clock; base/tip = current world positions of the blade.
  update(dt, basePos, tipPos) {
    if (dt <= 0) return;
    const T = this.cfg;
    for (let i = 0; i < this.n; i++) this.age[i] += dt;
    if (this.active) {
      this.head = (this.head + 1) % this.n;
      this.base[this.head].copy(basePos);
      this.tip[this.head].copy(tipPos);
      this.age[this.head] = 0;
    }
    // Rebuild newest → oldest while samples are alive.
    const col = this.color;
    let k = 0;
    for (let j = 0; j < this.n; j++) {
      const i = (this.head - j + this.n) % this.n;
      if (this.age[i] > T.lifetime) break;
      const life = 1 - this.age[i] / T.lifetime;
      const along = 1 - j / this.n;
      const a = life * along * T.opacity;
      const o = k * 6;
      const b = this.base[i];
      const t = this.tip[i];
      this.positions[o] = b.x; this.positions[o + 1] = b.y; this.positions[o + 2] = b.z;
      this.positions[o + 3] = t.x; this.positions[o + 4] = t.y; this.positions[o + 5] = t.z;
      const c = k * 8;
      const baseA = a * (T.baseAlpha ?? 0.35); // fainter toward the base point
      this.colors[c] = col.r * T.intensity * baseA; this.colors[c + 1] = col.g * T.intensity * baseA; this.colors[c + 2] = col.b * T.intensity * baseA; this.colors[c + 3] = baseA;
      this.colors[c + 4] = col.r * T.intensity * a; this.colors[c + 5] = col.g * T.intensity * a; this.colors[c + 6] = col.b * T.intensity * a; this.colors[c + 7] = a;
      k++;
    }
    this.count = k;
    const geo = this.mesh.geometry;
    geo.setDrawRange(0, Math.max(0, (k - 1) * 6));
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }
}

// The hero's sword trail (CONFIG.hero.trail).
export class BladeTrail extends RibbonTrail {
  constructor() {
    super(CONFIG.hero.trail);
  }
}
