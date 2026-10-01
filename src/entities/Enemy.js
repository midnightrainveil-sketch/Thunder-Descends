import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clampToArena } from '../world/ArenaBounds.js';
import { buildEnemyRig } from '../voxel/models/EnemyModels.js';
import { ENEMY_PALETTE } from '../voxel/palettes.js';
import { Animator } from '../anim/Animator.js';
import { enemyClips } from '../anim/clips/enemyClips.js';
import { hitSector, hitCircle, wrapAngle as wrap } from '../combat/Hitbox.js';

const DEG = Math.PI / 180;

// Action sequences: clips chained on the base layer.
const ACTIONS = {
  attack: ['attackWindup', 'attackStrike'],
  aimFire: ['aim', 'fire'],
  slam: ['slam'],
  block: ['block'],
  stunned: ['stunned'],
};

/**
 * Enemy robot (spec §8) with a simple state machine per type. World clock.
 *  approach → (in range, off cooldown) attack: windup (eye flare + filling floor decal) → strike
 *  (hit check on the clip's hitStart / fire event) → recover (cooldown) → approach …
 *  stunned: interrupts everything; the Tate's shield drops.
 * Ronin: closes in, slashes a 1.6 m sector with a short lunge.
 * Teppo: keeps 6–8 m away (strafing), aims a telegraph line, fires a bolt.
 * Tate: advances behind its shield (blocks 80% from the front), slams a 2.2 m circle.
 */
export class Enemy {
  constructor(type, position, scale = { hp: 1, dmg: 1, speed: 1 }) {
    this.type = type;
    this.cfg = CONFIG.enemies[type];
    this.radius = this.cfg.radius;
    this.maxHp = this.cfg.hp * scale.hp;
    this.hp = this.maxHp;
    this.damage = this.cfg.damage * scale.dmg;
    this.speed = this.cfg.speed * scale.speed;
    this.exp = this.cfg.exp * (scale.exp ?? 1);

    this.group = new THREE.Group();
    this.group.name = `enemy:${type}`;
    this.rig = buildEnemyRig(type);
    this.group.add(this.rig.group);
    this.palette = ENEMY_PALETTE;
    this.animator = new Animator(this.rig, enemyClips(type));
    this.base = this.animator.addLayer('base');
    this.overlay = this.animator.addLayer('overlay', { weight: 0 });
    this.base.setBlend({ idle: 1, walk: 0 });

    this.position = this.group.position;
    this.position.copy(position);
    this.yaw = Math.atan2(-position.x, -position.z); // face the arena center
    this.group.rotation.y = this.yaw;
    this.velocity = new THREE.Vector3();
    this.knock = new THREE.Vector3();
    this.walkBlend = 0;
    this.action = null; // { queue, step, hold, … }
    this.eyeFlare = 0;
    this.flash = 0;
    this.alive = true;
    this.dead = false;

    // AI
    this.ai = true; // debug walkers can turn this off
    this.state = 'approach';
    this.cooldown = 0.6 + Math.random() * 0.6; // don't attack on the first frame in range
    this.stunT = 0;
    this.stunImmune = 0;
    this.lockYaw = null;
    this.trackUntil = 0;
    this.actionT = 0;
    this.decal = null;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.ctx = null; // game (set by Game) → combat, fx, projectiles

    this._toHero = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this._v = new THREE.Vector3();
    this._blend = { idle: 1, walk: 0 };
    this._speeds = { walk: 1 };
    this.animator.on('telegraph', () => (this.eyeFlare = 1));
    this.animator.on('hitStart', () => this._onStrike());
    this.animator.on('fire', () => this._onFire());
    this.animator.update(0);
  }

  get forwardX() {
    return Math.sin(this.yaw);
  }

  get forwardZ() {
    return Math.cos(this.yaw);
  }

  // ── Actions (debug buttons and the AI) ───────────────────────────────────
  playAction(name, hold = name === 'block' ? 1.0 : name === 'stunned' ? 2.0 : 0) {
    const seq = ACTIONS[name];
    if (!seq || !seq.every((c) => this.animator.clips[c])) return false;
    this.action = { name, queue: seq, step: 0, hold, holdT: 0, holding: false, advance: false };
    this._playStep();
    return true;
  }

  _playStep() {
    const a = this.action;
    const clip = this.animator.clips[a.queue[a.step]];
    this.base.play(clip.name, { fade: a.step === 0 ? 0.12 : 0.04, onEnd: () => (a.advance = true) });
    if (clip.loop) a.holding = true;
  }

