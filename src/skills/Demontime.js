import * as THREE from 'three';
import { CONFIG, VOXEL } from '../config.js';
import { Skill } from './Skill.js';
import { HERO_BLADE_SEGMENTS } from '../voxel/models/HeroModel.js';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _b = new THREE.Vector3();
const easeOut = (u) => 1 - Math.pow(1 - u, 3);
const easeIn = (u) => u * u * u;
const SEG_LEN = 2 * VOXEL;
const ARM_BONES = ['upperArmL', 'forearmL', 'clawHand', 'upperArmR', 'forearmR', 'handR'];

/**
 * R — Demontime (spec §7). Cast 2.2 s (hero invulnerable, input locked, hitstop locked):
 *  0.0–0.4  kneel and plant the sword; world time → 0; the grade pass's time-stop ring expands
 *           from the sword (grayscale inside, the hero and his FX stay in color via the hero mask).
 *  0.4–1.6  nanobots stream from both arms into the blade; the bladeUlt plates appear one by one.
 *  1.6–2.0  the ring collapses back into the sword, color and world time return.
 *  2.0–2.2  pull the sword out: 5 m pulse (2.0×ATK), shockwaves, flash, petal burst.
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
    h.base.play('demonKneel', { fade: 0.06 });
    g.time.hitstopRemaining = 0;
    g.time.hitstopLocked = true;
    g.time.tweenScale('world', 0, C.freezeAt);
    this.shown = 0;
    this.nanoAcc = 0;
    this.phaseFlags = {};
    for (let i = 0; i < HERO_BLADE_SEGMENTS; i++) h.rig.setBoneVisible(`bladeUlt_${i}`, false);
    g.map.petalImpulse(h.position, 3, 3);
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

    // Time-stop ring: expand → hold → collapse, centered on the planted sword.
    let r = 0;
    if (t < C.freezeAt) r = C.ringMax * easeOut(t / C.freezeAt);
    else if (t < C.nanoEnd) r = C.ringMax;
    else if (t < C.restoreAt) r = C.ringMax * (1 - easeIn((t - C.nanoEnd) / (C.restoreAt - C.nanoEnd)));
    if (t < C.restoreAt) g.postFX.setTimeRing(this.center, Math.max(0.05, r), 1);
    if (!f.plant && t >= C.freezeAt * 0.7) {
      f.plant = true;
      g.fx.shock.ring(this.center, { r0: 0.2, r1: 3, duration: 0.3, color: '#bff6ff', intensity: 2.4, thickness: 0.2, clock: 'hero' });
      g.fx.particles.sparks(_v.copy(this.center).setY(0.1), _w.set(0, 1, 0), 20, { speed: 6, life: 0.3, clock: 'hero' });
      g.rig.shake(0.25, 0.25);
    }

    // Nanobots stream into the blade; ult plates assemble one by one.
    if (t >= C.freezeAt && t < C.nanoEnd) {
      this.nanoAcc += C.nanoRate * dt;
      while (this.nanoAcc >= 1) {
        this.nanoAcc -= 1;
        this._emitNano();
      }
    }
    const plateStart = C.freezeAt + 0.05;
    const plateStep = (C.nanoEnd - plateStart - 0.1) / HERO_BLADE_SEGMENTS;
    while (this.shown < HERO_BLADE_SEGMENTS && t >= plateStart + this.shown * plateStep) {
      const name = `bladeUlt_${this.shown}`;
      h.rig.setBoneVisible(name, true);
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
    h.rig.setGlow('ult', 1 + 0.8 * Math.min(1, Math.max(0, (t - C.freezeAt) / (C.nanoEnd - C.freezeAt))));

    if (!f.restore && t >= C.nanoEnd) {
      f.restore = true;
      g.time.tweenScale('world', 1, C.restoreAt - C.nanoEnd);
    }
    if (!f.release && t >= C.restoreAt) {
      f.release = true;
      g.postFX.setTimeRing(null, 0, false);
      g.time.tweenScale('world', 1, 0);
      h.base.play('demonRise', { fade: 0.04 });
      this._pulse();
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
    for (const e of g.enemies) {
      if (e.dead || Math.hypot(e.position.x - h.position.x, e.position.z - h.position.z) > R + e.radius) continue;
      g.combat.heroHitsEnemy(e, { mult: this.r(C.pulseMult), knockback: 8, unblockable: true, from: h.position, shake: 0.5 });
    }
    const fx = g.fx;
    fx.shock.ring(h.position, { r0: 0.4, r1: R, duration: 0.4, color: '#35e0ff', intensity: 3, thickness: 0.2, clock: 'hero' });
    fx.shock.ring(h.position, { r0: 0.3, r1: R * 1.3, duration: 0.55, color: '#ff3a4f', intensity: 2, thickness: 0.12, clock: 'hero' });
    fx.shock.ring(h.position, { r0: 0.1, r1: R * 0.6, duration: 0.25, color: '#ffffff', intensity: 2.4, thickness: 0.35, clock: 'hero' });
    fx.particles.sparks(_v.copy(h.position).setY(0.4), _w.set(0, 1, 0), 40, { speed: 12, spread: 1.4, life: 0.5, clock: 'hero' });
    fx.particles.sparks(_v, _w, 24, { color: '#ff3a4f', intensity: 3, speed: 10, spread: 1.4, life: 0.45, clock: 'hero' });
    fx.particles.dust(h.position, 16, { speed: 5, size: 0.18, clock: 'hero' });
    g.map.petalImpulse(h.position, R + 4, 14);
    g.postFX.flash(0.55, 0.3, 0xdffbff);
    g.rig.shake(0.7, 0.45);
    g.rig.punch(0.06, 0.3);
  }

  _endCast() {
    const g = this.game;
    g.time.hitstopLocked = false;
    g.time.tweenScale('world', 1, 0);
    g.postFX.setTimeRing(null, 0, false);
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
    g.time.hitstopLocked = false;
    g.time.tweenScale('world', 1, 0);
    g.postFX.setTimeRing(null, 0, false);
    g.fx.nanobots.clear();
    this.endBuff(false);
    this.finish();
  }

  get label() {
    if (this.active) return 'casting';
    if (this.buffActive) return `BUFF ${this.buffT.toFixed(1)}s`;
    return super.label;
  }
}
