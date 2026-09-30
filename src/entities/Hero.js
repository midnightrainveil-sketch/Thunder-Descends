import * as THREE from 'three';
import { CONFIG, VOXEL } from '../config.js';
import { clampToArena } from '../world/ArenaBounds.js';
import { buildHeroRig, HERO_BLADE_SEGMENTS } from '../voxel/models/HeroModel.js';
import { Animator, EASE } from '../anim/Animator.js';
import { heroClips, HERO_UPPER_MASK } from '../anim/clips/heroClips.js';
import { BladeTrail } from '../fx/BladeTrail.js';

const DEG = Math.PI / 180;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ATTACKS = ['attack1', 'attack2', 'attack3'];

// Damped spring for secondary motion (angle in radians).
class Spring {
  constructor() {
    this.x = 0;
    this.v = 0;
  }
  step(target, k, d, dt) {
    const a = (target - this.x) * k - this.v * d;
    this.v += a * dt;
    this.x += this.v * dt;
    return this.x;
  }
}

// KUROGANE. Runs on the hero clock (time.heroDt).
// Legs face the movement direction (within ±twistMax of the aim) or the aim when idle/backpedalling;
// the upper body always twists toward the mouse ground point. Left mouse (hold) runs the 3-hit
// combo (no damage until Stage 3). Emits 'hitStart' / 'hitEnd' through `onEvent`.
export class Hero {
  constructor() {
    const H = CONFIG.hero;
    this.group = new THREE.Group();
    this.group.name = 'hero';
    this.rig = buildHeroRig();
    this.group.add(this.rig.group);

    this.animator = new Animator(this.rig, heroClips());
    this.base = this.animator.addLayer('base');
    this.upper = this.animator.addLayer('upper', { mask: this.animator.mask(HERO_UPPER_MASK), weight: 0 });
    this.overlay = this.animator.addLayer('overlay', { weight: 0 });
    this.base.setBlend({ idle: 1, run: 0 });

    this.position = this.group.position;
    this.position.set(H.spawn.x, 0, H.spawn.z);
    this.velocity = new THREE.Vector3();
    this.aim = new THREE.Vector3(0, 0, -1);
    this.aimYaw = Math.PI; // face the back of the arena at start
    this.legYaw = Math.PI;
    this.twist = 0;
    this.runBlend = 0;
    this.runDir = 1;
    this.time = 0;
    this.dead = false;
    this.attackSpeed = 1; // playback multiplier (Stage 4 buffs)

    this.combo = { active: false, step: 0, buffered: false, ended: false, sinceEnd: 0 };
    this.attacking = false;
    this.onEvent = null; // (name, clip) — Stage 3 hooks hit detection here

    this.trail = new BladeTrail();
    this.animator.on('hitStart', (clip) => {
      this.trail.start();
      this.onEvent?.('hitStart', clip);
    });
    this.animator.on('hitEnd', (clip) => {
      this.trail.stop();
      this.onEvent?.('hitEnd', clip);
    });

    this.springs = {
      sashFront: new Spring(),
      sashBack: new Spring(),
      sashR: new Spring(),
      sashL: new Spring(),
      pauldronPitch: new Spring(),
      pauldronLift: new Spring(),
    };
    this._prevChestFwd = new THREE.Vector3(0, 0, 1);
    this._prevLegYaw = this.legYaw;
    this.clawTest = null;
    this.bladeTest = null;

    this._wish = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._v1 = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._m = new THREE.Matrix4();
    this._m2 = new THREE.Matrix4();
    this._s = new THREE.Vector3();
    this.group.rotation.y = this.legYaw;
    this.animator.update(0);
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  _startAttack() {
    const A = CONFIG.hero.anim;
    const clip = ATTACKS[this.combo.step];
    this.upper.play(clip, { fade: A.attackFade, speed: this.attackSpeed, onEnd: () => (this.combo.ended = true) });
    this.upper.weightFade = A.attackFade;
    this.combo.active = true;
    this.combo.buffered = false;
    this.combo.ended = false;
    this.attacking = true;
  }

  _endCombo() {
    this.combo.active = false;
    this.combo.sinceEnd = 0;
    this.attacking = false;
    this.trail.stop();
    this.upper.fadeOut(CONFIG.hero.anim.upperFadeOut);
  }

  playHurt() {
    if (this.dead) return;
    this.overlay.play('hurt', { fade: 0.05, onEnd: () => this.overlay.fadeOut(0.12) });
    this.overlay.targetWeight = 0.85;
    this.overlay.weightFade = 0.05;
  }

  playDeath() {
    if (this.dead) return;
    this.dead = true;
    this._endCombo();
    this.overlay.fadeOut(0.1);
    this.base.play('death', { fade: 0.12 });
  }

  revive() {
    this.dead = false;
    this.base.setBlend({ idle: 1, run: 0 });
  }

  // Debug: the claw hand flies out toward the aim and back (proves clawHand / chainAnchor).
  testClaw() {
    if (!this.clawTest) this.clawTest = { t: 0 };
  }

  // Debug: blade segments fan out along an arc and snap back (proves bladeSeg_0..7).
  testBladeSplit() {
    if (!this.bladeTest) this.bladeTest = { t: 0 };
  }

  // ── Update (hero clock) ─────────────────────────────────────────────────
  update(dt, input, cam) {
    if (dt <= 0) return;
    const H = CONFIG.hero;
    const A = H.anim;
    this.time += dt;

    // Movement: screen-relative WASD, slower while attacking.
    let ix = 0;
    let iz = 0;
    if (!this.dead) {
      if (input.isDown('KeyW')) iz += 1;
      if (input.isDown('KeyS')) iz -= 1;
      if (input.isDown('KeyD')) ix += 1;
      if (input.isDown('KeyA')) ix -= 1;
    }
    const wish = this._wish.set(0, 0, 0);
    if (ix !== 0 || iz !== 0) {
      const speed = H.moveSpeed * (this.attacking ? H.attackMoveMul : 1);
      wish.addScaledVector(cam.groundForward, iz).addScaledVector(cam.groundRight, ix).normalize().multiplyScalar(speed);
    }
    const rate = wish.lengthSq() > 0 ? H.accel : H.decel;
    const dv = this._tmp.subVectors(wish, this.velocity);
    const maxStep = rate * dt;
    const len = dv.length();
    if (len > maxStep) dv.multiplyScalar(maxStep / len);
    this.velocity.add(dv);
    this.position.addScaledVector(this.velocity, dt);
    if (clampToArena(this.position, H.radius)) {
      const nx = this.position.x;
      const nz = this.position.z;
      const nl = Math.hypot(nx, nz) || 1;
      const out = (this.velocity.x * nx + this.velocity.z * nz) / nl;
      if (out > 0) {
        this.velocity.x -= (out * nx) / nl;
        this.velocity.z -= (out * nz) / nl;
      }
    }

    // Aim: upper body follows the mouse ground point quickly.
    if (input.groundValid && !this.dead) {
      const dx = input.groundPoint.x - this.position.x;
      const dz = input.groundPoint.z - this.position.z;
      if (dx * dx + dz * dz > 0.04) {
        const target = Math.atan2(dx, dz);
        this.aimYaw += wrap(target - this.aimYaw) * (1 - Math.exp(-A.aimTurnRate * dt));
      }
    }
    this.aim.set(Math.sin(this.aimYaw), 0, Math.cos(this.aimYaw));

    // Legs: toward the movement (within the twist limit) or the aim; backpedal when moving away.
    const speed = this.velocity.length();
    const twistMax = A.twistMaxDeg * DEG;
    let legTarget = this.aimYaw;
    this.runDir = 1;
    if (speed > 0.5) {
      const moveYaw = Math.atan2(this.velocity.x, this.velocity.z);
      const d = wrap(moveYaw - this.aimYaw);
      if (Math.abs(d) > A.backpedalDeg * DEG) this.runDir = -1;
      else legTarget = this.aimYaw + THREE.MathUtils.clamp(d, -twistMax, twistMax);
    }
    this.legYaw += wrap(legTarget - this.legYaw) * (1 - Math.exp(-A.legTurnRate * dt));
    // Never let the twist exceed its limit.
    const tw = wrap(this.aimYaw - this.legYaw);
    if (Math.abs(tw) > twistMax) this.legYaw = this.aimYaw - Math.sign(tw) * twistMax;
    this.twist = wrap(this.aimYaw - this.legYaw);
    this.group.rotation.y = this.legYaw;

    // Combo: hold (or buffered click) chains the 3 steps; resets after a pause.
    if (!this.dead) {
      const pressed = input.wasButtonPressed(0);
      const held = input.isButtonDown(0);
      if (this.combo.active) {
        if (pressed) this.combo.buffered = true;
      } else {
        this.combo.sinceEnd += dt;
        if (this.combo.sinceEnd > H.combo.resetTime) this.combo.step = 0;
        if ((pressed || held) && !this.clawTest) this._startAttack();
      }
    }

    // Locomotion blend.
    if (!this.dead) {
      const w = THREE.MathUtils.clamp(speed / H.moveSpeed, 0, 1);
      this.runBlend += (w - this.runBlend) * (1 - Math.exp(-A.runBlendRate * dt));
      const runSpeed = this.runDir * Math.max(0.55, speed / A.runSpeedRef);
      this.base.setBlend({ idle: 1 - this.runBlend, run: this.runBlend }, { run: runSpeed });
    }

    this.animator.update(dt);

    if (this.combo.ended && !this.dead) {
      this.combo.ended = false;
      this.combo.step = (this.combo.step + 1) % ATTACKS.length;
      if (this.combo.buffered || input.isButtonDown(0)) this._startAttack();
      else this._endCombo();
    }

    this._procedural(dt, speed);
    this.group.updateMatrixWorld(true);
    this._tests(dt);

    // Trail from blade base to tip.
    const B = this.rig.bones;
    const base = B.bladeRoot.localToWorld(this._v1.set(0, 0, H.trail.baseInset));
    const tip = B[`bladeSeg_${HERO_BLADE_SEGMENTS - 1}`].localToWorld(this._v2.set(0, 0, 2 * VOXEL));
    this.trail.update(dt, base, tip);
  }

  // Breathing, lean and bank, upper-body twist, secondary lag on sash panels and pauldrons.
  _procedural(dt, speed) {
    const A = CONFIG.hero.anim;
    const H = CONFIG.hero;
    const anim = this.animator;
    const B = this.rig.bones;
    const breath = Math.sin(this.time * Math.PI * 2 * A.breathRate) * A.breathDeg * DEG;
    anim.addRotation('chest', breath, 0, 0);
    anim.addRotation('shoulderR', 0, 0, breath * 0.6);
    anim.addRotation('shoulderL', 0, 0, -breath * 0.6);

    // Lean into movement (local forward speed) and bank into turns.
    const fwd = (this.velocity.x * Math.sin(this.legYaw) + this.velocity.z * Math.cos(this.legYaw)) / H.moveSpeed;
    const yawRate = wrap(this.legYaw - this._prevLegYaw) / dt;
    this._prevLegYaw = this.legYaw;
    this._lean = (this._lean ?? 0) + (fwd * H.leanDeg * DEG - (this._lean ?? 0)) * (1 - Math.exp(-H.leanRate * dt));
    const bankT = THREE.MathUtils.clamp(-yawRate * 0.15, -1, 1) * A.bankDeg * DEG * Math.min(1, speed / H.moveSpeed);
    this._bank = (this._bank ?? 0) + (bankT - (this._bank ?? 0)) * (1 - Math.exp(-H.leanRate * dt));
    anim.addRotation('pelvis', this._lean, 0, this._bank);

    // Twist toward the aim.
    const [s0, s1, s2] = A.twistSplit;
    anim.addRotation('spine', 0, this.twist * s0, 0);
    anim.addRotation('chest', 0, this.twist * s1, 0);
    anim.addRotation('head', 0, this.twist * s2, 0);

    // Sash panels: pushed by the thighs (no clipping through raised knees) + drag, with spring lag.
    const L = A.sashLag;
    const thighX = (name) => {
      const q = B[name].quaternion;
      return 2 * Math.atan2(q.x, q.w);
    };
    const tR = thighX('thighR');
    const tL = thighX('thighL');
    const drag = -fwd * L.gain * 4;
    const maxS = L.maxDeg * DEG;
    const cl = (v) => THREE.MathUtils.clamp(v, -maxS, maxS);
    const sp = this.springs;
    anim.addRotation('sashFront', sp.sashFront.step(cl(Math.min(tR, tL, 0) * 0.85 + drag), L.stiffness, L.damping, dt), 0, 0);
    anim.addRotation('sashBack', sp.sashBack.step(cl(Math.max(tR, tL, 0) * 0.6 - drag * 0.5), L.stiffness, L.damping, dt), 0, 0);
    anim.addRotation('sashR', sp.sashR.step(cl(tR * 0.5), L.stiffness, L.damping, dt), 0, 0);
    anim.addRotation('sashL', sp.sashL.step(cl(tL * 0.5), L.stiffness, L.damping, dt), 0, 0);

    // Pauldrons lag behind the chest's angular motion.
    const P = A.pauldronLag;
    this.group.updateMatrixWorld(true);
    const fwdNow = this._v1.set(0, 0, 1).transformDirection(B.chest.matrixWorld);
    const cross = this._v2.crossVectors(this._prevChestFwd, fwdNow);
    this._prevChestFwd.copy(fwdNow);
    const maxP = P.maxDeg * DEG;
    const yawVel = THREE.MathUtils.clamp(cross.y / dt, -12, 12);
    const pitchVel = THREE.MathUtils.clamp((cross.x * Math.cos(this.legYaw) - cross.z * Math.sin(this.legYaw)) / dt, -12, 12);
    const tp = (v) => THREE.MathUtils.clamp(v, -maxP, maxP);
    const pitch = sp.pauldronPitch.step(tp(pitchVel * P.gain), P.stiffness, P.damping, dt);
    const lift = sp.pauldronLift.step(tp(Math.abs(yawVel) * P.gain * 0.6), P.stiffness, P.damping, dt);
    anim.addRotation('pauldronR', pitch, 0, -lift);
    anim.addRotation('pauldronL', pitch, 0, lift);
  }

  // Debug node tests, applied on top of the animated pose (hero clock).
  _tests(dt) {
    const B = this.rig.bones;
    if (this.clawTest) {
      const C = CONFIG.debug.clawTest;
      const t = (this.clawTest.t += dt);
      const total = C.out + C.hold + C.back;
      let k;
      if (t < C.out) k = EASE.out(t / C.out);
      else if (t < C.out + C.hold) k = 1;
      else k = 1 - EASE.in(Math.min(1, (t - C.out - C.hold) / C.back));
      const claw = B.clawHand;
      if (!this.clawTest.target) {
        this.clawTest.target = this.position.clone().addScaledVector(this.aim, C.distance).setY(C.height);
      }
      // Attached pose (as animated) → flying pose, blended in world space.
      claw.updateMatrixWorld(true);
      const attached = this._m.copy(claw.matrixWorld);
      const pos = this._v1.setFromMatrixPosition(attached).lerp(this.clawTest.target, k);
      const rot = this._q.setFromRotationMatrix(attached);
      const world = this._m2.compose(pos, rot, this._s.set(1, 1, 1));
      const parentInv = this._m.copy(claw.parent.matrixWorld).invert();
      world.premultiply(parentInv);
      world.decompose(claw.position, claw.quaternion, this._s);
      // Fingers open while flying.
      const open = -40 * DEG * Math.sin(Math.PI * Math.min(1, t / total));
      this.animator.addRotation('clawFinger_0', open, 0, 0);
      this.animator.addRotation('clawFinger_1', open, 0, 0);
      this.animator.addRotation('clawFinger_2', -open, 0, 0);
      claw.updateMatrixWorld(true);
      if (t >= total) this.clawTest = null;
    }
    if (this.bladeTest) {
      const S = CONFIG.debug.bladeSplitTest;
      const t = (this.bladeTest.t += dt);
      const total = S.extend + S.hold + S.retract;
      let k;
      if (t < S.extend) k = EASE.out(t / S.extend);
      else if (t < S.extend + S.hold) k = 1;
      else k = 1 - EASE.in(Math.min(1, (t - S.extend - S.hold) / S.retract));
      const n = HERO_BLADE_SEGMENTS;
      for (let i = 0; i < n; i++) {
        const b = B[`bladeSeg_${i}`];
        const r = this.rig.rest[this.rig.index[b.name]];
        const restZ = r.position.z;
        const u = i / (n - 1);
        const dist = restZ + k * S.gap * (i + 1);
        const ang = k * S.arcDeg * DEG * u * u;
        b.position.set(Math.sin(ang) * dist, r.position.y + k * Math.sin(u * Math.PI) * 0.15, Math.cos(ang) * dist);
        b.quaternion.setFromAxisAngle(this._v1.set(0, 1, 0), ang * 1.1);
      }
      // Click-flash when the segments snap back together.
      const snap = t > total - S.retract * 0.3 ? 1 + 3 * Math.max(0, 1 - (t - (total - S.retract * 0.3)) / 0.12) : 1;
      this.rig.setGlow('blade', snap);
      this.group.updateMatrixWorld(true);
      if (t >= total + 0.12) {
        this.bladeTest = null;
        this.rig.setGlow('blade', 1);
      }
    }
  }
}
