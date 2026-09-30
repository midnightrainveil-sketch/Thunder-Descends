import * as THREE from 'three';
import { CONFIG } from '../config.js';

const _dir = new THREE.Vector3();
const _view = new THREE.Vector3();
const _side = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();

/**
 * Lightning bolts between two points (pooled, one draw call). Each bolt is a jagged polyline drawn
 * as a camera-facing strip with 3 vertices per point (white-hot core, colored fading edges). The
 * jag pattern re-rolls every `flicker` seconds so bolts crackle. Bolts can follow moving ends
 * (`setEnds`) or be fire-and-forget with a lifetime.
 */
export class Lightning {
  constructor(scene) {
    const F = CONFIG.fx;
    this.n = F.lightningBolts;
    this.pts = F.lightningPoints;
    const vPerBolt = this.pts * 3;
    this.positions = new Float32Array(this.n * vPerBolt * 3);
    this.colors = new Float32Array(this.n * vPerBolt * 4);
    const idx = [];
    for (let b = 0; b < this.n; b++) {
      const o = b * vPerBolt;
      for (let k = 0; k < this.pts - 1; k++) {
        const a = o + k * 3;
        const c = a + 3;
        // left quad (a0,a1,c1,c0) and right quad (a1,a2,c2,c1)
        idx.push(a, a + 1, c + 1, a, c + 1, c, a + 1, a + 2, c + 2, a + 1, c + 2, c + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 8;
    this.mesh.name = 'fx:lightning';
    scene.add(this.mesh);

    this.bolts = Array.from({ length: this.n }, () => ({
      active: false, a: new THREE.Vector3(), b: new THREE.Vector3(), t: 0, life: 0.1, width: 0.06, jitter: 0.25,
      color: new THREE.Color(), intensity: 3, hero: true, flicker: 0.035, ft: 0, offs: new Float32Array(this.pts * 2),
    }));
    this.next = 0;
  }

  bolt(a, b, { life = 0.12, width = 0.06, jitter = 0.22, color = '#8ff4ff', intensity = 3.2, flicker = 0.035, clock = 'hero' } = {}) {
    const bo = this.bolts[this.next];
    this.next = (this.next + 1) % this.n;
    bo.active = true;
    bo.a.copy(a);
    bo.b.copy(b);
    bo.t = 0;
    bo.life = life;
    bo.width = width;
    bo.jitter = jitter;
    bo.color.set(color);
    bo.intensity = intensity;
    bo.flicker = flicker;
    bo.ft = flicker;
    bo.hero = clock === 'hero';
    return bo;
  }

  setEnds(bo, a, b) {
    bo.a.copy(a);
    bo.b.copy(b);
  }

  clear() {
    for (const b of this.bolts) b.active = false;
    this.colors.fill(0);
    this.mesh.geometry.attributes.color.needsUpdate = true;
  }

  update(worldDt, heroDt, camera) {
    const P = this.pts;
    const pos = this.positions;
    const col = this.colors;
    for (let bi = 0; bi < this.n; bi++) {
      const bo = this.bolts[bi];
      const vo = bi * P * 3;
      if (!bo.active) {
        col.fill(0, vo * 4, (vo + P * 3) * 4);
        continue;
      }
      const dt = bo.hero ? heroDt : worldDt;
      bo.t += dt;
      if (bo.t >= bo.life) {
        bo.active = false;
        col.fill(0, vo * 4, (vo + P * 3) * 4);
        continue;
      }
      bo.ft += dt;
      if (bo.ft >= bo.flicker) {
        bo.ft = 0;
        for (let k = 0; k < P * 2; k++) bo.offs[k] = Math.random() * 2 - 1;
      }
      _dir.subVectors(bo.b, bo.a);
      const len = _dir.length() || 1e-4;
      _dir.multiplyScalar(1 / len);
      // Two perpendicular jag axes.
      _view.subVectors(camera.position, bo.a).normalize();
      _side.crossVectors(_dir, _view).normalize();
      const up = _view.crossVectors(_side, _dir).normalize();
      const fade = 1 - bo.t / bo.life;
      _c.copy(bo.color).multiplyScalar(bo.intensity * (0.6 + 0.4 * fade));
      for (let k = 0; k < P; k++) {
        const u = k / (P - 1);
        const env = Math.sin(Math.PI * u);
        const j = bo.jitter * Math.min(1, len * 0.6) * env;
        _p.copy(bo.a).addScaledVector(_dir, len * u).addScaledVector(_side, bo.offs[k * 2] * j).addScaledVector(up, bo.offs[k * 2 + 1] * j * 0.6);
        const w = bo.width * (0.55 + 0.45 * env) * (0.7 + 0.3 * fade);
        const o = (vo + k * 3) * 3;
        pos[o] = _p.x - _side.x * w; pos[o + 1] = _p.y - _side.y * w; pos[o + 2] = _p.z - _side.z * w;
        pos[o + 3] = _p.x; pos[o + 4] = _p.y; pos[o + 5] = _p.z;
        pos[o + 6] = _p.x + _side.x * w; pos[o + 7] = _p.y + _side.y * w; pos[o + 8] = _p.z + _side.z * w;
        const c = (vo + k * 3) * 4;
        col[c] = 0; col[c + 1] = 0; col[c + 2] = 0; col[c + 3] = 0; // edges fade to nothing
        col[c + 4] = (_c.r * 0.8 + 0.5) * fade; col[c + 5] = (_c.g * 0.8 + 0.5) * fade; col[c + 6] = (_c.b * 0.8 + 0.5) * fade; col[c + 7] = fade;
        col[c + 8] = 0; col[c + 9] = 0; col[c + 10] = 0; col[c + 11] = 0;
      }
    }
    // Edge vertices carry a dim colored glow (so the strip has a soft colored halo, hot core).
    for (let bi = 0; bi < this.n; bi++) {
      const bo = this.bolts[bi];
      if (!bo.active) continue;
      const vo = bi * P * 3;
      const fade = 1 - bo.t / bo.life;
      for (let k = 0; k < P; k++) {
        const c = (vo + k * 3) * 4;
        col[c] = col[c + 8] = bo.color.r * bo.intensity * 0.35 * fade;
        col[c + 1] = col[c + 9] = bo.color.g * bo.intensity * 0.35 * fade;
        col[c + 2] = col[c + 10] = bo.color.b * bo.intensity * 0.35 * fade;
      }
    }
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
  }
}