  _cancelAction() {
    this.action = null;
    this.lockYaw = null;
    if (this.decal) {
      this.decal.cancel();
      this.decal = null;
    }
  }

  playHurt() {
    this.overlay.play('hurt', { fade: 0.04, onEnd: () => this.overlay.fadeOut(0.12) });
    this.overlay.targetWeight = 0.9;
    this.overlay.weightFade = 0.04;
    this.flash = 1;
  }

  // ── Combat interface ─────────────────────────────────────────────────────
  // Is a hit coming from `from` (world pos) stopped by the shield?
  blocks(from) {
    if (this.type !== 'tate' || this.state === 'stunned' || this.dead) return false;
    const a = Math.atan2(from.x - this.position.x, from.z - this.position.z);
    return Math.abs(wrap(a - this.yaw)) <= (this.cfg.blockArcDeg * DEG) / 2;
  }

  // Returns true when this hit killed it.
  takeDamage(amount, { dirX = 0, dirZ = 0, knockback = 0, stun = 0, blocked = false } = {}) {
    if (this.dead) return false;
    this.hp -= amount;
    this.knock.x += dirX * knockback;
    this.knock.z += dirZ * knockback;
    this.flash = 1;
    if (blocked) {
      this.rig.setGlow('seams', 3);
      this._shieldFlash = 1;
    } else if (this.state !== 'stunned') {
      this.playHurt();
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.alive = false;
      this._cancelAction();
      return true;
    }
    if (stun > 0 && this.stunImmune <= 0) this.stun(stun);
    return false;
  }

  stun(duration) {
    if (this.dead) return;
    this._cancelAction();
    this.state = 'stunned';
    this.stunT = Math.max(this.stunT, duration);
    this.base.play('stunned', { fade: 0.08 });
    this.eyeFlare = 0;
  }

  // ── Update (world clock) ─────────────────────────────────────────────────
  update(dt, hero, others) {
    if (dt <= 0 || this.dead) return;
    const E = CONFIG.enemies;
    const toHero = this._toHero.set(hero.position.x - this.position.x, 0, hero.position.z - this.position.z);
    const dist = toHero.length();
    const heroYaw = Math.atan2(toHero.x, toHero.z);
    this.cooldown -= dt;
    this.stunImmune -= dt;
    this.actionT += dt;
    if (hero.dead && this.state !== 'stunned') this.cooldown = Math.max(this.cooldown, 0.5);

    // Stun
    if (this.state === 'stunned') {
      this.stunT -= dt;
      if (this.stunT <= 0) {
        this.state = 'approach';
        this.stunImmune = E.stunImmuneAfter;
        this.cooldown = Math.max(this.cooldown, 0.4);
        this.walkBlend = 0;
        this.base.setBlend({ idle: 1, walk: 0 });
      }
    }

    const desired = this._desired.set(0, 0, 0);
    const busy = !!this.action || this.state === 'stunned';
    if (this.ai && !busy && this.state === 'approach') this._think(dist, heroYaw, toHero, desired, hero);
    else if (!this.ai && !busy) this._walker(dist, toHero, desired);

    // Separation (soft) — the hard positional resolve happens in Game.
    for (const o of others) {
      if (o === this || o.dead || o.proxy || o.flying) continue;
      const dx = this.position.x - o.position.x;
      const dz = this.position.z - o.position.z;
      const d = Math.hypot(dx, dz);
      if (d < E.separation && d > 1e-4) {
        const push = ((E.separation - d) / E.separation) * this.speed;
        desired.x += (dx / d) * push;
        desired.z += (dz / d) * push;
      }
    }
    const busyNow = !!this.action || this.state === 'stunned'; // _think may have started an attack
    if (busyNow) desired.set(0, 0, 0);
    const dv = desired.sub(this.velocity);
    const maxStep = E.accel * dt;
    if (dv.length() > maxStep) dv.setLength(maxStep);
    this.velocity.add(dv);
    this.position.addScaledVector(this.velocity, dt);
    this.position.addScaledVector(this.knock, dt);
    this.knock.multiplyScalar(Math.exp(-E.knockbackDrag * dt));
    clampToArena(this.position, this.radius);

    // Facing: toward the hero unless an attack locked it (or tracks for a while, then locks).
    if (this.state !== 'stunned') {
      let target = heroYaw;
      if (this.lockYaw !== null) {
        if (this.actionT < this.trackUntil) this.lockYaw = heroYaw;
        target = this.lockYaw;
      }
      if (dist > 0.1) this.yaw += wrap(target - this.yaw) * (1 - Math.exp(-E.turnRate * dt));
      if (this.decal && this.actionT < this.trackUntil) this._placeDecal();
    }
    this.group.rotation.y = this.yaw;

    // Locomotion blend.
    const speed = this.velocity.length();
    if (!busyNow) {
      const w = THREE.MathUtils.clamp(speed / this.speed, 0, 1);
      this.walkBlend += (w - this.walkBlend) * (1 - Math.exp(-10 * dt));
      this._blend.idle = 1 - this.walkBlend;
      this._blend.walk = this.walkBlend;
      this._speeds.walk = Math.max(0.5, speed / this.cfg.walkAnimSpeedRef);
      this.base.setBlend(this._blend, this._speeds);
    }

    this.animator.update(dt);

    // Action sequencing: next clip on end, then hold, then back to approach (+ cooldown).
    const a = this.action;
    if (a) {
      if (a.advance) {
        a.advance = false;
        if (a.step < a.queue.length - 1) {
          a.step++;
          this._playStep();
        } else a.holding = true;
      }
      if (a.holding) {
        a.holdT += dt;
        if (a.holdT >= a.hold) {
          this.action = null;
          this.lockYaw = null;
          this.walkBlend = 0;
          if (this.state === 'attack') {
            this.state = 'approach';
            this.cooldown = this.cfg.cooldown ?? 1;
          }
        }
      }
    }

    // Eye flare (telegraph), shield flash, hit flash.
    const A = E.anim;
    this.eyeFlare = Math.max(0, this.eyeFlare - dt * E.eyeFlareDecay);
    const windup = this.state === 'attack' && this.decal ? 0.6 : 0;
    this.rig.setGlow('eyes', this.state === 'stunned' ? 0.3 : 1 + (A.eyeFlare - 1) * Math.max(this.eyeFlare, windup));
    if (this._shieldFlash) {
      this._shieldFlash = Math.max(0, this._shieldFlash - dt * 6);
      this.rig.setGlow('seams', 1 + 2 * this._shieldFlash);
    }
    this.flash = Math.max(0, this.flash - dt / E.hurtFlash);
    this.rig.setFlash(this.flash);
  }

