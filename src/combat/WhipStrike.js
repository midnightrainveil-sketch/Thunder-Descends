import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { HERO_BLADE_SEGMENTS, HERO_SEG_LEN_M } from '../voxel/models/HeroModel.js';
import { RibbonTrail } from '../fx/BladeTrail.js';

const _m = new THREE.Matrix4();
const _inv = new THREE.Matrix4();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _s = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const smooth = (u) => u * u * (3 - 2 * u);
const easeOut = (u) => 1 - Math.pow(1 - u, 3);
const easeIn = (u) => u * u * u;
const SEG_LEN = HERO_SEG_LEN_M;

/**
 * Whip strike (passive, spec §6). On a crit the 8 blade segments detach and fly along a curved
 * chain out to `reach`, sweeping `arcDeg` around the hero in `sweep` seconds. The chain is a
 * curve from the sword guard to the tip where every point samples the tip's path with a delay
 * that grows toward the tip — so the hilt leads and each segment trails the one before it, the
 * tip last, curving back toward where the swing has already passed. Segments are
 * linked by crackling lightning, the tip leaves a bright ribbon, then everything retracts in
 * `retract` seconds and snaps back with a flash. Hero clock.
 *
 * The chain frame (origin + facing) is locked at the start so the sweep reads cleanly; the hand
 * end follows the animated sword guard.
 */
export class WhipStrike {
  constructor(hero, fx) {
    this.hero = hero;
    this.fx = fx;
    this.active = false;
    this.t = 0;
    this.dir = 1;
    this.yaw0 = 0;
    this.origin = new THREE.Vector3();
    this.tipAngle = 0; // current tip angle relative to yaw0 (rad)
    this.prevTipAngle = 0;
    this.reachNow = 0;
    this.sweeping = false;
    const n = HERO_BLADE_SEGMENTS;
    this.links = Array.from({ length: n + 1 }, () => new THREE.Vector3()); // chain points (hand + 8 ends)
    this.segPos = Array.from({ length: n }, () => new THREE.Vector3());
    this.segQuat = Array.from({ length: n }, () => new THREE.Quaternion());
    this.frozenPos = Array.from({ length: n }, () => new THREE.Vector3());
    this.frozenQuat = Array.from({ length: n }, () => new THREE.Quaternion());
    this.tipTrail = new RibbonTrail({ ...CONFIG.whip.tipTrail, baseAlpha: 0.15 });
    this.tip = new THREE.Vector3();
    this._hand = new THREE.Vector3();
    this._tipInner = new THREE.Vector3();
    this.onSnap = null;
  }

  get mesh() {
    return this.tipTrail.mesh;
  }

  // dir = +1 sweeps from the hero's right to his left, −1 the reverse.
  start(dir = 1) {
    const W = CONFIG.whip;
    this.active = true;
    this.sweeping = true;
    this.retracting = false;
    this.t = 0;
    this.dir = dir;
    this.yaw0 = this.hero.aimYaw;
    this.origin.copy(this.hero.position);
    this.tipAngle = this.prevTipAngle = this._angleAt(0);
    this.tipTrail.clear();
    this.tipTrail.start();
    this.fx.slashes.spawn({
      pos: _p.set(this.origin.x, W.height + 0.05, this.origin.z),
      yaw: this.yaw0, radius: W.reach + this.hero.whipReachBonus + 0.15, thickness: 0.9, arcDeg: W.arcDeg, dir,
      color: '#3fd8ff', intensity: 0.85, sweep: W.sweep, hold: 0.02, fade: 0.2,
    });
  }

  cancel() {
    if (!this.active) return;
    this.active = false;
    this.sweeping = this.retracting = false;
    this.tipTrail.stop();
    this.hero.rig.setGlow('blade', 1);
    for (let i = 0; i < HERO_BLADE_SEGMENTS; i++) this.hero.rig.bones[`bladeSeg_${i}`].scale.set(this.hero.bladeThick, this.hero.bladeThick, 1);
  }

  _angleAt(t) {
    const W = CONFIG.whip;
    const half = (W.arcDeg * Math.PI) / 360;
    const u = THREE.MathUtils.clamp(t / W.sweep, 0, 1);
    // Whip timing: slow while it unfurls, fast through the middle, easing at the end.
    const e = smooth(Math.pow(u, 0.85));
    return this.dir * (-half + 2 * half * e);
  }

  _radiusAt(t) {
    const W = CONFIG.whip;
    const bladeLen = HERO_BLADE_SEGMENTS * SEG_LEN + 0.3;
    return bladeLen + (W.reach + this.hero.whipReachBonus - bladeLen) * easeOut(THREE.MathUtils.clamp(t / W.extend, 0, 1));
  }

  _segScale(t) {
    const W = CONFIG.whip;
    return 1 + (W.segScale - 1) * easeOut(THREE.MathUtils.clamp(t / W.extend, 0, 1));
  }

  // Chain point at fraction f (0 = hand, 1 = tip) for chain time t.
  _chainPoint(f, t, out) {
    const W = CONFIG.whip;
    // The hand end leads and the tip trails: points nearer the hand sample the sweep ahead in
    // time, so the chain curves back from the hilt toward where the tip has already been.
    const tf = t + W.lag * (1 - f) * (1 - f * 0.3);
    const ang = this.yaw0 + this._angleAt(tf);
    const r0 = 0.55;
    const r = r0 + (this._radiusAt(tf) - r0) * Math.pow(f, 0.8);
    out.set(this.origin.x + Math.sin(ang) * r, 0, this.origin.z + Math.cos(ang) * r);
    const wave = W.sag * Math.sin(Math.PI * f) * Math.sin(7 * f - 26 * t);
    out.y = THREE.MathUtils.lerp(this._hand.y, W.height, Math.min(1, f * 1.6)) + wave;
    // Near the hand, blend into the real sword guard so the chain leaves the hilt.
    const w = Math.pow(1 - f, 4);
    out.x += (this._hand.x - out.x) * w;
    out.z += (this._hand.z - out.z) * w;
    return out;
  }

