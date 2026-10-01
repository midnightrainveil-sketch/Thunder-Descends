import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clampToArena } from '../world/ArenaBounds.js';
import { audio } from '../audio/Audio.js';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _back = new THREE.Vector3();
const DEG = Math.PI / 180;
const easeOut = (u) => 1 - (1 - u) * (1 - u);

/**
 * Dash (Shift). A quick burst in the WASD direction (or the facing when standing still) that is
 * immune to damage and knockback for the whole dash plus a short grace, leaving cyan afterimages
 * along the path. 3 stacks; one refills every 3 s (hero clock). Cancels a basic attack at any point;
 * not usable during a skill cast (Q aim included), while stunned or dead, and skills can't be cast
 * mid-dash. A Shift press is buffered briefly (hitstop, a frame where it can't start). Hero clock.
 *
 * Dash strike: for `strike.window` s after a dash (a click during the dash counts too) the next
 * attack has long range. The enemy nearest the aim inside `strike.range` / `strike.coneDeg` is
 * marked on the floor; attacking snaps the hero to it (invulnerable lunge, afterimages) and lands
 * one heavy hit (2.8×ATK, can crit, splash, knockback, hitstop, big shake + zoom punch).
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
    this.charges = this.maxCharges;
    this.rechargeT = 0;
    this.active = false;
    this.t = 0;
    this.requestT = 0;
    this.afterT = 0;
    this._endStrike(false);
    this.windowT = 0;
    this.strikeReqT = 0;
  }

  // Death / interruption: stop now, no carry-over.
  cancel() {
    if (this.active) this._end(false);
    this._endStrike(false);
    this.windowT = 0;
  }

  // The dash (or its strike lunge) owns the hero's velocity.
  get owning() {
    return this.active || this.striking === 'lunge';
  }

  // Debug C: all stacks back.
  // Stacks and recharge include the Armory / card bonuses.
  get maxCharges() {
    return this.cfg.charges + (this.hero.bonus?.dashCharges || 0);
  }

  get rechargeTime() {
    return this.cfg.recharge * (this.hero.bonus?.dashRechargeMul ?? 1);
  }

  refill() {
    this.charges = this.maxCharges;
    this.rechargeT = 0;
  }

  // 0..1 progress of the stack currently refilling (0 when full).
  get recharge01() {
    return this.charges >= this.maxCharges ? 0 : Math.min(1, this.rechargeT / this.rechargeTime);
  }

  // Real time (runs through hitstop and slow-mo): remember the press for `buffer` seconds.
  handleInput(input, time) {
    this.requestT = Math.max(0, this.requestT - time.realDt);
    if (input.wasPressed('ShiftLeft') || input.wasPressed('ShiftRight')) this.requestT = this.cfg.buffer;
    this.strikeReqT = Math.max(0, this.strikeReqT - time.realDt);
    if (input.wasButtonPressed(0) && (this.active || this.windowT > 0)) this.strikeReqT = this.cfg.strike.buffer;
  }

  canStart() {
    const h = this.hero;
    return !this.active && !this.striking && this.charges >= 1 && !h.dead && h.stunT <= 0 && !h.skills?.active && !h.control.lockMove;
  }

  /**
   * Hero clock, before the hero's movement. `inputDir` is the camera-relative WASD direction
   * (zero when no key is held). While active, the dash owns the hero's velocity.
   */
  update(dt, inputDir, input) {
    const D = this.cfg;
    const max = this.maxCharges;
    const rt = this.rechargeTime;
    if (this.charges < max) {
      this.rechargeT += dt;
      if (this.rechargeT >= rt) {
        this.charges++;
        this.rechargeT = this.charges < max ? this.rechargeT - rt : 0;
      }
    }
    if (this.requestT > 0 && this.canStart()) {
      this.requestT = 0;
      this._start(inputDir);
    }
    if (this.striking) {
      this._updateStrike(dt);
      return;
    }
    if (!this.active) {
      this._strikeWindow(dt, input);
      return;
    }

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
    // Thunder Step (card): enemies the dash passes through are zapped once.
    if (h.bonus.thunderStep && h.ctx) this._thunderStep(h.ctx);
    if (this.t >= D.duration) {
      this._end(true);
      this.windowT = D.strike.window;
    }
  }

  _thunderStep(g) {
    const h = this.hero;
    for (const e of g.enemies) {
      if (e.dead || e.invulnerable || this.stepHit.has(e.owner || e)) continue;
      if (Math.hypot(e.position.x - h.position.x, e.position.z - h.position.z) > e.radius + 1.0) continue;
      this.stepHit.add(e.owner || e);
      g.fx.lightning.bolt(_v.set(h.position.x, 0.9, h.position.z), _w.set(e.position.x, 1.0, e.position.z), { life: 0.1, width: 0.07, jitter: 0.25, intensity: 3.5 });
      g.combat.heroHitsEnemy(e, { mult: CONFIG.cards.thunderStepMult, knockback: 3, unblockable: true, from: h.position, hitstop: 0, shake: 0.12, skill: 'step' });
    }
  }

  // ── Dash strike ──────────────────────────────────────────────────────────
  _strikeWindow(dt, input) {
    const S = this.cfg.strike;
    const h = this.hero;
    const fx = h.ctx?.fx;
    if (this.windowT <= 0) {
      h.strikeGlow = 0;
      return;
    }
    this.windowT -= dt;
    const target = this._findTarget(input);
    h.strikeGlow = S.glow;
    if (target) fx?.aim.showMarker(target.position, target.radius + 0.45);
    else fx?.aim.showMarker(null);
    const wants = this.strikeReqT > 0 || input?.isButtonDown(0);
    if (target && wants && !h.dead && !h.skills?.active && !h.control.lockAttack && !h.whip?.active) {
      this.strikeReqT = 0;
      this._startStrike(target);
      return;
    }
    if (this.windowT <= 0) {
      h.strikeGlow = 0;
      fx?.aim.showMarker(null);
    }
  }

  // Nearest enemy (edge distance) in front of the aim; anything within 2 m counts from any side.
  _findTarget(input) {
    const S = this.cfg.strike;
    const h = this.hero;
    const g = h.ctx;
    if (!g) return null;
    let ax = Math.sin(h.aimYaw), az = Math.cos(h.aimYaw);
    if (input?.groundValid) {
      const dx = input.groundPoint.x - h.position.x, dz = input.groundPoint.z - h.position.z;
      const l = Math.hypot(dx, dz);
      if (l > 0.2) (ax = dx / l), (az = dz / l);
    }
    const half = (S.coneDeg / 2) * DEG;
    let best = null;
    let bestScore = Infinity;
    for (const e of g.enemies) {
      if (e.dead || e.invulnerable || e.dying) continue;
      const dx = e.position.x - h.position.x, dz = e.position.z - h.position.z;
      const d = Math.hypot(dx, dz);
      const edge = d - e.radius;
      if (edge > S.range) continue;
      const ang = d > 1e-3 ? Math.acos(Math.max(-1, Math.min(1, (dx * ax + dz * az) / d))) : 0;
      if (edge > 2 && ang > half) continue;
      const score = edge + ang * 3;
      if (score < bestScore) (bestScore = score), (best = e);
    }
    return best;
  }

  _startStrike(target) {
    const S = this.cfg.strike;
    const h = this.hero;
    const g = h.ctx;
    this.striking = 'lunge';
    this.windowT = 0;
    this.strikeT = 0;
    this.strikeAfterT = 0;
    this.target = target;
    this.from = (this.from || new THREE.Vector3()).copy(h.position);
    const dx = target.position.x - h.position.x, dz = target.position.z - h.position.z;
    const d = Math.hypot(dx, dz) || 1;
    const travel = Math.max(0, d - target.radius - S.stopGap);
    this.lungeTime = Math.min(S.maxLunge, Math.max(0.05, travel / S.speed));
    h.interruptAttack();
    h.trail.stop();
    h.upper.fadeOut(0.05);
    h.strikeGlow = S.glow * 1.5;
    Object.assign(h.control, { lockMove: true, lockAim: true, lockAttack: true, baseOwned: true, invulnerable: true, noKnockback: true });
    h.aimYaw = h.legYaw = Math.atan2(dx, dz);
    h.group.rotation.y = h.legYaw;
    h.base.play('dash', { fade: 0.03 });
    g?.fx.aim.showMarker(null);
    audio.play('strikeLunge');
    if (g) {
      g.fx.lightning.bolt(_v.set(h.position.x, 1.1, h.position.z), _w.set(target.position.x, 1.1, target.position.z), { life: 0.1, width: 0.06, jitter: 0.2, intensity: 3 });
      g.fx.particles.dust(h.position, 6, { speed: 3, clock: 'hero' });
    }
  }

  _updateStrike(dt) {
    const S = this.cfg.strike;
    const h = this.hero;
    const g = h.ctx;
    this.strikeT += dt;
    if (this.striking === 'lunge') {
      const e = this.target;
      // Track the target while lunging; stop just short of its edge.
      const dx = e.position.x - this.from.x, dz = e.position.z - this.from.z;
      const d = Math.hypot(dx, dz) || 1;
      const reach = Math.max(0, d - e.radius - S.stopGap);
      const k = easeOut(Math.min(1, this.strikeT / this.lungeTime));
      h.position.set(this.from.x + (dx / d) * reach * k, 0, this.from.z + (dz / d) * reach * k);
      clampToArena(h.position, CONFIG.hero.radius);
      h.velocity.set(0, 0, 0);
      h.aimYaw = h.legYaw = Math.atan2(e.position.x - h.position.x, e.position.z - h.position.z);
      this.strikeAfterT -= dt;
      if (this.strikeAfterT <= 0) {
        this.strikeAfterT = S.afterimageEvery;
        g?.fx.afterimages.spawn(h, { life: 0.22, opacity: 0.32 });
      }
      if (this.strikeT >= this.lungeTime) this._strikeHit();
    } else if (this.striking === 'hit') {
      h.velocity.set(0, 0, 0);
      if (this.strikeT >= S.recover) this._endStrike(true);
    }
  }

  _strikeHit() {
    const S = this.cfg.strike;
    const h = this.hero;
    const g = h.ctx;
    this.striking = 'hit';
    this.strikeT = 0;
    h.base.play('shatterThrust', { fade: 0.02, speed: 1.6 });
    const e = this.target;
    if (!g) return;
    const yaw = h.aimYaw;
    const dir = _back.set(Math.sin(yaw), 0, Math.cos(yaw));
    const impact = _v.set(e.position.x, 1.1, e.position.z);
    if (!e.dead && !e.invulnerable) {
      const crit = Math.random() < h.critChance;
      g.combat.heroHitsEnemy(e, { mult: S.mult * h.bonus.strikeMul, crit, knockback: S.knockback, stun: S.stun, unblockable: true, from: h.position, hitstop: S.hitstop, shake: S.shake, strike: true });
    }
    g.score?.onStrike();
    audio.play('strikeImpact');
    // Splash around the impact (one hit per multi-part boss).
    const seen = new Set([e.owner || e]);
    for (const o of g.enemies) {
      if (o.dead || o.invulnerable || seen.has(o.owner || o)) continue;
      if (Math.hypot(o.position.x - e.position.x, o.position.z - e.position.z) > S.splashRadius + o.radius) continue;
      seen.add(o.owner || o);
      g.combat.heroHitsEnemy(o, { mult: S.mult * S.splashMult, knockback: S.knockback * 0.6, from: e.position, hitstop: 0, shake: 0 });
    }
    // Heavy impact feedback.
    g.rig.shake(S.shake, 0.4);
    g.rig.punch(S.punch, 0.28);
    g.postFX.flash(S.flash, 0.18, 0xdffbff);
    g.fx.shock.ring(e.position, { r0: 0.3, r1: S.splashRadius + 1.2, duration: 0.32, color: '#8ff4ff', intensity: 3, thickness: 0.22, clock: 'hero' });
    g.fx.shock.ring(e.position, { r0: 0.2, r1: S.splashRadius * 0.7, duration: 0.2, color: '#ffffff', intensity: 2.6, thickness: 0.35, clock: 'hero' });
    g.fx.slashes.spawn({ pos: _w.set(h.position.x, 1.1, h.position.z), yaw, tiltDeg: 12, radius: 2.6, thickness: 1.3, arcDeg: 150, dir: 1, sweep: 0.06, hold: 0.02, fade: 0.2, intensity: 3.6, color: '#dffbff' });
    g.fx.particles.sparks(impact, dir, 30, { color: CONFIG.fx.critColor, intensity: 4, speed: 14, life: 0.4, clock: 'hero' });
    g.fx.particles.hitStar(impact, { color: '#ffffff', intensity: 6, rays: 10, speed: 18, size: 0.08, life: 0.16, clock: 'hero' });
    g.fx.particles.dust(e.position, 12, { speed: 5, clock: 'hero' });
    g.map.petalImpulse(e.position, 4, 10);
  }

  _endStrike(release) {
    if (!this.striking) return;
    this.striking = null;
    const h = this.hero;
    h.strikeGlow = 0;
    if (release) Object.assign(h.control, { lockMove: false, lockAim: false, lockAttack: false, baseOwned: false, invulnerable: false, noKnockback: false });
    h.ctx?.fx.aim.showMarker(null);
  }

  _start(inputDir) {
    const D = this.cfg;
    const h = this.hero;
    if (inputDir.lengthSq() > 1e-6) this.dir.copy(inputDir).setY(0).normalize();
    else this.dir.set(Math.sin(h.aimYaw), 0, Math.cos(h.aimYaw));
    if (this.charges >= this.maxCharges) this.rechargeT = 0;
    this.charges--;
    this.active = true;
    this.t = 0;
    this.afterT = 0;
    this.stepHit = new Set();
    audio.play('dash');

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
