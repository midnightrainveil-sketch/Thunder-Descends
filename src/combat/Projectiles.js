import * as THREE from 'three';
import { CONFIG, ARENA_RADIUS } from '../config.js';
import { hitCircle } from './Hitbox.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _y = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const POOL = 24;

// Teppo bolts: glowing orange slugs flying level at 9 m/s (world clock), 2D circle hit vs the hero,
// ember trail, gone at the arena edge. One instanced mesh.
export class Projectiles {
  constructor(scene, fx) {
    this.fx = fx;
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.14, 0.14, 0.55),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(CONFIG.fx.emberColor).multiplyScalar(3.2), toneMapped: false }),
      POOL,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'fx:bolts';
    scene.add(this.mesh);
    this.b = Array.from({ length: POOL }, () => ({ alive: false, p: new THREE.Vector3(), yaw: 0, t: 0, damage: 0, owner: null, radius: 0.18, position: new THREE.Vector3() }));
    for (let i = 0; i < POOL; i++) this.mesh.setMatrixAt(i, ZERO);
    this.next = 0;
    this.onHitHero = null; // (bolt) => void
  }

  fire(pos, yaw, damage, owner) {
    const C = CONFIG.enemies.teppo;
    const b = this.b[this.next];
    this.next = (this.next + 1) % POOL;
    Object.assign(b, { alive: true, yaw, t: 0, damage, owner, radius: C.boltRadius });
    b.p.copy(pos);
  }

  update(dt, hero) {
    if (dt <= 0) return;
    const C = CONFIG.enemies.teppo;
    let any = false;
    for (let i = 0; i < POOL; i++) {
      const b = this.b[i];
      if (!b.alive) continue;
      any = true;
      b.t += dt;
      const vx = Math.sin(b.yaw) * C.boltSpeed;
      const vz = Math.cos(b.yaw) * C.boltSpeed;
      b.p.x += vx * dt;
      b.p.z += vz * dt;
      b.position.copy(b.p);
      if (Math.random() < 0.6) this.fx.particles.embers(b.p, 1, { radius: 0.05, life: 0.35 });
      let dead = b.t > C.boltLife || Math.hypot(b.p.x, b.p.z) > ARENA_RADIUS + 1.5;
      if (!dead && !hero.dead && hitCircle(b.p.x, b.p.z, b.radius, hero)) {
        this.onHitHero?.(b);
        dead = true;
      }
      if (dead) {
        b.alive = false;
        this.fx.particles.sparks(b.p, null, 6, { color: CONFIG.fx.emberColor, speed: 4, life: 0.2 });
        this.mesh.setMatrixAt(i, ZERO);
        continue;
      }
      const pulse = 1 + 0.2 * Math.sin(b.t * 40);
      _m.compose(b.p, _q.setFromAxisAngle(_y, b.yaw), _s.set(pulse, pulse, 1));
      this.mesh.setMatrixAt(i, _m);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    for (let i = 0; i < POOL; i++) {
      this.b[i].alive = false;
      this.mesh.setMatrixAt(i, ZERO);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
