import * as THREE from 'three';
import { CONFIG } from '../config.js';

const _m = new THREE.Matrix4();
const _rot = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _dq = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _a = new THREE.Vector3();
const _c = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Death shatter: a rig's voxel boxes become physical cubes (one instanced mesh, max ~100,
 * oldest recycled) that burst outward, tumble, bounce on the floor and shrink away. Emissive
 * boxes (eyes, seams) become glowing embers through the particle system. World clock.
 */
export class Shatter {
  constructor(scene, particles) {
    const S = CONFIG.fx.shatter;
    this.max = S.max;
    this.particles = particles;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.85, metalness: 0.15 }), this.max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 3), 3);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'fx:shatter';
    scene.add(this.mesh);
    this.chunks = Array.from({ length: this.max }, (_, i) => ({
      i, alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), axis: new THREE.Vector3(1, 0, 0), spin: 0, size: new THREE.Vector3(), t: 0, life: 1, rest: false,
    }));
    for (let i = 0; i < this.max; i++) this.mesh.setMatrixAt(i, ZERO);
    this.next = 0;
    this.live = 0;
    this._center = new THREE.Vector3();
  }

  /**
   * Burst every box of `rig` from its current pose. `palette` maps color keys, `push` is an
   * optional world direction (the killing blow) that biases the burst, `strength` scales speed.
   */
  burst(rig, palette, push = null, strength = 1) {
    const S = CONFIG.fx.shatter;
    const vs = rig.voxelSize;
    rig.group.updateMatrixWorld(true);
    rig.root.getWorldPosition(this._center);
    this._center.y += 1.0;
    const inv = rig.skeleton.boneInverses;
    for (const name in rig.parts) {
      const part = rig.parts[name];
      const bi = rig.index[part.joint];
      const bone = rig.bones[part.joint];
      // Bones hidden via setBoneVisible have ~0 scale: skip their boxes.
      const e = bone.matrixWorld.elements;
      if (e[0] ** 2 + e[1] ** 2 + e[2] ** 2 < 1e-4) continue;
      _m.multiplyMatrices(bone.matrixWorld, inv[bi]);
      _q.setFromRotationMatrix(_rot.extractRotation(bone.matrixWorld));
      for (const b of part.boxes) {
        const o = part.origin;
        _p.set((b.p[0] + b.s[0] / 2 + o[0]) * vs, (b.p[1] + b.s[1] / 2 + o[1]) * vs, (b.p[2] + b.s[2] / 2 + o[2]) * vs).applyMatrix4(_m);
        if (b.e) {
          this.particles.embers(_p, 2, { color: palette[b.c], intensity: b.e * 1.2, radius: 0.05, life: 1.2 });
          continue;
        }
        const c = this._take();
        c.alive = true;
        c.rest = false;
        c.t = 0;
        c.life = S.life * (0.75 + Math.random() * 0.5);
        c.p.copy(_p);
        c.q.copy(_q);
        c.size.set(b.s[0] * vs, b.s[1] * vs, b.s[2] * vs).multiplyScalar(0.95);
        _a.subVectors(_p, this._center);
        _a.y = Math.max(_a.y, 0) + 0.3;
        _a.normalize();
        const sp = S.speed * strength * (0.4 + Math.random() * 0.8);
        c.v.copy(_a).multiplyScalar(sp);
        c.v.y += S.up * (0.4 + Math.random() * 0.8) * strength;
        if (push) c.v.addScaledVector(push, S.speed * 0.6 * strength * Math.random());
        c.axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        c.spin = S.spin * (0.3 + Math.random());
        _c.set(palette[b.c] ?? '#555555');
        this.mesh.setColorAt(c.i, _c);
      }
    }
    this.mesh.instanceColor.needsUpdate = true;
  }

  _take() {
    for (let k = 0; k < this.max; k++) {
      const i = (this.next + k) % this.max;
      if (!this.chunks[i].alive) {
        this.next = (i + 1) % this.max;
        this.live++;
        return this.chunks[i];
      }
    }
    const c = this.chunks[this.next];
    this.next = (this.next + 1) % this.max;
    return c;
  }

  update(dt) {
    if (this.live === 0 || dt <= 0) return;
    const S = CONFIG.fx.shatter;
    const G = CONFIG.fx.particles.gravity;
    for (let i = 0; i < this.max; i++) {
      const c = this.chunks[i];
      if (!c.alive) continue;
      c.t += dt;
      if (c.t >= c.life) {
        c.alive = false;
        this.live--;
        this.mesh.setMatrixAt(i, ZERO);
        continue;
      }
      if (!c.rest) {
        c.v.y -= G * dt;
        c.p.addScaledVector(c.v, dt);
        const half = Math.min(c.size.x, c.size.y, c.size.z) * 0.5;
        if (c.p.y < half) {
          c.p.y = half;
          if (c.v.y < -1) {
            c.v.y = -c.v.y * S.bounce;
            c.v.x *= S.friction;
            c.v.z *= S.friction;
            c.spin *= 0.6;
          } else {
            c.v.set(0, 0, 0);
            c.rest = true;
          }
        }
        c.q.multiply(_dq.setFromAxisAngle(c.axis, c.spin * dt));
      }
      const k = (c.life - c.t) / S.fade;
      const shrink = Math.min(1, Math.max(0, k));
      _m.compose(c.p, c.q, _s.copy(c.size).multiplyScalar(shrink));
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    for (let i = 0; i < this.max; i++) {
      this.chunks[i].alive = false;
      this.mesh.setMatrixAt(i, ZERO);
    }
    this.live = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
