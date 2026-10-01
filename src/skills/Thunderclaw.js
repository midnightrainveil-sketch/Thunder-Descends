import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Skill } from './Skill.js';
import { clampToArena } from '../world/ArenaBounds.js';
import { EASE } from '../anim/Animator.js';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

/**
 * Q — Thunderclaw (spec §7).
 *  aim     (real time): world + hero slow to ×0.15, blue tint; range ring + target circle clamped to
 *          range and arena. Click fires, right-click / Esc cancels (no cooldown), auto-fire after 2.5 s.
 *  launch  (0.18 s): the claw hand detaches and flies to the target, trailing the block chain with
 *          lightning crawling along it.
 *  grab    (0.2 s): up to N enemies in the radius are yanked into a cluster, 1.2×ATK + 1.5 s stun.
 *  pull    (0.25 s): the chain drags the hero to them (invulnerable, afterimages); landing impact
 *          0.8×ATK in 2 m, shake, petal burst.
 *  reattach(0.12 s): the hand flies back onto the wrist with a spark.
 * With no targets it still flies and the hero still dashes (mobility).
 */
export class Thunderclaw extends Skill {
  constructor(system, key) {
    super(system, key, CONFIG.skills.thunderclaw);
    this.phase = 'idle';
    this.target = new THREE.Vector3();
    this.clawPos = new THREE.Vector3();
    this.from = new THREE.Vector3();
    this.land = new THREE.Vector3();
    this.grabbed = [];
    this.realT = 0;
    this.afterT = 0;
  }

  begin() {
    super.begin();
    const C = this.cfg;
    const g = this.game;
    this.phase = 'aim';
    this.realT = 0;
    this.hero.control.lockAttack = true;
    g.time.tweenScale('both', C.aimScale, C.aimTween);
    g.postFX.setTint(C.aimTint, C.aimTintStrength, C.aimTween);
    g.postFX.setSaturation(C.aimSaturation, C.aimTween);
    g.fx.aim.show(true);
    // Follow camera: vertical mouse slides the target along the ground (smooth, never past range).
    g.rig.beginSkillAim(this.hero, C.range, g.input.groundValid ? g.input.groundPoint : null);
    this._updateTarget(g.input);
  }

  _restoreTime(duration = this.cfg.aimTween) {
    const g = this.game;
    g.time.tweenScale('both', 1, duration);
    g.postFX.setTint(null, 0, duration);
    g.postFX.setSaturation(CONFIG.post.grade.saturation, duration);
    g.fx.aim.show(false);
    g.rig.endSkillAim();
  }

  _updateTarget(input) {
    const C = this.cfg;
    const h = this.hero.position;
    if (input.groundValid) this.target.set(input.groundPoint.x, 0, input.groundPoint.z);
    _v.subVectors(this.target, h).setY(0);
    const range = C.range;
    if (_v.length() > range) _v.setLength(range);
    this.target.copy(h).add(_v).setY(0);
    clampToArena(this.target, 0.3);
    this.game.fx.aim.set(h, range, this.target, this.r(C.radius));
  }

  handleInput(input, time) {
    if (this.phase !== 'aim') return;
    this.realT += time.realDt;
    this._updateTarget(input);
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
    this.phase = 'launch';
    this.t = 0;
    Object.assign(h.control, { lockMove: true, lockAim: true, lockAttack: true });
    h.aimYaw = Math.atan2(this.target.x - h.position.x, this.target.z - h.position.z);
    h.upper.play('clawThrow', { fade: 0.05 });
    h.upper.targetWeight = 1;
    h.upper.weightFade = 0.05;
    this.hero.rig.worldPosition('clawHand', this.clawPos);
    this.from.copy(this.clawPos);
    this.grabbed.length = 0;
    this.game.fx.particles.sparks(this.clawPos, null, 8, { speed: 5, life: 0.2, clock: 'hero' });
  }

