import * as THREE from 'three';
import { CONFIG, ARENA_RADIUS } from '../config.js';

const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Two poses, blended:
// • Fixed cinematic pose (spec §2): elevation + yaw around the target. Distance is auto-fit so
//   the arena circle (plus margin, character height at the back, foundation drop at the front)
//   fits the viewport at any aspect, with a lens shift (off-axis projection) so the arena sits
//   low in the frame with headroom above it. It frames the title screen and is the reference
//   the map composition (moon, pagoda, canopy check) is placed with (`compositionCamera`).
// • Third-person follow pose: a boom behind the hero's back, turned 1:1 by mouse look (pointer
//   lock) or ← →. The boom shortens along the view ray so the camera never leaves
//   `follow.boundRadius`; the view direction itself is only ever set by the player. The aim ray
//   goes through the screen center.
// Shake and zoom punches are applied on top of whichever pose is active (real time).
export class CameraRig {
  constructor() {
    const C = CONFIG.camera;
    this.camera = new THREE.PerspectiveCamera(C.fov, 1, C.near, C.far); // rendered (shake/punch applied)
    this.pickCamera = new THREE.PerspectiveCamera(C.fov, 1, C.near, C.far); // base pose, for mouse picking
    this.compositionCamera = new THREE.PerspectiveCamera(C.fov, 1, C.near, C.far); // fixed pose, for map layout
    this.aspect = 1;

    // Fixed pose (from fit()).
    this.fixedPosition = new THREE.Vector3();
    this.fixedQuaternion = new THREE.Quaternion();
    this.fixedShiftX = 0;
    this.fixedShiftY = 0;

    // Follow pose state.
    const F = C.follow;
    this.followWanted = false; // game: in play and mode === 'follow'
    this.blend = 0; // 0 = fixed pose, 1 = follow pose
    this.yaw = Math.PI; // follow look direction on XZ (atan2(x, z)); π looks toward −Z like the fixed camera
    this.pitch = F.pitchDeg * DEG;
    this.yawT = this.yaw; // mouse-look targets; yaw / pitch follow them with light smoothing
    this.pitchT = this.pitch;
    // Skill aiming (Storm Grapple): vertical mouse moves the target along the ground instead of
    // pitching the camera, so the aim point slides linearly and never jumps to the horizon.
    this.skillAim = false;
    this.skillAimDist = 6;
    this.skillAimMax = 9;
    this.skillAimPoint = new THREE.Vector3();
    this.pivot = new THREE.Vector3();
    this.followPosition = new THREE.Vector3();
    this.followQuaternion = new THREE.Quaternion();
    this.zoom = F.distance; // current boom length before the bound (eases to F.distance)
    this.boom = F.distance; // boom length actually used this frame
    // Cinematic shot (Zero Hour cast): blends the boom to a front-side close-up of the hero.
    this.cineWanted = false;
    this.cineK = 0;
    this.fov = C.fov; // current base FOV (blended)
    this._pivotReady = false;
    this._m = new THREE.Matrix4();
    this._lookAt = new THREE.Vector3();

    this.distance = 40;
    this.basePosition = new THREE.Vector3();
    this.baseQuaternion = new THREE.Quaternion();
    this.target = new THREE.Vector3();
    this.shiftX = 0; // NDC lens shift
    this.shiftY = 0;
    this.forward = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.up = new THREE.Vector3();
    this.groundForward = new THREE.Vector3(); // camera forward projected on XZ (W direction)
    this.groundRight = new THREE.Vector3();

    // Shake (trauma based) and punch state.
    this.trauma = 0;
    this._traumaDecay = 0;
    this._shakeTime = 0;
    this._punch = { amount: 0, duration: 0, t: 0, active: false };

    this.override = null; // debug orbit camera, when active

    this._tmp = new THREE.Vector3();
    this._samples = [];
  }

  resize(width, height) {
    this.aspect = Math.max(width, 1) / Math.max(height, 1);
    this.fit();
  }

  // Recompute distance + lens shift from config (call after editing camera config).
  fit() {
    const C = CONFIG.camera;
    const el = C.elevationDeg * DEG;
    const yaw = C.yawDeg * DEG;
    this.target.set(C.target.x, C.target.y, C.target.z);

    // Unit vector from target toward the camera. yaw 0 → camera on +Z (front).
    const toCam = new THREE.Vector3(Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el));
    this.forward.copy(toCam).negate();
    this.right.crossVectors(this.forward, UP).normalize();
    this.up.crossVectors(this.right, this.forward).normalize();

