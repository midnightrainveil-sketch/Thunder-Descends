import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Skill } from './Skill.js';
import { HERO_BLADE_SEGMENTS, HERO_SEG_LEN_M } from '../voxel/models/HeroModel.js';
import { audio } from '../audio/Audio.js';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _b = new THREE.Vector3();
const easeOut = (u) => 1 - Math.pow(1 - u, 3);
const easeIn = (u) => u * u * u;
const SEG_LEN = HERO_SEG_LEN_M;
const ARM_BONES = ['upperArmL', 'forearmL', 'clawHand', 'upperArmR', 'forearmR', 'handR'];

/**
 * R — Demontime (spec §7). Cast 2.5 s (hero invulnerable, input locked, hitstop locked):
 *  0.0–0.2  raise the sword overhead point down with both hands and stab it into the ground in
 *           front, standing straight. On impact a shockwave bursts out of the sword and time stops:
 *           world time → 0 and the grade pass's time-stop ring sweeps outward from the sword
 *           (grayscale inside; the hero and his FX stay in color via the hero mask).
 *  0.3–1.6  the sword stays planted; nanobots stream from both arms into the blade and the
 *           bladeUlt plates assemble one by one (the upgrade).
 *  1.6–2.0  the shockwave rushes back into the sword (ring collapses, inward shock rings), color
 *           and world time return.
 *  2.0–2.5  Excalibur: he draws the sword straight up out of the ground and lifts it aloft; when
 *           the blade comes free (2.12 s): 5 m pulse (2.0×ATK), shockwaves, flash, petal burst.
 * Buff (7 s, hero clock): thicker blade with the ult plates, +60% attack speed, cooldowns ×2,
 * crit 100% (every basic attack is a whip), cyan + crimson aura. At the end the plates dissolve.
 */
export class Demontime extends Skill {
  constructor(system, key) {
    super(system, key, CONFIG.skills.demontime);
    this.buffT = 0;
    this.buffMax = 0;
    this.auraT = 0;
    this.nanoAcc = 0;
    this.shown = 0;
    this.phaseFlags = {};
    this.center = new THREE.Vector3();
    this.extended = 0;
  }

  get buffActive() {
    return this.buffT > 0;
  }

  canCast() {
    return !this.buffActive; // no recast during the buff
  }

  begin() {
    super.begin();
    const h = this.hero;
    const g = this.game;
    const C = this.cfg;
    this.startCooldown();
    Object.assign(h.control, { lockMove: true, lockAim: true, lockAttack: true, baseOwned: true, invulnerable: true, noKnockback: true });
    h.velocity.set(0, 0, 0);
    h.base.play('demonPlant', { fade: 0.04 });
    g.rig.cinematic(true); // front-side close-up so the stab and the planted sword read
    audio.play('ultRaise');
    g.time.hitstopRemaining = 0;
    g.time.hitstopLocked = true;
    this.shown = 0;
    this.nanoAcc = 0;
    this.phaseFlags = {};
    for (let i = 0; i < HERO_BLADE_SEGMENTS; i++) h.rig.setBoneVisible(`bladeUlt_${i}`, false);
  }

  _swordCenter(out) {
    return this.hero.rig.worldPosition('bladeSeg_3', out);
  }