  update(dt) {
    if (this.phase === 'aim' || this.phase === 'idle') return;
    const C = this.cfg;
    const h = this.hero;
    const g = this.game;
    this.t += dt;
    const flyH = 0.9;

    if (this.phase === 'launch') {
      const k = EASE.out(Math.min(1, this.t / C.launch));
      this.clawPos.lerpVectors(this.from, _w.copy(this.target).setY(flyH), k);
      if (this.t >= C.launch) this._grab();
    } else if (this.phase === 'grab') {
      const k = EASE.inOut(Math.min(1, this.t / C.grab));
      for (const gr of this.grabbed) {
        if (gr.enemy.dead) continue;
        gr.enemy.position.lerpVectors(gr.start, gr.slot, k);
        if (Math.random() < 0.5) g.fx.lightning.bolt(this.clawPos, _w.set(gr.enemy.position.x, 1.0, gr.enemy.position.z), { life: 0.05, width: 0.07, jitter: 0.25 });
      }
      if (this.t >= C.grab) this._startPull();
    } else if (this.phase === 'pull') {
      const k = EASE.in(Math.min(1, this.t / C.pull));
      h.position.lerpVectors(this.pullFrom, this.land, k);
      h.velocity.set(0, 0, 0);
      clampToArena(h.position, CONFIG.hero.radius);
      this.afterT -= dt;
      if (this.afterT <= 0) {
        this.afterT = C.afterimageEvery;
        g.fx.afterimages.spawn(h);
      }
      if (this.t >= C.pull) this._landing();
    } else if (this.phase === 'reattach') {
      const k = Math.min(1, this.t / C.reattach);
      this._placeClaw(this.clawPos, 1 - EASE.in(k));
      if (k >= 1) {
        g.fx.chain.hide();
        h.rig.worldPosition('chainAnchor', _v);
        g.fx.particles.sparks(_v, null, 10, { speed: 5, life: 0.2, clock: 'hero' });
        g.fx.particles.hitStar(_v, { color: '#bff6ff', intensity: 3, rays: 5, speed: 6, size: 0.04, life: 0.1, clock: 'hero' });
        this.phase = 'idle';
        h.upper.fadeOut(0.15);
        this.finish();
        return;
      }
    }
    if (this.phase !== 'reattach') this._placeClaw(this.clawPos, 1);
    this._drawChain();
  }