    // Sample points that must stay in frame.
    const pts = this._buildSamples();
    const tanY = Math.tan((C.fov * DEG) / 2);
    const tanX = tanY * this.aspect;
    const availW = 2 * tanX * (1 - 2 * C.sidePad);
    const availH = 2 * tanY * (1 - C.headroomTop - C.bottomPad);

    const bounds = { xmin: 0, xmax: 0, ymin: 0, ymax: 0 };
    const measure = (d) => {
      const cam = this._tmp.copy(this.target).addScaledVector(toCam, d);
      let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
      for (const p of pts) {
        const vx = p.x - cam.x, vy = p.y - cam.y, vz = p.z - cam.z;
        const z = vx * this.forward.x + vy * this.forward.y + vz * this.forward.z;
        if (z <= 0.01) return null; // point behind the camera → too close
        const x = (vx * this.right.x + vy * this.right.y + vz * this.right.z) / z;
        const y = (vx * this.up.x + vy * this.up.y + vz * this.up.z) / z;
        if (x < xmin) xmin = x;
        if (x > xmax) xmax = x;
        if (y < ymin) ymin = y;
        if (y > ymax) ymax = y;
      }
      bounds.xmin = xmin; bounds.xmax = xmax; bounds.ymin = ymin; bounds.ymax = ymax;
      return bounds;
    };
    const fits = (d) => {
      const b = measure(d);
      return b !== null && b.xmax - b.xmin <= availW && b.ymax - b.ymin <= availH;
    };

    // Extents shrink monotonically with distance → binary search the closest fit.
    let lo = 1, hi = 2000;
    for (let i = 0; i < 48; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    this.distance = hi;
    const b = measure(hi);

    // Lens shift: center horizontally; vertically center within the band below the headroom.
    const cx = (b.xmin + b.xmax) / 2 / tanX;
    const cy = (b.ymin + b.ymax) / 2 / tanY;
    const bandCenter = (-1 + 2 * C.bottomPad + (1 - 2 * C.headroomTop)) / 2;
    this.fixedShiftX = -cx;
    this.fixedShiftY = bandCenter - cy;

    this.fixedPosition.copy(this.target).addScaledVector(toCam, this.distance);
    const m = new THREE.Matrix4().lookAt(this.fixedPosition, this.target, UP);
    this.fixedQuaternion.setFromRotationMatrix(m);

    const cc = this.compositionCamera;
    cc.near = C.near;
    cc.far = C.far;
    cc.position.copy(this.fixedPosition);
    cc.quaternion.copy(this.fixedQuaternion);
    this.shiftX = this.fixedShiftX;
    this.shiftY = this.fixedShiftY;
    this._applyProjection(cc, C.fov);
    cc.updateMatrixWorld(true);

    this._compose();
    for (const cam of [this.pickCamera, this.camera]) {
      cam.near = C.near;
      cam.far = C.far;
      cam.position.copy(this.basePosition);
      cam.quaternion.copy(this.baseQuaternion);
      this._applyProjection(cam, this.fov);
      cam.updateMatrixWorld(true);
    }
  }

  // ── Follow camera ───────────────────────────────────────────────────────
  get following() {
    return this.followWanted && this.blend > 0.5;
  }

  // Cinematic close-up on/off (blends in/out on real time; mouse look is ignored while it runs).
  cinematic(on) {
    this.cineWanted = !!on;
  }

  // Skill aim on/off. `startPoint` (the current aim point) seeds the distance.
  beginSkillAim(hero, maxDist, startPoint) {
    const F = CONFIG.camera.follow;
    this.skillAim = true;
    this.skillAimMax = maxDist;
    const d = startPoint ? Math.hypot(startPoint.x - hero.position.x, startPoint.z - hero.position.z) : maxDist * 0.6;
    this.skillAimDist = THREE.MathUtils.clamp(d, F.aimMinDist, maxDist);
  }

  endSkillAim() {
    this.skillAim = false;
  }

