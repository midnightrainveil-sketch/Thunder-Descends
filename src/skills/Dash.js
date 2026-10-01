import * as THREE from 'three';
import { CONFIG } from '../config.js';

const _v = new THREE.Vector3();
const _back = new THREE.Vector3();

/**
 * Dash (Shift). A quick burst in the WASD direction (or the facing when standing still) that is
 * immune to damage and knockback for the whole dash plus a short grace, leaving cyan afterimages
 * along the path. 2 stacks; one refills every 3 s (hero clock). Cancels a basic attack at any point;
 * not usable during a skill cast (Q aim included), while stunned or dead, and skills can't be cast
 * mid-dash. A Shift press is buffered briefly (hitstop, a frame where it can't start). Hero clock.
 */
export class Dash {
  constructor(hero) {
    this.hero = hero;
    this.dir = new THREE.Vector3(0, 0, -1);
    this.reset();
  }

  get cfg() {
    return CONFIG.hero.dash;
  }

  reset() {
    if (this.active) this._end(false);
    this.charges = this.cfg.charges;
    this.rechargeT = 0;
    this.active = false;
    this.t = 0;
    this.requestT = 0;
    this.afterT = 0;
  }

  // Death / interruption: stop now, no carry-over.
  cancel() {
    if (this.active) this._end(false);
  }

  // Debug C: all stacks back.
  refill() {
    this.charges = this.cfg.charges;
    this.rechargeT = 0;
  }

  // 0..1 progress of the stack currently refilling (0 when full).
  get recharge01() {
    return this.charges >= this.cfg.charges ? 0 : Math.min(1, this.rechargeT / this.cfg.recharge);
  }

  // Real time (runs through hitstop and slow-mo): remember the press for `buffer` seconds.
  handleInput(input, time) {
    this.requestT = Math.max(0, this.requestT - time.realDt);
    if (input.wasPressed('ShiftLeft') || input.wasPressed('ShiftRight')) this.requestT = this.cfg.buffer;
  }

  canStart() {
    const h = this.hero;
    return !this.active && this.charges >= 1 && !h.dead && h.stunT <= 0 && !h.skills?.active && !h.control.lockMove;
  }

  /**
   * Hero clock, before the hero's movement. `inputDir` is the camera-relative WASD direction
   * (zero when no key is held). While active, the dash owns the hero's velocity.
   */
  update(dt, inputDir) {
    const D = this.cfg;
    if (this.charges < D.charges) {
      this.rechargeT += dt;
      if (this.rechargeT >= D.recharge) {
        this.charges++;
        this.rechargeT = this.charges < D.charges ? this.rechargeT - D.recharge : 0;
      }
    }
    if (this.requestT > 0 && this.canStart()) {
      this.requestT = 0;
      this._start(inputDir);
    }
    if (!this.active) return;

    const h = this.hero;
    this.t += dt;
    const k = Math.min(1, this.t / D.duration);
    // Fast start, eased end: v = D/T·(1.6 − 1.2k) integrates to exactly `distance`.
    h.velocity.copy(this.dir).multiplyScalar((D.distance / D.duration) * (1.6 - 1.2 * k));
    this.afterT -= dt;
    if (this.afterT <= 0) {
      this.afterT += D.afterimageEvery;
      h.ctx?.fx.afterimages.spawn(h, { life: D.afterimageLife, opacity: D.afterimageOpacity });
    }
    if (this.t >= D.duration) this._end(true);
  }

  _start(inputDir) {
    const D = this.cfg;
    const h = this.hero;
    if (inputDir.lengthSq() > 1e-6) this.dir.copy(inputDir).setY(0).normalize();
    else this.dir.set(Math.sin(h.aimYaw), 0, Math.cos(h.aimYaw));
    if (this.charges >= D.charges) this.rechargeT = 0;
    this.charges--;
    this.active = true;
    this.t = 0;
    this.afterT = 0;

    h.interruptAttack();
    h.trail.stop();
    h.upper.fadeOut(0.06);
    Object.assign(h.control, { lockMove: true, lockAim: true, lockAttack: true, baseOwned: true, invulnerable: true, noKnockback: true });
    h.aimYaw = h.legYaw = Math.atan2(this.dir.x, this.dir.z);
    h.group.rotation.y = h.legYaw;
    h.base.play('dash', { fade: 0.04 });

    const g = h.ctx;
    if (!g) return;
    const p = h.position;
    g.fx.shock.ring(p, { r0: 0.2, r1: D.ringRadius, duration: 0.22, color: '#8ff4ff', intensity: 2.2, thickness: 0.1, clock: 'hero' });
    g.fx.particles.dust(p, 8, { speed: 3, clock: 'hero' });
    g.fx.particles.sparks(_v.set(p.x, 0.6, p.z), _back.copy(this.dir).negate(), 8, { speed: 6, life: 0.2, clock: 'hero' });
    g.map.petalImpulse(p, 2.5, 6);
  }

  _end(carry) {
    const D = this.cfg;
    const h = this.hero;
    this.active = false;
    Object.assign(h.control, { lockMove: false, lockAim: false, lockAttack: false, baseOwned: false, invulnerable: false, noKnockback: false });
    if (carry) {
      h.iFrames = Math.max(h.iFrames, D.graceIFrames);
      h.velocity.copy(this.dir).multiplyScalar(CONFIG.hero.moveSpeed * D.exitSpeed);
    }
  }
}