  update(dt) {
    const C = this.cfg;
    const h = this.hero;
    const g = this.game;
    const f = this.phaseFlags;
    this.t += dt;
    const t = this.t;
    h.rig.group.updateMatrixWorld(true);
    this._swordCenter(this.center);

    // The stab: shockwave out of the sword, time stops.
    if (!f.plant && t >= C.plantAt) {
      f.plant = true;
      g.time.tweenScale('world', 0, C.freezeTween);
      audio.play('ultStab');
      audio.setTimeStop(true, 0.25);
      const ground = _b.copy(h.position).addScaledVector(_w.set(Math.sin(h.aimYaw), 0, Math.cos(h.aimYaw)), 0.45).setY(0.05);
      this.ground = this.ground || new THREE.Vector3();
      this.ground.copy(ground);
      g.fx.shock.ring(ground, { r0: 0.2, r1: 9, duration: 0.35, color: '#bff6ff', intensity: 3, thickness: 0.25, clock: 'hero' });
      g.fx.shock.ring(ground, { r0: 0.1, r1: 4, duration: 0.22, color: '#ffffff', intensity: 2.6, thickness: 0.4, clock: 'hero' });
      g.fx.particles.sparks(_v.copy(ground).setY(0.15), _w.set(0, 1, 0), 30, { speed: 9, spread: 1.2, life: 0.35, clock: 'hero' });
      g.fx.particles.debris(_v.copy(ground).setY(0.1), 12, { speed: 4 });
      g.fx.particles.dust(ground, 14, { speed: 4, clock: 'hero' });
      g.map.petalImpulse(ground, 6, 9);
      g.postFX.flash(C.show.flashStab, 0.25, 0xdffbff);
      this._skyStrike(this.center, C.show.skyBolts, '#e8fdff');
      this._radialArcs(ground, C.show.groundArcs, C.show.groundArcLen, '#8ff4ff');
      g.fx.shock.ring(ground, { r0: 0.3, r1: 6, duration: 0.5, color: C.show.gold, intensity: 2.4, thickness: 0.12, clock: 'hero' });
      g.postFX.setChromatic(C.show.chromatic, 0.05);
      this._arcT = 0;
      this._sparkT = 0;
      g.rig.shake(C.plantShake, 0.3);
      g.rig.punch(0.05, 0.25);
    }
    // Time-stop ring: sweep out from the sword → hold → rush back into it.
    let r = 0;
    if (t >= C.plantAt) {
      if (t < C.plantAt + C.ringOut) r = C.ringMax * easeOut((t - C.plantAt) / C.ringOut);
      else if (t < C.nanoEnd) r = C.ringMax;
      else if (t < C.restoreAt) r = C.ringMax * (1 - easeIn((t - C.nanoEnd) / (C.restoreAt - C.nanoEnd)));
      if (t < C.restoreAt) g.postFX.setTimeRing(this.ground || this.center, Math.max(0.05, r), 1);
    }
    // While time is stopped: lightning crackles off the planted sword, motes rise around him.
    if (f.plant && t < C.restoreAt) {
      const S = C.show;
      if (t > C.plantAt + 0.12) g.postFX.setChromatic(S.chromaticHold, 0.2);
      this._arcT += dt;
      while (this._arcT >= S.holdArcEvery) {
        this._arcT -= S.holdArcEvery;
        const a = Math.random() * Math.PI * 2;
        const d = S.holdArcRadius[0] + Math.random() * (S.holdArcRadius[1] - S.holdArcRadius[0]);
        const end = _w.set(h.position.x + Math.sin(a) * d, 0.05 + Math.random() * 0.4, h.position.z + Math.cos(a) * d);
        g.fx.lightning.bolt(this.center, end, { life: 0.07, width: 0.05, jitter: 0.3, color: Math.random() < 0.25 ? S.gold : '#8ff4ff', intensity: 3.6 });
      }
      this._sparkT += dt;
      while (this._sparkT >= S.holdSparkEvery) {
        this._sparkT -= S.holdSparkEvery;
        const a = Math.random() * Math.PI * 2;
        const d = 0.6 + Math.random() * 2.2;
        g.fx.particles.sparks(_v.set(h.position.x + Math.sin(a) * d, 0.1, h.position.z + Math.cos(a) * d), _b.set(0, 1, 0), 1, { color: '#8ff4ff', intensity: 3, speed: 3 + Math.random() * 3, spread: 0.2, life: 0.6, size: 0.06, clock: 'hero' });
      }
    }
    // The shockwave comes back: inward rings converging on the sword.
    if (!f.back && t >= C.nanoEnd) {
      f.back = true;
      audio.play('ultReturn');
      const d = C.restoreAt - C.nanoEnd;
      g.fx.shock.ring(this.ground || this.center, { r0: 12, r1: 0.3, duration: d, color: '#bff6ff', intensity: 2.4, thickness: 0.22, clock: 'hero' });
      g.fx.shock.ring(this.ground || this.center, { r0: 6, r1: 0.2, duration: d * 0.8, color: '#ff5a6e', intensity: 1.8, thickness: 0.14, clock: 'hero' });
    }

    // Nanobots stream into the blade; ult plates assemble one by one.
    if (t >= C.nanoStart && t < C.nanoEnd) {
      this.nanoAcc += C.nanoRate * dt;
      while (this.nanoAcc >= 1) {
        this.nanoAcc -= 1;
        this._emitNano();
      }
    }
    const plateStart = C.nanoStart + 0.05;
    const plateStep = (C.nanoEnd - plateStart - 0.1) / HERO_BLADE_SEGMENTS;
    while (this.shown < HERO_BLADE_SEGMENTS && t >= plateStart + this.shown * plateStep) {
      const name = `bladeUlt_${this.shown}`;
      h.rig.setBoneVisible(name, true);
      audio.play('plate');
      h.rig.worldPosition(name, _v);
      g.fx.particles.hitStar(_v, { color: '#ff5a6e', intensity: 3, rays: 5, speed: 5, size: 0.035, life: 0.12, clock: 'hero' });
      this.shown++;
    }
    // Pop-in scale for the newest plates.
    for (let i = 0; i < this.shown; i++) {
      const appear = plateStart + i * plateStep;
      const k = Math.min(1, (t - appear) / 0.12);
      h.rig.bones[`bladeUlt_${i}`].scale.setScalar(k < 1 ? 0.3 + 1.1 * Math.sin((k * Math.PI) / 1.2) : 1);
    }
    h.rig.setGlow('ult', 1 + 0.8 * Math.min(1, Math.max(0, (t - C.nanoStart) / (C.nanoEnd - C.nanoStart))));

    if (!f.restore && t >= C.nanoEnd) {
      f.restore = true;
      audio.setTimeStop(false, C.restoreAt - C.nanoEnd);
      g.time.tweenScale('world', 1, C.restoreAt - C.nanoEnd);
    }
    if (!f.pull && t >= C.restoreAt) {
      f.pull = true;
      g.postFX.setTimeRing(null, 0, false);
      g.time.tweenScale('world', 1, 0);
      h.base.play('demonPull', { fade: 0.03 });
    }
    // The blade comes free of the ground: release pulse.
    if (!f.release && t >= C.pullFree) {
      f.release = true;
      audio.play('ultRelease');
      this._pulse();
    }
    if (!f.camBack && t >= C.camBackAt) {
      f.camBack = true;
      g.rig.cinematic(false); // ease back to the player's camera while he lifts the blade
    }
    if (t >= C.cast) this._endCast();
  }

