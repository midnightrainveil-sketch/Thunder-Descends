import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Skill } from './Skill.js';
import { clampToArena } from '../world/ArenaBounds.js';
import { hitRect, hitSector, AttackInstance } from '../combat/Hitbox.js';
import { audio } from '../audio/Audio.js';

const DEG = Math.PI / 180;
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

/**
 * E — Shatter → Overdrive (spec §7).
 *  aim    (real time, like Thunderclaw): world + hero slow to ×0.15, blue tint; a lane on the floor
 *         shows the thrust (length incl. lunge × width) toward the aim point. Click fires,
 *         right-click / Esc cancels (no cooldown), auto-fire after 2.5 s.
 *  windup (0.12 s) → one-handed lunge thrust: 3.5 × 1.2 m rectangle, 1.8×ATK, 1 s stun, spear-like
 *  cyan burst from the blade tip. On a hit → Overdrive (1 s): two-handed stance, a slash every 0.08 s
 *  in a 120° / 3.2 m cone (0.45×ATK, each can crit), crescents at varied angles, afterimages, slow
 *  drift toward the aim, no knockback; ends with a heavier final slash. On a miss: normal recovery.
 */
export class Shatter extends Skill {
  constructor(system, key) {
    super(system, key, CONFIG.skills.shatter);
    this.phase = 'idle';
    this.hits = new AttackInstance();
    this.slashT = 0;
    this.afterT = 0;
    this.slashN = 0;
    this.realT = 0;
    this.yaw = 0;
  }

  begin() {
    super.begin();
    const C = this.cfg;
    const g = this.game;
    this.phase = 'aim';
    this.realT = 0;
    this.yaw = this.hero.aimYaw;
    this.hero.control.lockAttack = true;
    g.time.tweenScale('both', C.aimScale, C.aimTween);
    g.postFX.setTint(C.aimTint, C.aimTintStrength, C.aimTween);
    g.postFX.setSaturation(C.aimSaturation, C.aimTween);
    g.fx.aim.showLane(true);
    audio.play('aim');
    this._updateAim(g.input);
  }

  // Lane from the hero toward the aim point (the mouse ground point / screen center).
  _updateAim(input) {
    const C = this.cfg;
    const h = this.hero.position;
    if (input.groundValid) {
      const dx = input.groundPoint.x - h.x;
      const dz = input.groundPoint.z - h.z;
      if (dx * dx + dz * dz > 0.04) this.yaw = Math.atan2(dx, dz);
    }
    this.game.fx.aim.setLane(h, this.yaw, this.r(C.length) + C.lunge, this.r(C.width));
  }

  _restoreTime(duration = this.cfg.aimTween) {
    const g = this.game;
    g.time.tweenScale('both', 1, duration);
    g.postFX.setTint(null, 0, duration);
    g.postFX.setSaturation(CONFIG.post.grade.saturation, duration);
    g.fx.aim.showLane(false);
  }

  handleInput(input, time) {
    if (this.phase !== 'aim') return;
    this.realT += time.realDt;
    this._updateAim(input);
    if (input.wasButtonPressed(2) || input.wasPressed('Escape')) {
      this._restoreTime();
      this.phase = 'idle';
      this.finish(); // no cooldown on cancel
      return;
    }
    if (input.wasButtonPressed(0) || this.realT >= this.cfg.aimTimeout) this._fire();
  }

  _fire() {
    const h = this.hero;
    this._restoreTime();
    this.startCooldown();
    this.phase = 'windup';
    this.t = 0;
    Object.assign(h.control, { lockMove: true, lockAim: true, lockAttack: true, baseOwned: true });
    h.velocity.set(0, 0, 0);
    h.aimYaw = this.yaw;
    h.base.play('shatterWindup', { fade: 0.05 });
  }

