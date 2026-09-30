import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Tiny warm sparks rising from the lanterns (world clock). One pooled InstancedMesh.
export class Embers {
  constructor(sources) {
    const E = CONFIG.map.embers;
    this.sources = sources; // [{ position: Vector3 (fire box center) }]
    this.count = sources.length * E.perLantern;
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, fog: false });
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, this.count);
    this.mesh.name = 'embers';
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color());
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);

    const n = this.count;
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.pz = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.age = new Float32Array(n);
    this.life = new Float32Array(n);
    this.phase = new Float32Array(n);
    this.src = new Uint16Array(n);
    this.base = new THREE.Color(E.color).multiplyScalar(E.intensity);
    for (let i = 0; i < n; i++) {
      this.src[i] = i % sources.length;
      this._respawn(i);
      this.age[i] = Math.random() * this.life[i]; // desynchronize
    }
    // Write every instance now: InstancedMesh starts with identity matrices (1 m white cubes at the
    // origin) and update() skips frames where the world clock is stopped.
    this._writeAll(0);
  }

  _writeAll(worldTime) {
    const E = CONFIG.map.embers;
    const m = this.mesh.instanceMatrix.array;
    const c = this.mesh.instanceColor.array;
    for (let i = 0; i < this.count; i++) {
      const k = this.age[i] / this.life[i];
      const s = E.size * (1 - k * 0.7);
      const o = i * 16;
      m[o] = s; m[o + 1] = 0; m[o + 2] = 0; m[o + 3] = 0;
      m[o + 4] = 0; m[o + 5] = s; m[o + 6] = 0; m[o + 7] = 0;
      m[o + 8] = 0; m[o + 9] = 0; m[o + 10] = s; m[o + 11] = 0;
      m[o + 12] = this.px[i]; m[o + 13] = this.py[i]; m[o + 14] = this.pz[i]; m[o + 15] = 1;
      const f = Math.sin(Math.PI * Math.min(1, k * 1.2)) * (0.75 + 0.25 * Math.sin(worldTime * 17 + this.phase[i]));
      c[i * 3] = this.base.r * f;
      c[i * 3 + 1] = this.base.g * f;
      c[i * 3 + 2] = this.base.b * f;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  _respawn(i) {
    const E = CONFIG.map.embers;
    const s = this.sources[this.src[i]].position;
    this.px[i] = s.x + (Math.random() - 0.5) * 0.3;
    this.py[i] = s.y + Math.random() * 0.2;
    this.pz[i] = s.z + (Math.random() - 0.5) * 0.3;
    this.vy[i] = E.rise[0] + Math.random() * (E.rise[1] - E.rise[0]);
    this.life[i] = E.life[0] + Math.random() * (E.life[1] - E.life[0]);
    this.phase[i] = Math.random() * 6.283;
    this.age[i] = 0;
  }

  update(dt, worldTime, windVel) {
    if (dt <= 0) return;
    const E = CONFIG.map.embers;
    for (let i = 0; i < this.count; i++) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) this._respawn(i);
      const w = Math.sin(worldTime * 3.1 + this.phase[i]) * E.wobble;
      this.px[i] += (windVel.x * 0.35 + w) * dt;
      this.pz[i] += (windVel.z * 0.35 + Math.cos(worldTime * 2.3 + this.phase[i]) * E.wobble) * dt;
      this.py[i] += this.vy[i] * dt;
    }
    this._writeAll(worldTime);
  }
}