  // Legacy Stage 2 walker (AI off): walk to stopDistance and idle.
  _walker(dist, toHero, desired) {
    const E = CONFIG.enemies;
    const approach = Math.min(this.speed, Math.sqrt(2 * E.accel * Math.max(0, dist - E.stopDistance)));
    if (approach > 0) desired.copy(toHero).multiplyScalar(approach / Math.max(dist, 1e-4));
  }

  // Approach / positioning + attack decisions per type.
  _think(dist, heroYaw, toHero, desired, hero) {
    const C = this.cfg;
    const E = CONFIG.enemies;
    const inv = 1 / Math.max(dist, 1e-4);
    const canAttack = this.cooldown <= 0 && !hero.dead;
    const arrive = (hold) => Math.min(this.speed, Math.sqrt(2 * E.accel * Math.max(0, dist - hold)));

    if (this.type === 'teppo') {
      // Keep 6–8 m: back off, close in, or strafe inside the band.
      if (Math.random() < 0.004) this.strafeDir *= -1;
      if (dist > C.keepMax) desired.copy(toHero).multiplyScalar(this.speed * inv);
      else if (dist < C.keepMin) desired.copy(toHero).multiplyScalar(-this.speed * inv);
      else desired.set(toHero.z * inv, 0, -toHero.x * inv).multiplyScalar(this.speed * C.strafe * this.strafeDir);
      // Don't back into the rim: flip the strafe instead.
      const r = Math.hypot(this.position.x, this.position.z);
      if (r > 9.5 && dist < C.keepMin) desired.set(toHero.z * inv, 0, -toHero.x * inv).multiplyScalar(this.speed * this.strafeDir);
      if (canAttack && dist <= C.fireRange && dist >= C.keepMin * 0.5) this._startAim();
      return;
    }

    // Ronin / Tate: close in to holdRange; circle a little while on cooldown.
    const sp = arrive(C.holdRange);
    if (sp > 0) desired.copy(toHero).multiplyScalar(sp * inv);
    else if (dist < C.holdRange * 0.85) desired.copy(toHero).multiplyScalar(-this.speed * 0.4 * inv); // step back out of a lunge
    if (this.type === 'ronin' && this.cooldown > 0 && dist < C.engageRange + 0.5) {
      desired.addScaledVector(this._v.set(toHero.z * inv, 0, -toHero.x * inv), this.speed * 0.35 * this.strafeDir);
    }
    if (canAttack && dist <= C.engageRange) {
      if (this.type === 'ronin') this._startSlash();
      else this._startSlam();
    }
  }

