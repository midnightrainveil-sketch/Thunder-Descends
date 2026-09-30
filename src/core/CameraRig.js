import * as THREE from 'three';
import { CONFIG, ARENA_RADIUS } from '../config.js';

const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);

// Fixed cinematic camera (spec §2).
// Pose = elevation + yaw around the target. Distance is auto-fit so the arena circle
// (plus margin, character height at the back, foundation drop at the front) fits the
// viewport at any aspect. Framing uses a lens shift (off-axis projection) so the arena
// can sit low in the frame with headroom above it without changing the viewing angle.
// Only shake and zoom punches move it; it always returns to the fixed pose.
export class CameraRig {
  constructor() {
    const C = CONFIG.camera;
    this.camera = new THREE.PerspectiveCamera(C.fov, 1, C.near, C.far); // rendered (shake/punch applied)
    this.pickCamera = new THREE.PerspectiveCamera(C.fov, 1, C.near, C.far); // base pose, for mouse picking
    this.aspect = 1;

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
    this.groundForward.set(this.forward.x, 0, this.forward.z).normalize();
    this.groundRight.crossVectors(this.groundForward, UP).normalize();

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
    this.shiftX = -cx;
    this.shiftY = bandCenter - cy;

    this.basePosition.copy(this.target).addScaledVector(toCam, this.distance);
    const m = new THREE.Matrix4().lookAt(this.basePosition, this.target, UP);
    this.baseQuaternion.setFromRotationMatrix(m);

    for (const cam of [this.pickCamera, this.camera]) {
      cam.near = C.near;
      cam.far = C.far;
      cam.position.copy(this.basePosition);
      cam.quaternion.copy(this.baseQuaternion);
      this._applyProjection(cam, C.fov);
      cam.updateMatrixWorld(true);
    }
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
    let fov = C.fov;
    if (p.active) {
      p.t += realDt;
      if (p.t >= p.duration) p.active = false;
      else fov = C.fov * (1 - p.amount * this._punchEnvelope());
    }

    // Shake
    this.trauma = Math.max(0, this.trauma - this._traumaDecay * realDt);
    if (this.trauma === 0) this._traumaDecay = 0;
    this._shakeTime += realDt * C.shake.frequency;
    const s = Math.pow(this.trauma, C.shake.exponent);
    const t = this._shakeTime;
    const ox = s * C.shake.maxOffset * noise1(t, 0.0);
    const oy = s * C.shake.maxOffset * noise1(t, 17.3);
    const roll = s * C.shake.maxRollDeg * DEG * noise1(t, 41.7);

    cam.position.copy(this.basePosition).addScaledVector(this.right, ox).addScaledVector(this.up, oy);
    cam.quaternion.copy(this.baseQuaternion);
    if (roll !== 0) cam.rotateZ(roll);
    this._applyProjection(cam, fov);
    cam.updateMatrixWorld(true);
  }

  // Camera used for rendering (debug orbit camera overrides the fixed one).
  get activeCamera() {
    return this.override || this.camera;
  }

  // Camera used for mouse picking (unshaken fixed pose, or the orbit camera).
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
