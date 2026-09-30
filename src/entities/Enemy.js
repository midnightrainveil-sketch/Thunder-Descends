import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clampToArena } from '../world/ArenaBounds.js';
import { buildEnemyRig } from '../voxel/models/EnemyModels.js';
import { Animator } from '../anim/Animator.js';
import { enemyClips } from '../anim/clips/enemyClips.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Action sequences a debug button (or Stage 3 AI) can play: clips chained on the base layer.
const ACTIONS = {
  attack: ['attackWindup', 'attackStrike'],
  aimFire: ['aim', 'fire'],
  slam: ['slam'],
  block: ['block'],
  stunned: ['stunned'],
};

// Enemy robot. Stage 2 behaviour: walk toward the hero, stop at CONFIG.enemies.stopDistance,
// face him and idle. Runs on the world clock (time.worldDt). Eyes flare on 'telegraph' events.
export class Enemy {
  constructor(type, position) {
    this.type = type;
    this.cfg = CONFIG.enemies[type];
    this.group = new THREE.Group();
    this.group.name = `enemy:${type}`;
    this.rig = buildEnemyRig(type);
    this.group.add(this.rig.group);
    this.animator = new Animator(this.rig, enemyClips(type));
    this.base = this.animator.addLayer('base');
    this.overlay = this.animator.addLayer('overlay', { weight: 0 });
    this.base.setBlend({ idle: 1, walk: 0 });

    this.position = this.group.position;
    this.position.copy(position);
    this.yaw = Math.atan2(-position.x, -position.z); // face the arena center
    this.group.rotation.y = this.yaw;
    this.velocity = new THREE.Vector3();
    this.walkBlend = 0;
    this.action = null; // { queue: [clip names], hold }
    this.eyeFlare = 0;
    this.flash = 0;
    this.alive = true;

    this._toHero = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this._blend = { idle: 1, walk: 0 };
    this._speeds = { walk: 1 };
    this.animator.on('telegraph', () => (this.eyeFlare = 1));
    this.animator.update(0);
  }

  // Play an action sequence (debug / Stage 3 AI). Returns false if unknown for this type.
  // `hold` keeps the last pose for that many seconds (block, stunned loops) before resuming.
  playAction(name, hold = name === 'block' ? 1.0 : name === 'stunned' ? 2.0 : 0) {
    const seq = ACTIONS[name];
    if (!seq || !seq.every((c) => this.animator.clips[c])) return false;
    this.action = { queue: seq, step: 0, hold, holdT: 0, holding: false, advance: false };
    this._playStep();
    return true;
  }

  _playStep() {
    const a = this.action;
    const clip = this.animator.clips[a.queue[a.step]];
    this.base.play(clip.name, { fade: a.step === 0 ? 0.12 : 0.04, onEnd: () => (a.advance = true) });
    if (clip.loop) a.holding = true; // looping clips (stunned) just hold
  }

  playHurt() {
    this.overlay.play('hurt', { fade: 0.04, onEnd: () => this.overlay.fadeOut(0.12) });
    this.overlay.targetWeight = 0.9;
    this.overlay.weightFade = 0.04;
    this.flash = 1; // hit flash hook (spec §8: white 80 ms)
  }

  update(dt, hero, others) {
    if (dt <= 0) return;
    const E = CONFIG.enemies;
    const toHero = this._toHero.set(hero.position.x - this.position.x, 0, hero.position.z - this.position.z);
    const dist = toHero.length();
    const busy = !!this.action;

    // Move toward the hero, braking (at E.accel) to arrive exactly at stopDistance; keep apart from
    // other enemies.
    const approach = busy ? 0 : Math.min(this.cfg.speed, Math.sqrt(2 * E.accel * Math.max(0, dist - E.stopDistance)));
    const desired = this._desired.set(0, 0, 0);
    if (approach > 0) desired.copy(toHero).multiplyScalar(approach / Math.max(dist, 1e-4));
    for (const o of others) {
      if (o === this) continue;
      const dx = this.position.x - o.position.x;
      const dz = this.position.z - o.position.z;
      const d = Math.hypot(dx, dz);
      if (d < E.separation && d > 1e-4) {
        const push = ((E.separation - d) / E.separation) * this.cfg.speed;
        desired.x += (dx / d) * push;
        desired.z += (dz / d) * push;
      }
    }
    // Separation may slide enemies around the hero but never push them in past the approach speed.
    if (dist > 1e-4) {
      const radial = (desired.x * toHero.x + desired.z * toHero.z) / dist;
      if (radial > approach) desired.addScaledVector(toHero, (approach - radial) / dist);
    }
    const dv = desired.sub(this.velocity);
    const maxStep = E.accel * dt;
    if (dv.length() > maxStep) dv.setLength(maxStep);
    this.velocity.add(dv);
    this.position.addScaledVector(this.velocity, dt);
    clampToArena(this.position, this.cfg.radius);

    // Face the hero.
    if (dist > 0.1) {
      const target = Math.atan2(toHero.x, toHero.z);
      this.yaw += wrap(target - this.yaw) * (1 - Math.exp(-E.turnRate * dt));
    }
    this.group.rotation.y = this.yaw;

    // Locomotion blend (unless an action owns the base layer).
    const speed = this.velocity.length();
    if (!busy) {
      const w = THREE.MathUtils.clamp(speed / this.cfg.speed, 0, 1);
      this.walkBlend += (w - this.walkBlend) * (1 - Math.exp(-10 * dt));
      this._blend.idle = 1 - this.walkBlend;
      this._blend.walk = this.walkBlend;
      this._speeds.walk = Math.max(0.5, speed / this.cfg.walkAnimSpeedRef);
      this.base.setBlend(this._blend, this._speeds);
    }

    this.animator.update(dt);

    // Action sequencing: next clip on end, then hold the last pose, then back to locomotion.
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
          this.walkBlend = 0;
        }
      }
    }

    // Eye flare (telegraph) and hit flash decay.
    const A = E.anim;
    this.eyeFlare = Math.max(0, this.eyeFlare - dt * 1.6);
    this.rig.setGlow('eyes', 1 + (A.eyeFlare - 1) * this.eyeFlare);
    this.flash = Math.max(0, this.flash - dt / 0.08);
    this.rig.setFlash(this.flash);
  }

  dispose() {
    this.rig.dispose();
  }
}