  _emitNano() {
    const C = this.cfg;
    const h = this.hero;
    const B = h.rig.bones;
    const src = B[ARM_BONES[Math.floor(Math.random() * ARM_BONES.length)]];
    src.getWorldPosition(_v);
    _v.x += (Math.random() - 0.5) * 0.25;
    _v.y += (Math.random() - 0.5) * 0.25;
    _v.z += (Math.random() - 0.5) * 0.25;
    const seg = B[`bladeSeg_${Math.floor(Math.random() * HERO_BLADE_SEGMENTS)}`];
    const local = _w.set((Math.random() - 0.5) * 0.14, (Math.random() - 0.5) * 0.14, Math.random() * SEG_LEN);
    // Bulge: outward from the body and upward so the streams arc.
    seg.getWorldPosition(_b);
    const out = _b.sub(h.position).setY(0).normalize();
    out.x += (Math.random() - 0.5) * 1.6;
    out.z += (Math.random() - 0.5) * 1.6;
    out.y = 0.6 + Math.random() * 0.9;
    out.multiplyScalar(0.5 + Math.random() * 0.6);
    const [a, b] = C.nanoFlight;
    this.game.fx.nanobots.emit(_v, seg, local, out, a + Math.random() * (b - a));
  }

  _pulse() {
    const C = this.cfg;
    const h = this.hero;
    const g = this.game;
    const R = this.r(C.pulseRadius);
    const seen = new Set();
    for (const e of g.enemies) {
      if (e.dead || Math.hypot(e.position.x - h.position.x, e.position.z - h.position.z) > R + e.radius) continue;
      if (seen.has(e.owner || e)) continue;
      seen.add(e.owner || e);
      g.combat.heroHitsEnemy(e, { mult: this.r(C.pulseMult), knockback: 8, unblockable: true, from: h.position, shake: C.pulseHitShake, skill: 'r' });
    }
    const fx = g.fx;
    fx.shock.ring(h.position, { r0: 0.4, r1: R, duration: 0.4, color: '#35e0ff', intensity: 3, thickness: 0.2, clock: 'hero' });
    fx.shock.ring(h.position, { r0: 0.3, r1: R * 1.3, duration: 0.55, color: '#ff3a4f', intensity: 2, thickness: 0.12, clock: 'hero' });
    fx.shock.ring(h.position, { r0: 0.1, r1: R * 0.6, duration: 0.25, color: '#ffffff', intensity: 2.4, thickness: 0.35, clock: 'hero' });
    fx.particles.sparks(_v.copy(h.position).setY(0.4), _w.set(0, 1, 0), 40, { speed: 12, spread: 1.4, life: 0.5, clock: 'hero' });
    fx.particles.sparks(_v, _w, 24, { color: '#ff3a4f', intensity: 3, speed: 10, spread: 1.4, life: 0.45, clock: 'hero' });
    fx.particles.dust(h.position, 16, { speed: 5, size: 0.18, clock: 'hero' });
    g.map.petalImpulse(h.position, R + 4, 14);
    g.postFX.flash(C.show.flashRelease, 0.35, 0xdffbff);
    this._skyStrike(_v.set(h.position.x, 1.2, h.position.z), C.show.releaseSky, '#ffffff');
    this._radialArcs(h.position, C.show.releaseBolts, [R * 0.7, R], '#8ff4ff');
    this._radialArcs(h.position, Math.ceil(C.show.releaseBolts / 2), [R * 0.4, R * 0.8], C.show.crimson);
    fx.shock.ring(h.position, { r0: 0.2, r1: R * 1.6, duration: 0.7, color: C.show.gold, intensity: 2.6, thickness: 0.1, clock: 'hero' });
    fx.particles.sparks(_v.copy(h.position).setY(0.4), _w.set(0, 1, 0), 30, { color: C.show.gold, intensity: 3.5, speed: 14, spread: 1.2, life: 0.6, clock: 'hero' });
    g.postFX.setChromatic(C.show.chromatic, 0.04);
    setTimeout(() => g.postFX.setChromatic(CONFIG.post.grade.chromatic ?? 0, C.show.chromaticTime), 90);
    g.rig.shake(C.releaseShake, 0.45);
    g.rig.punch(0.06, 0.3);
  }