  update(dt) {
    const C = this.cfg;
    const h = this.hero;
    if (this.phase === 'aim' || this.phase === 'idle') return;
    this.t += dt;
    if (this.phase === 'windup') {
      if (this.t >= C.windup) this._thrust();
    } else if (this.phase === 'thrust') {
      // Lunge forward over the first part of the thrust.
      if (this.t < 0.1) {
        h.position.x += Math.sin(this.yaw) * (C.lunge / 0.1) * dt;
        h.position.z += Math.cos(this.yaw) * (C.lunge / 0.1) * dt;
        clampToArena(h.position, CONFIG.hero.radius);
      }
      if (this.t >= 0.12 && this.hitAny) this._startOverdrive();
      else if (this.t >= C.thrust + C.recover * 0.5 && !this.hitAny) this._end();
    } else if (this.phase === 'overdrive') {
      this._overdrive(dt);
    } else if (this.phase === 'final') {
      if (!this.finalDone && this.t >= 0.09) this._finalSlash();
      if (this.t >= 0.3) this._end();
    }
  }

  _thrust() {
    const C = this.cfg;
    const h = this.hero;
    const g = this.game;
    this.phase = 'thrust';
    this.t = 0;
    audio.play('thrust');
    h.base.play('shatterThrust', { fade: 0.03 });
    const len = this.r(C.length);
    const wid = this.r(C.width);
    this.hitAny = false;
    const hitSet = new Set();
    // Hitbox from the hero along the locked aim (includes the lunge distance).
    const ox = h.position.x;
    const oz = h.position.z;
    for (const e of g.enemies) {
      if (e.dead || !hitRect(ox, oz, this.yaw, len + C.lunge, wid, e)) continue;
      this.hitAny = true;
      if (e.invulnerable || hitSet.has(e.owner || e)) continue;
      hitSet.add(e.owner || e);
      g.combat.heroHitsEnemy(e, { mult: C.mult, stun: C.stun, knockback: 3.5, from: h.position, shake: 0.3, hitstop: 0.06, skill: 'e' });
    }
    // Spear-like burst ahead of the blade.
    const fx = g.fx;
    const start = _v.set(ox + Math.sin(this.yaw) * 0.6, 1.2, oz + Math.cos(this.yaw) * 0.6);
    fx.shock.spear(start, this.yaw, { length: len + C.lunge, width: wid * 0.9, intensity: 3.2 });
    fx.shock.spear(start, this.yaw, { length: (len + C.lunge) * 0.8, width: wid * 0.35, color: '#ffffff', intensity: 2.2 });
    _w.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const tip = _v.set(ox, 1.2, oz).addScaledVector(_w, len + C.lunge);
    fx.particles.sparks(tip, _w, 16, { speed: 10, life: 0.25, clock: 'hero' });
    fx.shock.ring(tip, { r0: 0.1, r1: 1.2, duration: 0.2, color: '#8ff4ff', intensity: 2, thickness: 0.3, y: 0.06, clock: 'hero' });
    g.rig.shake(0.18, 0.2);
    g.map.petalSweep(h.position, _w, 30, len + 1.5, 4, 1);
  }

  _startOverdrive() {
    const h = this.hero;
    this.phase = 'overdrive';
    this.t = 0;
    this.slashT = 0;
    this.afterT = 0;
    this.slashN = 0;
    h.control.lockAim = false; // Overdrive follows the aim
    h.control.noKnockback = true;
    h.base.play('overdrive', { fade: 0.04 });
    this.game.fx.shock.ring(h.position, { r0: 0.2, r1: 2.5, duration: 0.3, color: '#35e0ff', intensity: 2.2, clock: 'hero' });
  }