  _beginAttack(actionName, trackFor) {
    this.state = 'attack';
    this.actionT = 0;
    this.trackUntil = trackFor;
    this.lockYaw = this.yaw;
    this.velocity.set(0, 0, 0);
    this.playAction(actionName);
  }

  _startSlash() {
    const C = this.cfg;
    const A = CONFIG.enemies.anim;
    this._beginAttack('attack', 0.12);
    this.decal = this.ctx?.fx.decals.show('sector', { x: this.position.x, z: this.position.z, yaw: this.yaw, radius: C.slashRange, arcDeg: C.slashArcDeg, duration: A.windupDuration + 0.08 * A.strikeDuration });
  }

  _startSlam() {
    const C = this.cfg;
    const A = CONFIG.enemies.anim;
    const hitT = 0.72 * A.slamDuration;
    this._beginAttack('slam', hitT * 0.4);
    const cx = this.position.x + this.forwardX * C.slamOffset;
    const cz = this.position.z + this.forwardZ * C.slamOffset;
    this.decal = this.ctx?.fx.decals.show('circle', { x: cx, z: cz, radius: C.slamRadius, duration: hitT });
  }

  _startAim() {
    const C = this.cfg;
    const A = CONFIG.enemies.anim;
    this._beginAttack('aimFire', A.aimDuration * C.aimTrack);
    this.decal = this.ctx?.fx.decals.show('rect', { x: this.position.x, z: this.position.z, yaw: this.yaw, length: C.lineLength, width: C.lineWidth, duration: A.aimDuration });
  }

  _placeDecal() {
    const C = this.cfg;
    if (this.type === 'tate') this.decal.setTransform(this.position.x + this.forwardX * C.slamOffset, this.position.z + this.forwardZ * C.slamOffset, 0);
    else this.decal.setTransform(this.position.x, this.position.z, this.lockYaw ?? this.yaw);
  }

  // Clip hitStart: resolve the melee hit.
  _onStrike() {
    if (!this.ctx || this.state !== 'attack') return;
    const C = this.cfg;
    const hero = this.ctx.hero;
    this.decal = null;
    if (this.type === 'ronin') {
      this.knock.x += this.forwardX * C.lunge;
      this.knock.z += this.forwardZ * C.lunge;
      if (hitSector(this.position.x, this.position.z, this.yaw, C.slashRange, C.slashArcDeg * DEG, hero)) this.ctx.combat.enemyHitsHero(this, this.damage, C.knockback);
      this.ctx.fx.slashes.spawn({
        pos: this._v.set(this.position.x, 1.0, this.position.z), yaw: this.yaw, tiltDeg: -25, radius: C.slashRange, thickness: 0.5, arcDeg: C.slashArcDeg, dir: 1,
        color: CONFIG.fx.emberColor, intensity: 2.2, sweep: 0.08, clock: 'world',
      });
    } else if (this.type === 'tate') {
      const cx = this.position.x + this.forwardX * C.slamOffset;
      const cz = this.position.z + this.forwardZ * C.slamOffset;
      if (hitCircle(cx, cz, C.slamRadius, hero)) this.ctx.combat.enemyHitsHero(this, this.damage, C.knockback);
      this.ctx.combat.slamImpact(this._v.set(cx, 0, cz), C.slamRadius);
    }
  }

  // Clip 'fire' event (Teppo): bolt from the muzzle along the locked facing.
  _onFire() {
    if (!this.ctx || this.state !== 'attack') return;
    this.decal = null;
    this.rig.group.updateMatrixWorld(true);
    const muzzle = this.rig.bones.muzzle.getWorldPosition(this._v);
    this.ctx.projectiles.fire(muzzle, this.yaw, this.damage, this);
    this.ctx.fx.particles.sparks(muzzle, this._desired.set(this.forwardX, 0, this.forwardZ), 8, { color: CONFIG.fx.emberColor, speed: 6, life: 0.18 });
    this.ctx.fx.particles.hitStar(muzzle, { color: '#ffb35a', intensity: 4, rays: 6, speed: 8, size: 0.05, life: 0.1, clock: 'world' });
  }

  dispose() {
    this._cancelAction();
    this.rig.dispose();
  }
}