  // Call after the hero's animator + matrices update (hero clock).
  update(dt) {
    if (!this.active) return;
    const W = CONFIG.whip;
    const rig = this.hero.rig;
    const B = rig.bones;
    const n = HERO_BLADE_SEGMENTS;
    this.t += dt;
    B.bladeRoot.getWorldPosition(this._hand);
    this.origin.x = this.hero.position.x;
    this.origin.z = this.hero.position.z;

    const tSweep = Math.min(this.t, W.sweep);
    if (this.sweeping) {
      this.prevTipAngle = this.tipAngle;
      this.tipAngle = this._angleAt(tSweep);
      this.reachNow = this._radiusAt(tSweep);
      // Chain points and segment transforms.
      this.links[0].copy(this._hand);
      for (let i = 0; i < n; i++) this._chainPoint((i + 1) / n, tSweep, this.links[i + 1]);
      for (let i = 0; i < n; i++) {
        const end = this.links[i + 1];
        _z.subVectors(end, this.links[i]).normalize();
        _x.crossVectors(_up, _z).normalize();
        _y.crossVectors(_z, _x);
        this.segQuat[i].setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
        this.segPos[i].copy(end).addScaledVector(_z, -SEG_LEN * this._segScale(tSweep)); // pivot at the segment start
      }
      this.tip.copy(this.links[n]);
      this._tipInner.copy(this.links[n]).addScaledVector(_z, -W.tipTrail.inner);
      if (this.t >= W.sweep) {
        this.sweeping = false;
        this.retracting = true;
        this.tipTrail.stop();
        for (let i = 0; i < n; i++) {
          this.frozenPos[i].copy(this.segPos[i]);
          this.frozenQuat[i].copy(this.segQuat[i]);
        }
      }
    }

    let k = 0;
    if (this.retracting) {
      k = easeIn(Math.min(1, (this.t - W.sweep) / W.retract));
    }
    const sc = this.sweeping ? this._segScale(tSweep) : W.segScale + (1 - W.segScale) * k;
    if (this.sweeping || this.retracting) rig.setGlow('blade', 1 + (W.bladeGlow - 1) * (this.sweeping ? 1 : 1 - k));
    // Apply: world transform (lerped toward the attached pose while retracting) → bone local.
    rig.group.updateMatrixWorld(true);
    _inv.copy(B.bladeRoot.matrixWorld).invert();
    for (let i = 0; i < n; i++) {
      const b = B[`bladeSeg_${i}`];
      if (this.retracting) {
        b.scale.setScalar(1);
        b.updateMatrixWorld(true); // attached (animated) pose
        _m.copy(b.matrixWorld);
        _p.setFromMatrixPosition(_m);
        _q.setFromRotationMatrix(_m);
        _p.lerpVectors(this.frozenPos[i], _p, k);
        _q.slerpQuaternions(this.frozenQuat[i], _q, k);
      } else {
        _p.copy(this.segPos[i]);
        _q.copy(this.segQuat[i]);
      }
      const th = this.hero.bladeThick;
      _m.compose(_p, _q, _s.set(sc * th, sc * th, sc)).premultiply(_inv);
      _m.decompose(b.position, b.quaternion, b.scale);
    }
    rig.group.updateMatrixWorld(true);

    // Lightning links between segments (re-rolled every frame, short life so they crackle).
    const L = this.fx.lightning;
    if (this.sweeping || k < 0.85) {
      for (let i = 0; i < n; i++) {
        const segStart = B[`bladeSeg_${i}`].getWorldPosition(_p);
        const prevEnd = i === 0 ? this._hand : B[`bladeSeg_${i - 1}`].localToWorld(_y.set(0, 0, SEG_LEN));
        if (prevEnd.distanceToSquared(segStart) > 0.01) {
          L.bolt(prevEnd, segStart, { life: 0.05, width: W.linkWidth * (this.sweeping ? 1 : 1 - k), jitter: 0.2, intensity: W.linkIntensity });
        }
      }
    }
    if (this.sweeping) {
      this.tipTrail.update(dt, this._tipInner, this.tip);
      if (Math.random() < 0.5) this.fx.particles.sparks(this.tip, null, 1, { speed: 3, life: 0.2, size: 0.04, clock: 'hero' });
    } else {
      this.tipTrail.update(dt, this._tipInner, this.tip);
    }

    // Snap back with a click-flash.
    if (this.retracting && this.t >= W.sweep + W.retract) {
      this.retracting = false;
      this.snapT = 0;
      for (let i = 0; i < n; i++) B[`bladeSeg_${i}`].scale.set(this.hero.bladeThick, this.hero.bladeThick, 1);
      const mid = B[`bladeSeg_${n >> 1}`].getWorldPosition(_p);
      this.fx.particles.hitStar(mid, { color: '#bff6ff', intensity: 4, rays: 6, speed: 7, size: 0.04, life: 0.12, clock: 'hero' });
      this.onSnap?.();
    }
    if (!this.sweeping && !this.retracting) {
      this.snapT += dt;
      const f = Math.max(0, 1 - this.snapT / 0.12);
      rig.setGlow('blade', this.hero.bladeGlowBase + (W.snapFlash - 1) * f);
      if (f <= 0) this.active = false;
    }
  }
}
