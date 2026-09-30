import * as THREE from 'three';
import { CONFIG } from '../config.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _axis = new THREE.Vector3(0.3, 1, 0.2).normalize();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * EXP shards: small glowing cyan cubes that pop out of a dead enemy, bounce, then home in on the
 * hero (always after a short delay; immediately inside magnetRange) and are collected on contact.
 * World clock for the pop, but they keep flying on the hero clock so they reach him in Demontime.
 */
export class ExpShards {
  constructor(scene) {
    const X = CONFIG.fx.exp;
    this.max = X.pool;
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(X.color).multiplyScalar(2.2), toneMapped: false }),
      this.max,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'fx:exp';
    scene.add(this.mesh);
    this.s = Array.from({ length: this.max }, () => ({ alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), t: 0, value: 0, ang: 0 }));
    for (let i = 0; i < this.max; i++) this.mesh.setMatrixAt(i, ZERO);
    this.next = 0;
    this.live = 0;
    this.onCollect = null; // (value) => void
  }

  // Spread `total` EXP over a few shards at pos.
  drop(pos, total) {
    const X = CONFIG.fx.exp;
    const n = THREE.MathUtils.clamp(Math.ceil(total / X.value), 2, 10);
    for (let k = 0; k < n; k++) {
      const s = this.s[this.next];
      this.next = (this.next + 1) % this.max;
      if (s.alive) this.onCollect?.(s.value); // recycled: give its EXP rather than lose it
      else this.live++;
      const a = Math.random() * Math.PI * 2;
      const sp = X.pop * (0.4 + Math.random() * 0.6);
      s.alive = true;
      s.p.set(pos.x, 0.9, pos.z);
      s.v.set(Math.cos(a) * sp, 3 + Math.random() * 2.5, Math.sin(a) * sp);
      s.t = 0;
      s.value = total / n;
      s.ang = Math.random() * 6;
    }
  }

  update(dt, hero) {
    if (this.live === 0 || dt <= 0) return;
    const X = CONFIG.fx.exp;
    const G = CONFIG.fx.particles.gravity;
    const target = _p.set(hero.position.x, 1.1, hero.position.z);
    for (let i = 0; i < this.max; i++) {
      const s = this.s[i];
      if (!s.alive) continue;
      s.t += dt;
      s.ang += dt * 6;
      const dx = target.x - s.p.x;
      const dy = target.y - s.p.y;
      const dz = target.z - s.p.z;
      const d = Math.hypot(dx, dy, dz);
      const homing = !hero.dead && (s.t > X.delay || Math.hypot(dx, dz) < X.magnetRange);
      if (homing) {
        // Accelerate toward the hero; steer so it curves in instead of orbiting.
        const acc = X.accel * (1 + s.t);
        s.v.x += (dx / d) * acc * dt;
        s.v.y += (dy / d) * acc * dt;
        s.v.z += (dz / d) * acc * dt;
        const sp = s.v.length();
        const maxSp = X.maxSpeed * (d < X.magnetRange ? 1.3 : 1);
        if (sp > maxSp) s.v.multiplyScalar(maxSp / sp);
        s.v.lerp(_s.set(dx, dy, dz).multiplyScalar(maxSp / d), Math.min(1, dt * 4));
      } else {
        s.v.y -= G * dt;
        s.v.x *= Math.exp(-1.5 * dt);
        s.v.z *= Math.exp(-1.5 * dt);
      }
      s.p.addScaledVector(s.v, dt);
      if (!homing && s.p.y < X.size) {
        s.p.y = X.size;
        s.v.y = Math.abs(s.v.y) * 0.35;
      }
      if (homing && d < X.pickup) {
        s.alive = false;
        this.live--;
        this.mesh.setMatrixAt(i, ZERO);
        this.onCollect?.(s.value);
        continue;
      }
      const pulse = 1 + 0.15 * Math.sin(s.t * 18);
      _m.compose(s.p, _q.setFromAxisAngle(_axis, s.ang), _s.setScalar(X.size * pulse));
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    for (let i = 0; i < this.max; i++) {
      this.s[i].alive = false;
      this.mesh.setMatrixAt(i, ZERO);
    }
    this.live = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