  // Put the boom straight behind the hero now (run start / retry).
  snapBehind(hero) {
    this.yaw = this.yawT = hero.aimYaw;
    this.pitch = this.pitchT = CONFIG.camera.follow.pitchDeg * DEG;
    this.skillAim = false;
    this.pivot.copy(hero.position);
    this._pivotReady = true;
    this.zoom = CONFIG.camera.follow.distance;
    this.cineWanted = false;
    this.cineK = 0;
  }

  /**
   * Real time, before input picking: mouse look / arrow keys turn the boom, the pivot chases
   * the hero, the boom is pulled in at the rim, then fixed and follow poses are blended into
   * the base pose (pickCamera) and the ground axes the hero's WASD uses.
   */
  follow(realDt, hero, input, allowLook) {
    const C = CONFIG.camera;
    const F = C.follow;
    const dt = Math.min(realDt, 0.1);

    // Cinematic blend.
    const CC = C.cine;
    const cineTarget = this.cineWanted ? 1 : 0;
    const cineStep = dt / Math.max(this.cineWanted ? CC.blendIn : CC.blendOut, 1e-3);
    this.cineK = cineTarget > this.cineK ? Math.min(1, this.cineK + cineStep) : Math.max(0, this.cineK - cineStep);
    const ck = this.cineK * this.cineK * (3 - 2 * this.cineK); // smoothstep

    // Look: every mouse count turns the view by exactly `sensitivity` radians, on both axes, at
    // every spot in the arena. Nothing else ever rotates the player's view (no recentering, no
    // rim tilt); during the Zero Hour close-up the input still lands, the shot just covers it.
    if (allowLook && this.followWanted) {
      if (input.wheel) {
        F.distance = THREE.MathUtils.clamp(F.distance * Math.pow(1 + F.zoomStep, input.wheel), F.zoomMin, F.zoomMax);
        this.onZoom?.(F.distance);
      }
      const dx = input.lookDX;
      const dy = input.lookDY * (F.invertY ? -1 : 1);
      this.yawT -= dx * F.sensitivity;
      // Skill aiming (Storm Grapple): vertical slides the target along the ground instead.
      if (this.skillAim) this.skillAimDist = THREE.MathUtils.clamp(this.skillAimDist - dy * F.aimDistPerPx, F.aimMinDist, this.skillAimMax);
      else this.pitchT += dy * F.sensitivity;
      let k = 0;
      if (input.isDown('ArrowLeft')) k += 1;
      if (input.isDown('ArrowRight')) k -= 1;
      this.yawT += k * F.keyTurnRate * dt;
    }
    // Clamp the target itself, so reversing at a limit responds on the very next count.
    this.pitchT = THREE.MathUtils.clamp(this.pitchT, F.pitchMinDeg * DEG, F.pitchMaxDeg * DEG);
    if (F.lookSmoothing > 0) {
      // Optional (pause menu), off by default.
      const sk = 1 - Math.exp(-dt / F.lookSmoothing);
      this.yaw += (this.yawT - this.yaw) * sk;
      this.pitch += (this.pitchT - this.pitch) * sk;
    } else {
      this.yaw = this.yawT;
      this.pitch = this.pitchT;
    }
    // Keep both angles small without changing their difference.
    if (Math.abs(this.yaw) > Math.PI * 4) {
      const w = wrap(this.yaw) - this.yaw;
      this.yaw += w;
      this.yawT += w;
    }

    // Zoom eases (distance only); the pivot chases the hero.
    this.zoom += (F.distance - this.zoom) * (1 - Math.exp(-F.zoomRate * dt));
    if (!this._pivotReady) {
      this.pivot.copy(hero.position);
      this._pivotReady = true;
    }
    this.pivot.lerp(hero.position, 1 - Math.exp(-F.followRate * dt));

    // Boom parameters: the player's camera, blended toward the cinematic shot (camera in front of
    // the hero, off to his sword side, looking back at him and the ground in front).
    let yaw = this.yaw, pitch = this.pitch, distance = this.zoom, height = F.height, shoulder = F.shoulder;
    if (ck > 0) {
      const cineYaw = hero.aimYaw + Math.PI + CC.sideDeg * DEG;
      yaw = this.yaw + wrap(cineYaw - this.yaw) * ck;
      pitch = THREE.MathUtils.lerp(this.pitch, CC.pitchDeg * DEG, ck);
      distance = THREE.MathUtils.lerp(this.zoom, CC.distance, ck);
      height = THREE.MathUtils.lerp(F.height, CC.height, ck);
      shoulder = THREE.MathUtils.lerp(F.shoulder, 0, ck);
    }

    // Boom: the camera sits on the view ray behind the pivot, so the view direction is always
    // exactly (yaw, pitch). Where the full boom would leave `boundRadius` (past the rim, into the
    // trees / torii) or dip under `minHeight` (looking up), the boom shortens along that same ray,
    // like a collision camera — the position moves, the aim never does.
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    const fx = sy * cp, fy = -sp, fz = cy * cp; // view direction
    const rx = -cy, rz = sy; // camera right on XZ
    const px = this.pivot.x + rx * shoulder;
    const pz = this.pivot.z + rz * shoulder;
    const py = this.pivot.y + height;
    let L = distance;
    const a = fx * fx + fz * fz;
    if (a > 1e-6) {
      // |P − f·L|² = R² on XZ → a·L² − 2(P·f)·L + |P|² − R² = 0, larger root.
      const R = F.boundRadius;
      const b = px * fx + pz * fz;
      const c = px * px + pz * pz - R * R;
      const disc = b * b - a * c;
      if (disc >= 0) L = Math.min(L, (b + Math.sqrt(disc)) / a);
    }
    if (fy > 1e-4) L = Math.min(L, (py - F.minHeight) / fy); // looking up: the camera goes down
    L = Math.max(L, F.minBoom);
    this.boom = L;
    this.followPosition.set(px - fx * L, Math.max(F.minHeight, py - fy * L), pz - fz * L);
    this._lookAt.set(this.followPosition.x + fx, this.followPosition.y + fy, this.followPosition.z + fz);
    this._m.lookAt(this.followPosition, this._lookAt, UP);
    this.followQuaternion.setFromRotationMatrix(this._m);

    // Skill aim point: on the screen-center line (pivot + shoulder), skillAimDist ahead of the hero.
    if (this.skillAim) {
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      this.skillAimPoint.set(hero.position.x + rx * F.shoulder + fx * this.skillAimDist, 0, hero.position.z + rz * F.shoulder + fz * this.skillAimDist);
    }

    // Blend.
    const want = this.followWanted ? 1 : 0;
    const step = dt / Math.max(F.blendTime, 1e-3);
    this.blend = want > this.blend ? Math.min(want, this.blend + step) : Math.max(want, this.blend - step);
    this._compose();
    const pc = this.pickCamera;
    pc.position.copy(this.basePosition);
    pc.quaternion.copy(this.baseQuaternion);
    this._applyProjection(pc, this.fov);
    pc.updateMatrixWorld(true);
  }