  // Forked lightning from high in the sky down to `target`.
  _skyStrike(target, n, color) {
    const S = this.cfg.show;
    for (let i = 0; i < n; i++) {
      const top = _b.set(target.x + (Math.random() - 0.5) * 2 * S.skySpread * (1 + i), S.skyHeight, target.z + (Math.random() - 0.5) * 2 * S.skySpread * (1 + i));
      this.game.fx.lightning.bolt(top, target, { life: 0.16 + i * 0.03, width: i === 0 ? S.skyWidth[0] : S.skyWidth[1], jitter: 0.6, color, intensity: S.skyIntensity });
    }
  }

  // Bolts running out along the ground from `center`, evenly spaced with a random twist.
  _radialArcs(center, n, [d0, d1], color) {
    const a0 = Math.random() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const d = d0 + Math.random() * (d1 - d0);
      const from = _v.set(center.x, 0.15, center.z);
      const to = _w.set(center.x + Math.sin(a) * d, 0.08, center.z + Math.cos(a) * d);
      this.game.fx.lightning.bolt(from, to, { life: 0.14, width: 0.07, jitter: 0.35, color, intensity: 3.8 });
    }
  }

  _endCast() {
    const g = this.game;
    g.rig.cinematic(false);
    g.time.hitstopLocked = false;
    g.time.tweenScale('world', 1, 0);
    g.postFX.setTimeRing(null, 0, false);
    g.postFX.setChromatic(CONFIG.post.grade.chromatic ?? 0, 0.3);
    this._startBuff();
    this.finish();
  }

  _startBuff() {
    const C = this.cfg;
    const h = this.hero;
    this.buffMax = this.r(C.buff);
    this.buffT = this.buffMax;
    this.extended = 0;
    h.buff.attackSpeed = C.attackSpeed;
    h.buff.critAll = true;
    h.bladeThick = C.bladeThick;
    h.bladeGlowBase = 1.7;
    for (let i = 0; i < HERO_BLADE_SEGMENTS; i++) {
      h.rig.setBoneVisible(`bladeUlt_${i}`, true);
      h.rig.bones[`bladeUlt_${i}`].scale.setScalar(1);
    }
  }

  // Buff tick (hero clock), runs whether or not another skill is active.
  updateBuff(dt) {
    if (this.buffT <= 0 || dt <= 0) return;
    const C = this.cfg;
    const h = this.hero;
    const g = this.game;
    this.buffT -= dt;
    h.rig.setGlow('ult', 1.3 + 0.5 * Math.sin(this.buffT * 14));
    // Crackling cyan + crimson aura.
    this.auraT -= dt;
    if (this.auraT <= 0) {
      this.auraT = C.auraEvery;
      const p = h.position;
      const rnd = (o) => o.set(p.x + (Math.random() - 0.5) * 1.1, 0.3 + Math.random() * 2.0, p.z + (Math.random() - 0.5) * 1.1);
      const crimson = Math.random() < 0.45;
      g.fx.lightning.bolt(rnd(_v), rnd(_w), { life: 0.08, width: 0.05, jitter: 0.25, color: crimson ? '#ff4a5e' : '#8ff4ff', intensity: 3 });
      g.fx.particles.embers(_v.set(p.x, 0.6, p.z), 2, { color: crimson ? '#ff3a4f' : '#35e0ff', intensity: 3, radius: 0.5, life: 0.6, clock: 'hero' });
    }
    if (this.buffT <= 0) this.endBuff(true);
  }

  // Rank IV card: kills during the buff extend it.
  onKill() {
    const C = this.cfg;
    const ext = this.r(C.killExtend);
    if (this.buffT <= 0 || ext <= 0 || this.extended >= C.killExtendMax) return;
    this.buffT += ext;
    this.extended += ext;
  }

  endBuff(dissolve = true) {
    const h = this.hero;
    const wasActive = this.buffT > 0 || h.bladeThick !== 1;
    this.buffT = 0;
    h.buff.attackSpeed = 1;
    h.buff.critAll = false;
    h.bladeThick = 1;
    h.bladeGlowBase = 1;
    h.rig.setGlow('ult', 1);
    for (let i = 0; i < HERO_BLADE_SEGMENTS; i++) {
      const name = `bladeUlt_${i}`;
      if (dissolve && wasActive) {
        h.rig.worldPosition(name, _v);
        for (let k = 0; k < 8; k++) {
          const crimson = k % 3 === 0;
          this.game.fx.particles.glow.emit({
            x: _v.x, y: _v.y, z: _v.z, vx: (Math.random() - 0.5) * 3, vy: Math.random() * 2.5, vz: (Math.random() - 0.5) * 3,
            life: 0.5 + Math.random() * 0.4, size: 0.035, gravity: -0.1, drag: 2, spin: 8, color: crimson ? '#ff3a4f' : '#7ff0ff', intensity: 3, clock: 'hero',
          });
        }
      }
      h.rig.setBoneVisible(name, false);
    }
  }

  cancel() {
    if (!this.active) return;
    const g = this.game;
    audio.setTimeStop(false, 0.1);
    g.rig.cinematic(false);
    g.time.hitstopLocked = false;
    g.time.tweenScale('world', 1, 0);
    g.postFX.setTimeRing(null, 0, false);
    g.fx.nanobots.clear();
    this.endBuff(false);
    this.game.postFX.setChromatic(CONFIG.post.grade.chromatic ?? 0, 0);
    this.finish();
  }

  get label() {
    if (this.active) return 'casting';
    if (this.buffActive) return `BUFF ${this.buffT.toFixed(1)}s`;
    return super.label;
  }
}
