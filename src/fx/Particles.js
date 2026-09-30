import * as THREE from 'three';
import { CONFIG } from '../config.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _d = new THREE.Vector3();
const _z = new THREE.Vector3(0, 0, 1);
const _c = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Pooled cube particles in one InstancedMesh. `glow` pools are additive HDR (sparks, embers,
 * hit stars); solid pools are lit cubes (dust, debris). Each particle picks its clock
 * ('world' default, or 'hero') so hero FX keep moving when the world is frozen.
 */
class CubePool {
  constructor(size, glow) {
    this.size = size;
    this.glow = glow;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = glow
      ? new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
      : new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9, metalness: 0.1 });
    this.mesh = new THREE.InstancedMesh(geo, mat, size);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(size * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.name = glow ? 'fx:glowCubes' : 'fx:solidCubes';
    this.mesh.renderOrder = glow ? 6 : 0;
    this.mesh.castShadow = !glow;
    const f = () => new Float32Array(size);
    this.px = f(); this.py = f(); this.pz = f();
    this.vx = f(); this.vy = f(); this.vz = f();
    this.life = f(); this.max = f(); this.sz = f(); this.stretch = f();
    this.grav = f(); this.drag = f(); this.spin = f(); this.ang = f();
    this.r = f(); this.g = f(); this.b = f();
    this.hero = new Uint8Array(size);
    this.bounce = f();
    this.alive = new Uint8Array(size);
    this.next = 0;
    for (let i = 0; i < size; i++) this.mesh.setMatrixAt(i, ZERO);
    this.live = 0;
  }

  _slot() {
    // Round-robin: the oldest particle is recycled when the pool is full.
    for (let k = 0; k < this.size; k++) {
      const i = (this.next + k) % this.size;
      if (!this.alive[i]) {
        this.next = (i + 1) % this.size;
        return i;
      }
    }
    const i = this.next;
    this.next = (i + 1) % this.size;
    return i;
  }

  emit(o) {
    const i = this._slot();
    if (!this.alive[i]) this.live++;
    this.alive[i] = 1;
    this.px[i] = o.x; this.py[i] = o.y; this.pz[i] = o.z;
    this.vx[i] = o.vx || 0; this.vy[i] = o.vy || 0; this.vz[i] = o.vz || 0;
    this.life[i] = 0;
    this.max[i] = o.life ?? 0.4;
    this.sz[i] = o.size ?? 0.06;
    this.stretch[i] = o.stretch ?? 1;
    this.grav[i] = o.gravity ?? 1;
    this.drag[i] = o.drag ?? 0;
    this.spin[i] = o.spin ?? 0;
    this.ang[i] = Math.random() * 6.28;
    this.bounce[i] = o.bounce ?? 0;
    this.hero[i] = o.clock === 'hero' ? 1 : 0;
    _c.set(o.color ?? '#ffffff').multiplyScalar(o.intensity ?? 1);
    this.r[i] = _c.r; this.g[i] = _c.g; this.b[i] = _c.b;
    return i;
  }

  clear() {
    this.alive.fill(0);
    this.live = 0;
    for (let i = 0; i < this.size; i++) this.mesh.setMatrixAt(i, ZERO);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(worldDt, heroDt) {
    if (this.live === 0) return;
    const G = CONFIG.fx.particles.gravity;
    const col = this.mesh.instanceColor.array;
    for (let i = 0; i < this.size; i++) {
      if (!this.alive[i]) continue;
      const dt = this.hero[i] ? heroDt : worldDt;
      if (dt > 0) {
        this.life[i] += dt;
        if (this.life[i] >= this.max[i]) {
          this.alive[i] = 0;
          this.live--;
          this.mesh.setMatrixAt(i, ZERO);
          continue;
        }
        const dr = Math.exp(-this.drag[i] * dt);
        this.vx[i] *= dr; this.vz[i] *= dr;
        this.vy[i] = this.vy[i] * dr - G * this.grav[i] * dt;
        this.px[i] += this.vx[i] * dt;
        this.py[i] += this.vy[i] * dt;
        this.pz[i] += this.vz[i] * dt;
        if (this.py[i] < this.sz[i] * 0.5) {
          this.py[i] = this.sz[i] * 0.5;
          if (this.bounce[i] > 0 && this.vy[i] < -0.5) {
            this.vy[i] = -this.vy[i] * this.bounce[i];
            this.vx[i] *= 0.6; this.vz[i] *= 0.6;
          } else {
            this.vy[i] = 0;
            this.vx[i] *= 0.8; this.vz[i] *= 0.8;
          }
        }
        this.ang[i] += this.spin[i] * dt;
      }
      const k = 1 - this.life[i] / this.max[i];
      const size = this.sz[i] * (this.glow ? Math.sqrt(k) : Math.min(1, k * 3));
      if (this.stretch[i] > 1) {
        // Streaks: long axis along the velocity.
        _d.set(this.vx[i], this.vy[i], this.vz[i]);
        const sp = _d.length();
        if (sp > 1e-4) _q.setFromUnitVectors(_z, _d.multiplyScalar(1 / sp));
        _s.set(size, size, size * this.stretch[i] * Math.min(1, 0.3 + sp * 0.08));
      } else {
        _q.setFromAxisAngle(_d.set(0.577, 0.577, 0.577), this.ang[i]);
        _s.setScalar(size);
      }
      _m.compose(_p.set(this.px[i], this.py[i], this.pz[i]), _q, _s);
      this.mesh.setMatrixAt(i, _m);
      const fade = this.glow ? k : 1;
      col[i * 3] = this.r[i] * fade; col[i * 3 + 1] = this.g[i] * fade; col[i * 3 + 2] = this.b[i] * fade;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}

const rnd = (a, b) => a + Math.random() * (b - a);

// Emitters built on the two pools.
export class Particles {
  constructor(scene) {
    const P = CONFIG.fx.particles;
    this.glow = new CubePool(P.glow, true);
    this.solid = new CubePool(P.solid, false);
    scene.add(this.glow.mesh, this.solid.mesh);
  }

  update(worldDt, heroDt) {
    this.glow.update(worldDt, heroDt);
    this.solid.update(worldDt, heroDt);
  }

  clear() {
    this.glow.clear();
    this.solid.clear();
  }

  // Bright streak sparks, biased along `dir` (unit, may be null).
  sparks(pos, dir, count, { color = CONFIG.fx.sparkColor, intensity = 3, speed = 9, spread = 0.9, life = 0.28, size = 0.05, clock } = {}) {
    for (let n = 0; n < count; n++) {
      _d.set(rnd(-1, 1), rnd(-0.2, 1), rnd(-1, 1)).normalize();
      if (dir) _d.multiplyScalar(spread).add(dir).normalize();
      const sp = speed * rnd(0.45, 1.1);
      this.glow.emit({ x: pos.x, y: pos.y, z: pos.z, vx: _d.x * sp, vy: _d.y * sp, vz: _d.z * sp, life: life * rnd(0.6, 1.2), size: size * rnd(0.7, 1.3), stretch: 6, gravity: 0.6, drag: 5, color, intensity: intensity * rnd(0.7, 1.2), clock });
    }
  }

  // Hit star: a burst of long streaks radiating from the hit point, plus a bright core cube.
  hitStar(pos, { color = '#ffffff', intensity = 5, rays = 8, speed = 16, size = 0.07, life = 0.14, clock } = {}) {
    for (let n = 0; n < rays; n++) {
      const a = (n / rays) * Math.PI * 2 + rnd(-0.2, 0.2);
      const up = rnd(-0.35, 0.8);
      _d.set(Math.cos(a), up, Math.sin(a)).normalize();
      const sp = speed * rnd(0.8, 1.2);
      this.glow.emit({ x: pos.x, y: pos.y, z: pos.z, vx: _d.x * sp, vy: _d.y * sp, vz: _d.z * sp, life, size, stretch: 9, gravity: 0, drag: 14, color, intensity, clock });
    }
    this.glow.emit({ x: pos.x, y: pos.y, z: pos.z, life: life * 0.8, size: size * 4, gravity: 0, color, intensity: intensity * 0.8, spin: 20, clock });
  }

  // Soft floor dust puffs (lit cubes).
  dust(pos, count, { color = '#6b6f80', speed = 2.2, size = 0.14, life = 0.7, clock } = {}) {
    for (let n = 0; n < count; n++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * rnd(0.4, 1);
      this.solid.emit({ x: pos.x + Math.cos(a) * 0.2, y: 0.08, z: pos.z + Math.sin(a) * 0.2, vx: Math.cos(a) * sp, vy: rnd(0.5, 1.8), vz: Math.sin(a) * sp, life: life * rnd(0.7, 1.2), size: size * rnd(0.6, 1.2), gravity: 0.15, drag: 3.5, spin: rnd(-4, 4), color, clock });
    }
  }

  // Chunky debris that bounces on the floor.
  debris(pos, count, { color = '#2a2a30', speed = 4, size = 0.09, life = 1.1, clock } = {}) {
    for (let n = 0; n < count; n++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * rnd(0.3, 1);
      this.solid.emit({ x: pos.x, y: pos.y, z: pos.z, vx: Math.cos(a) * sp, vy: rnd(2, 5), vz: Math.sin(a) * sp, life: life * rnd(0.7, 1.2), size: size * rnd(0.7, 1.4), gravity: 1, drag: 0.5, bounce: 0.4, spin: rnd(-10, 10), color, clock });
    }
  }

  // Embers: slow glowing cubes drifting upward.
  embers(pos, count, { color = CONFIG.fx.emberColor, intensity = 2.5, radius = 0.4, life = 0.9, clock } = {}) {
    for (let n = 0; n < count; n++) {
      this.glow.emit({ x: pos.x + rnd(-radius, radius), y: pos.y + rnd(-0.2, 0.3), z: pos.z + rnd(-radius, radius), vx: rnd(-0.6, 0.6), vy: rnd(0.8, 2.4), vz: rnd(-0.6, 0.6), life: life * rnd(0.6, 1.3), size: rnd(0.03, 0.06), gravity: -0.05, drag: 1.5, spin: rnd(-6, 6), color, intensity, clock });
    }
  }
}