  // Blend fixed and follow poses into the base pose + the axes derived from it.
  _compose() {
    const C = CONFIG.camera;
    const b = this.blend;
    const e = b * b * (3 - 2 * b); // smoothstep
    if (e <= 0) {
      this.basePosition.copy(this.fixedPosition);
      this.baseQuaternion.copy(this.fixedQuaternion);
    } else {
      this.basePosition.lerpVectors(this.fixedPosition, this.followPosition, e);
      this.baseQuaternion.slerpQuaternions(this.fixedQuaternion, this.followQuaternion, e);
    }
    this.fov = THREE.MathUtils.lerp(C.fov, C.follow.fov, e);
    this.shiftX = this.fixedShiftX * (1 - e);
    this.shiftY = this.fixedShiftY * (1 - e);
    this.forward.set(0, 0, -1).applyQuaternion(this.baseQuaternion);
    this.right.set(1, 0, 0).applyQuaternion(this.baseQuaternion);
    this.up.set(0, 1, 0).applyQuaternion(this.baseQuaternion);
    // WASD axes: the follow yaw once it dominates (steady while looking up/down), else the view.
    if (e > 0.5) this.groundForward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    else this.groundForward.set(this.forward.x, 0, this.forward.z).normalize();
    this.groundRight.crossVectors(this.groundForward, UP).normalize();
  }

