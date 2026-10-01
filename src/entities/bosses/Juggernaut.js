import * as THREE from 'three';
import { CONFIG, ARENA_RADIUS } from '../../config.js';
import { Boss } from './Boss.js';
import { hitCircle } from '../../combat/Hitbox.js';

const _v = new THREE.Vector3();

/**
 * Wave 1 — Oni Juggernaut. Attacks:
 *  slam   three circles in sequence toward the hero (club overhead → slam, ×3)
 *  charge red lane to the rim, then a charge; crashes into the balustrade and is stunned 1.2 s
 *  stomp  a ring around itself
 * Enrage (< 50%): ×1.3 speed, the furnace chest glows.
 */
export class Juggernaut extends Boss {
  constructor(position, ctx, opts) {
    super('juggernaut', position, ctx, opts);
  }

  startAttack(name, hero) {
    const C = this.bcfg;
    const s = this.speedMul;
    this.faceTo(hero.position.x, hero.position.z, 0);
    this.group.rotation.y = this.yaw;
    const dx = Math.sin(this.yaw);
    const dz = Math.cos(this.yaw);
    const a = (this.attack = { name, t: 0, i: 0, hit: false, dx, dz });
    this.tell = 1;
    if (name === 'slam') {
      const S = C.slam;
      a.centers = S.spacing.map((d) => new THREE.Vector3(this.position.x + dx * d, 0, this.position.z + dz * d));
      a.times = S.spacing.map((_, k) => (S.first + k * S.next) / s);
      a.centers.forEach((c, k) => this.decal('circle', { x: c.x, z: c.z, radius: S.radius, duration: a.times[k] }));
      this.base.play('slamUp', { fade: 0.1, speed: 1 });
    } else if (name === 'charge') {
      const H = C.charge;
      // Lane from here to the rim along the facing.
      const px = this.position.x;
      const pz = this.position.z;
      const b = px * dx + pz * dz;
      const c = px * px + pz * pz - (ARENA_RADIUS - this.radius) ** 2;
      const len = Math.max(2, -b + Math.sqrt(Math.max(0, b * b - c)));
      a.len = len;
      a.phase = 'windup';
      this.decal('rect', { x: px, z: pz, yaw: this.yaw, length: len, width: H.width, duration: H.telegraph / s });
      this.base.play('chargeWindup', { fade: 0.1 });
    } else if (name === 'stomp') {
      const T = C.stomp;
      this.decal('circle', { x: this.position.x, z: this.position.z, radius: T.radius, duration: T.telegraph / s });
      this.base.play('stompUp', { fade: 0.1 });
    }
  }

  updateAttack(dt) {
    const C = this.bcfg;
    const a = this.attack;
    const hero = this.ctx.hero;
    const s = this.speedMul;
    a.t += dt;
    if (a.name === 'slam') {
      const S = C.slam;
      while (a.i < 3 && a.t >= a.times[a.i]) {
        const c = a.centers[a.i];
        this.base.play('slamDown', { fade: 0.03 });
        if (hitCircle(c.x, c.z, S.radius, hero)) this.hitHero(S.damage, 6, c);
        this.ctx.combat.slamImpact(c, S.radius);
        this.tell = 1;
        a.i++;
        a.nextUp = a.t + 0.18 / s;
      }
      if (a.nextUp && a.t >= a.nextUp && a.i < 3) {
        a.nextUp = 0;
        this.base.play('slamUp', { fade: 0.05, speed: 1.6 });
      }
      return a.t >= a.times[2] + 0.6 / s;
    }
    if (a.name === 'charge') {
      const H = C.charge;
      if (a.phase === 'windup') {
        if (a.t >= H.telegraph / s) {
          a.phase = 'run';
          a.t = 0;
          this.base.play('charge', { fade: 0.08 });
        }
        return false;
      }
      const sp = H.speed * s;
      this.position.x += a.dx * sp * dt;
      this.position.z += a.dz * sp * dt;
      if (Math.random() < 0.6) this.ctx.fx.particles.dust(this.position, 1, { speed: 2 });
      if (!a.hit && hitCircle(this.position.x, this.position.z, this.radius + 0.2, hero)) {
        a.hit = true;
        this.hitHero(H.damage, H.knockback);
      }
      const r = Math.hypot(this.position.x, this.position.z);
      if (r >= ARENA_RADIUS - this.radius - 0.05 || a.t > 3) {
        // Crash into the balustrade.
        const k = (ARENA_RADIUS - this.radius - 0.05) / Math.max(r, 1e-3);
        if (k < 1) this.position.multiplyScalar(k);
        const g = this.ctx;
        _v.set(this.position.x + a.dx * this.radius, 1.2, this.position.z + a.dz * this.radius);
        g.fx.particles.debris(_v, 18, { color: '#3a3b42', speed: 6 });
        g.fx.particles.sparks(_v, null, 20, { color: CONFIG.fx.emberColor, speed: 9 });
        g.fx.shock.ring(this.position, { r0: 0.5, r1: 3, duration: 0.35, color: '#ffffff', intensity: 1.8 });
        g.rig.shake(0.6, 0.45);
        g.map.petalImpulse(this.position, 5, 10);
        this.attack = null;
        this.decalList.length = 0;
        this.stun(H.stun);
        return false; // state is now 'stunned'
      }
      return false;
    }
    if (a.name === 'stomp') {
      const T = C.stomp;
      if (!a.hit && a.t >= T.telegraph / s) {
        a.hit = true;
        this.base.play('stompDown', { fade: 0.03 });
        if (hitCircle(this.position.x, this.position.z, T.radius, hero)) this.hitHero(T.damage, 8);
        const g = this.ctx;
        g.fx.shock.ring(this.position, { r0: 0.8, r1: T.radius * 1.1, duration: 0.4, color: CONFIG.fx.emberColor, intensity: 2.8, thickness: 0.22 });
        g.fx.shock.ring(this.position, { r0: 0.4, r1: T.radius * 0.7, duration: 0.3, color: '#ffffff', intensity: 1.4 });
        g.fx.particles.dust(this.position, 24, { speed: 6, size: 0.2 });
        g.rig.shake(0.5, 0.35);
        g.map.petalImpulse(this.position, T.radius + 2, 10);
      }
      return a.t >= T.telegraph / s + 0.6 / s;
    }
    return true;
  }

  bodyPoint(out) {
    return out.set(this.position.x + (Math.random() - 0.5) * 2.4, 1 + Math.random() * 4, this.position.z + (Math.random() - 0.5) * 2.4);
  }
}