  _overdrive(dt) {
    const C = this.cfg;
    const h = this.hero;
    const g = this.game;
    // Drift toward the aim; the hero glows.
    h.position.x += Math.sin(h.aimYaw) * C.drift * dt;
    h.position.z += Math.cos(h.aimYaw) * C.drift * dt;
    h.velocity.set(0, 0, 0);
    clampToArena(h.position, CONFIG.hero.radius);
    h.glowBoost = 1.8;
    this.afterT -= dt;
    if (this.afterT <= 0) {
      this.afterT = C.afterimageEvery;
      g.fx.afterimages.spawn(h, { life: 0.18, opacity: 0.35 });
    }
    this.slashT -= dt;
    while (this.slashT <= 0 && this.t < this.r(C.overdrive)) {
      this.slashT += C.slashEvery;
      this._slash(false);
    }
    if (this.t >= this.r(C.overdrive)) {
      this.phase = 'final';
      this.t = 0;
      this.finalDone = false;
      h.base.play('overdriveFinal', { fade: 0.03 });
    }
  }

  _slash(final) {
    const C = this.cfg;
    const h = this.hero;
    const g = this.game;
    const n = this.slashN++;
    audio.play(final ? 'swing' : 'slash', { step: 2 });
    const range = C.slashRange * (final ? 1.15 : 1);
    const arc = (final ? C.slashArcDeg + 30 : C.slashArcDeg) * DEG;
    this.hits.reset();
    for (const e of g.enemies) {
      if (e.dead || !hitSector(h.position.x, h.position.z, h.aimYaw, range, arc, e) || !this.hits.once(e)) continue;
      const crit = Math.random() < h.critChance;
      g.combat.heroHitsEnemy(e, {
        mult: final ? C.finalMult : C.slashMult, crit, knockback: final ? 6 : 0.6, from: h.position,
        hitstop: final ? C.finalHitstop : crit ? 0.02 : 0, shake: final ? C.finalShake : 0.06, skill: 'od',
      });
      if (this.r(C.chain)) this._chainLightning(e);
    }
    // Crescent at a varied angle.
    const tilt = final ? 10 : (n % 2 ? 1 : -1) * (15 + Math.random() * 55);
    g.fx.slashes.spawn({
      pos: _v.set(h.position.x, 0.8 + Math.random() * 0.7, h.position.z), yaw: h.aimYaw + (Math.random() - 0.5) * 0.4, tiltDeg: tilt,
      radius: range * (0.75 + Math.random() * 0.25), thickness: final ? 1.3 : 0.6, arcDeg: final ? 160 : 110, dir: n % 2 ? 1 : -1,
      sweep: final ? 0.1 : 0.05, hold: 0.01, fade: final ? 0.2 : 0.1, intensity: final ? 3.4 : 2.2, color: final ? '#dffbff' : CONFIG.fx.slashColor,
    });
    if (final) {
      g.rig.punch(0.03, 0.2);
      g.map.petalSweep(h.position, _w.set(Math.sin(h.aimYaw), 0, Math.cos(h.aimYaw)), 160, range + 1, 5, 1);
    }
  }

  _finalSlash() {
    this.finalDone = true;
    this._slash(true);
  }

  _chainLightning(from) {
    const C = this.cfg;
    const g = this.game;
    let best = null;
    let bd = C.chainRange;
    for (const e of g.enemies) {
      if (e === from || e.dead) continue;
      const d = e.position.distanceTo(from.position);
      if (d < bd) (bd = d), (best = e);
    }
    if (!best) return;
    g.fx.lightning.bolt(_v.set(from.position.x, 1.1, from.position.z), _w.set(best.position.x, 1.1, best.position.z), { life: 0.1, width: 0.06 });
    g.combat.heroHitsEnemy(best, { mult: C.chainMult, knockback: 0, from: from.position, hitstop: 0, shake: 0 });
  }

  _end() {
    this.phase = 'idle';
    this.hero.glowBoost = 1;
    this.finish();
  }

  cancel() {
    if (!this.active) return;
    if (this.phase === 'aim') this._restoreTime(0);
    this._end();
  }

  get label() {
    if (this.active && this.phase === 'aim') return 'aiming';
    if (this.active) return this.phase === 'overdrive' || this.phase === 'final' ? CONFIG.names.overdrive.toUpperCase() : 'active';
    return super.label;
  }
}