  _buildSamples() {
    const C = CONFIG.camera;
    const n = C.fitSamples;
    const r = ARENA_RADIUS + C.fitMargin;
    while (this._samples.length < n * 3) this._samples.push(new THREE.Vector3());
    let k = 0;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const sx = Math.sin(a);
      const cz = Math.cos(a);
      this._samples[k++].set(sx * r, 0, cz * r); // arena circle + margin on the floor
      this._samples[k++].set(sx * ARENA_RADIUS, C.fitHeight, cz * ARENA_RADIUS); // character standing on the rim
      this._samples[k++].set(sx * ARENA_RADIUS, -C.fitDepth, cz * ARENA_RADIUS); // foundation drop below the rim
    }
    return this._samples.slice(0, k);
  }

  _applyProjection(cam, fov) {
    cam.fov = fov;
    cam.aspect = this.aspect;
    cam.updateProjectionMatrix();
    // ndc = P·v / -z → adding to elements[8]/[9] shifts NDC by the negative amount.
    cam.projectionMatrix.elements[8] -= this.shiftX;
    cam.projectionMatrix.elements[9] -= this.shiftY;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }

  // Trauma-based shake. intensity 0..1 adds trauma; it decays to 0 over ~duration seconds.
  // Overlapping shakes are capped (perHitCap per call, maxTrauma total); the pause menu can turn it off.
  shake(intensity, duration = 0.3) {
    const S = CONFIG.camera.shake;
    if (!S.enabled) return;
    this.trauma = Math.min(S.maxTrauma, this.trauma + Math.min(intensity, S.perHitCap));
    this._traumaDecay = Math.max(this._traumaDecay, this.trauma / Math.max(duration, 1e-3));
  }

  // Short zoom punch: amount = fractional FOV reduction at peak (e.g. 0.06), duration in seconds.
  punch(zoomAmount, duration = 0.25) {
    const p = this._punch;
    // Keep the stronger of an active punch and the new one.
    if (p.active && p.amount * this._punchEnvelope() > zoomAmount) return;
    p.amount = zoomAmount;
    p.duration = Math.max(duration, 1e-3);
    p.t = 0;
    p.active = true;
  }

  _punchEnvelope() {
    const p = this._punch;
    if (!p.active) return 0;
    const k = p.t / p.duration;
    const a = CONFIG.camera.punch.attack;
    if (k < a) {
      const u = k / a;
      return 1 - (1 - u) * (1 - u); // ease-out in
    }
    const u = (k - a) / (1 - a);
    const r = 1 - Math.min(u, 1);
    return r * r; // ease back to rest
  }

  // Real-time update: shake and punch never freeze with game clocks.
  update(realDt) {
    const C = CONFIG.camera;
    const cam = this.camera;

    // Punch
    const p = this._punch;
    let fov = this.fov;
    if (p.active) {
      p.t += realDt;
      if (p.t >= p.duration) p.active = false;
      else fov = this.fov * (1 - p.amount * this._punchEnvelope());
    }

    // Shake
    this.trauma = Math.max(0, this.trauma - this._traumaDecay * realDt);
    if (this.trauma === 0) this._traumaDecay = 0;
    this._shakeTime += realDt * C.shake.frequency;
    const s = Math.pow(this.trauma, C.shake.exponent);
    const t = this._shakeTime;
    // Close to the hero the follow camera needs far less offset for the same feel.
    const near = THREE.MathUtils.lerp(1, C.follow.distance / Math.max(this.distance, 1), this.blend);
    const ox = s * C.shake.maxOffset * near * noise1(t, 0.0);
    const oy = s * C.shake.maxOffset * near * noise1(t, 17.3);
    const roll = s * C.shake.maxRollDeg * DEG * noise1(t, 41.7);

    cam.position.copy(this.basePosition).addScaledVector(this.right, ox).addScaledVector(this.up, oy);
    cam.quaternion.copy(this.baseQuaternion);
    if (roll !== 0) cam.rotateZ(roll);
    this._applyProjection(cam, fov);
    cam.updateMatrixWorld(true);
  }

  // Camera used for rendering (debug orbit camera overrides the rig).
  get activeCamera() {
    return this.override || this.camera;
  }

  // Camera used for mouse picking (unshaken base pose, or the orbit camera).
  get activePickCamera() {
    return this.override || this.pickCamera;
  }
}

// Smooth pseudo-noise in [-1, 1] built from incommensurate sines.
function noise1(t, seed) {
  return (
    Math.sin(t * 1.0 + seed) * 0.5 +
    Math.sin(t * 2.31 + seed * 1.7) * 0.3 +
    Math.sin(t * 4.13 + seed * 2.9) * 0.2
  );
}