  _grab() {
    const C = this.cfg;
    const g = this.game;
    this.phase = 'grab';
    this.t = 0;
    const R = this.r(C.radius);
    const seen = new Set();
    const cand = g.enemies.filter((e) => {
      if (e.dead || e.invulnerable || Math.hypot(e.position.x - this.target.x, e.position.z - this.target.z) > R + e.radius) return false;
      const key = e.owner || e; // one hit per multi-part boss
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    cand.sort((a, b) => a.position.distanceToSquared(this.target) - b.position.distanceToSquared(this.target));
    const picked = cand.slice(0, this.r(C.maxTargets));
    this.hitBoss = picked.some((e) => e.isBoss);
    picked.forEach((e, i) => {
      // Cluster slots around the grab center.
      const a = (i / Math.max(1, picked.length)) * Math.PI * 2;
      const rad = picked.length > 1 ? C.clusterSpacing : 0;
      const slot = new THREE.Vector3(this.target.x + Math.cos(a) * rad, 0, this.target.z + Math.sin(a) * rad);
      clampToArena(slot, e.radius);
      if (!e.isBoss) this.grabbed.push({ enemy: e, start: e.position.clone(), slot }); // bosses aren't pulled
      e.clawMarked = true;
      g.combat.heroHitsEnemy(e, { mult: C.grabMult, stun: C.grabStun, knockback: 0, unblockable: true, from: this.target, shake: 0.2, skill: 'q' });
    });
    // Claw closes with a lightning grip flash.
    g.fx.shock.ring(this.target, { r0: R * 0.9, r1: 0.3, duration: C.grab, color: '#35e0ff', intensity: 2.4, thickness: 0.12, clock: 'hero' });
    g.fx.particles.sparks(_w.copy(this.target).setY(0.9), null, 14, { speed: 7, life: 0.25, clock: 'hero' });
  }

  _startPull() {
    const C = this.cfg;
    const h = this.hero;
    this.phase = 'pull';
    this.t = 0;
    this.afterT = 0;
    h.control.invulnerable = true;
    h.control.noKnockback = true;
    h.control.baseOwned = true;
    h.base.play('clawDash', { fade: 0.06 });
    this.pullFrom = h.position.clone();
    _v.subVectors(this.target, h.position).setY(0);
    const d = _v.length();
    const stop = this.grabbed.length || this.hitBoss ? C.landStop : 0;
    this.land.copy(h.position).addScaledVector(_v.normalize(), Math.max(0, d - stop));
    clampToArena(this.land, CONFIG.hero.radius);
  }

  _landing() {
    const C = this.cfg;
    const h = this.hero;
    const g = this.game;
    this.phase = 'reattach';
    this.t = 0;
    this.clawPos.copy(this.clawPos); // keep the hand where it grabbed; it flies back from here
    h.control.invulnerable = false;
    h.control.baseOwned = false;
    const seen = new Set();
    for (const e of g.enemies) {
      if (e.dead || Math.hypot(e.position.x - h.position.x, e.position.z - h.position.z) > C.landRadius + e.radius) continue;
      if (seen.has(e.owner || e)) continue;
      seen.add(e.owner || e);
      g.combat.heroHitsEnemy(e, { mult: C.landMult, knockback: 3, from: h.position, shake: 0.3 });
    }
    g.fx.shock.ring(h.position, { r0: 0.3, r1: C.landRadius * 1.2, duration: 0.3, color: '#8ff4ff', intensity: 2.6, thickness: 0.22, clock: 'hero' });
    g.fx.particles.dust(h.position, 12, { speed: 3.5, clock: 'hero' });
    g.rig.shake(0.35, 0.3);
    g.map.petalImpulse(h.position, C.landRadius + 1.5, 6);
  }

  // Blend the claw hand between its attached pose (k = 0) and a world position (k = 1).
  _placeClaw(world, k) {
    const claw = this.hero.rig.bones.clawHand;
    claw.updateMatrixWorld(true);
    const m = claw.matrixWorld;
    const attached = _v.setFromMatrixPosition(m);
    const pos = _w.copy(attached).lerp(world, k);
    this.hero.placeBoneWorld(claw, pos);
    // Fingers open while flying, clench on the grab.
    const open = this.phase === 'launch' ? -0.7 : this.phase === 'grab' || this.phase === 'pull' ? 0.5 : 0;
    const a = this.hero.animator;
    a.addRotation('clawFinger_0', open, 0, 0);
    a.addRotation('clawFinger_1', open, 0, 0);
    a.addRotation('clawFinger_2', -open, 0, 0);
  }

  _drawChain() {
    const h = this.hero;
    const g = this.game;
    h.rig.group.updateMatrixWorld(true);
    const a = h.rig.worldPosition('chainAnchor', _v);
    const b = h.rig.worldPosition('clawHand', _w);
    g.fx.chain.set(a, b);
    const P = g.fx.chain.points;
    // Lightning crawling along the chain.
    for (let i = 0; i < 3; i++) {
      const s = Math.floor(Math.random() * (P.length - 3));
      g.fx.lightning.bolt(P[s], P[s + 3], { life: 0.05, width: 0.09, jitter: 0.22, intensity: 4 });
    }
    // Glow at the claw so the hand reads in flight.
    if (Math.random() < 0.6) g.fx.particles.sparks(b, null, 1, { speed: 3, life: 0.15, size: 0.05, clock: 'hero' });
  }

  cancel() {
    if (!this.active) return;
    if (this.phase === 'aim') this._restoreTime(0);
    this.game.fx.aim.show(false);
    this.game.rig.endSkillAim();
    this.game.fx.chain.hide();
    this.phase = 'idle';
    this.hero.upper.fadeOut(0.1);
    this.finish();
  }

  get label() {
    if (this.active) return this.phase === 'aim' ? 'aiming' : 'active';
    return super.label;
  }
}
