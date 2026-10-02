import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Keyboard + mouse state with per-frame pressed/released edges.
// Keys use KeyboardEvent.code ('KeyW', 'Space', 'Backquote', ...).
// Mouse buttons: 0 = left, 1 = middle, 2 = right.
export class Input {
  constructor(element) {
    this.element = element;

    this.keysDown = new Set();
    this.keysPressed = new Set();
    this.keysReleased = new Set();

    this.buttonsDown = new Set();
    this.buttonsPressed = new Set();
    this.buttonsReleased = new Set();

    this.mouse = new THREE.Vector2(); // screen px, relative to the element
    this.mouseNdc = new THREE.Vector2(); // -1..1
    this.mouseInside = false;
    this.groundPoint = new THREE.Vector3(); // mouse ray ∩ y = 0 plane
    this.groundValid = false;

    // Mouse look (pointer lock): movement accumulated since the last frame.
    this.lookDX = 0;
    this.lookDY = 0;
    this.wheel = 0; // accumulated wheel steps since the last frame (+ = scroll down / zoom out)
    this.locked = false;
    this.onLockChange = null; // (locked) => void
    this.wantLock = null; // () => bool, game decides when a click should grab the pointer
    this.onLockError = null; // () => void, the browser refused a lock request
    this.centerAim = false; // follow camera: aim through the screen center instead of the cursor
    this.fixedAim = null; // Vector3 set by the camera rig while a skill is being aimed
    // Mouse-look filter state (see look()) and live stats for the debug readout.
    this.mouseStats = { events: 0, dropped: 0, straightened: 0, raw: false, guard: false, bias: 0 };
    this._driftWin = [];
    this._resetLook();

    this._raycaster = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._ndc = new THREE.Vector2();

    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (isTextField(e.target)) return;
      if (!e.repeat) this.keysPressed.add(e.code);
      this.keysDown.add(e.code);
      // Keep game keys from scrolling/focusing browser UI.
      if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      if (this.keysDown.has(e.code)) this.keysReleased.add(e.code);
      this.keysDown.delete(e.code);
    });

    const el = this.element;
    el.addEventListener('mousedown', (e) => {
      // Re-lock on click during play (a real user gesture, so the browser allows it).
      if (!this.locked && this.wantLock?.()) this.requestLock();
      this.buttonsPressed.add(e.button);
      this.buttonsDown.add(e.button);
      this._setMouse(e);
    });
    window.addEventListener('mouseup', (e) => {
      if (this.buttonsDown.has(e.button)) this.buttonsReleased.add(e.button);
      this.buttonsDown.delete(e.button);
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) {
        this._setMouse(e);
        return;
      }
      this.look(e.movementX, e.movementY, e.timeStamp);
    });
    document.addEventListener('pointerlockerror', () => this.onLockError?.());
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === this.element;
      if (this.locked) {
        this.mouseInside = true;
        this._resetLook();
        this._skipLook = 1; // the first event can carry the cursor's jump to the lock point
      } else this.mouseStats.raw = false;
      if (was !== this.locked) this.onLockChange?.(this.locked);
    });
    el.addEventListener('mouseenter', () => (this.mouseInside = true));
    el.addEventListener('mouseleave', () => (this.mouseInside = false));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        // Lines / pages / pixels → roughly one step per notch on every OS.
        const unit = e.deltaMode === 1 ? 1 / 3 : e.deltaMode === 2 ? 3 : 1 / 100;
        this.wheel += Math.max(-3, Math.min(3, e.deltaY * unit));
      },
      { passive: false },
    );

    // Focus loss clears everything held so nothing sticks.
    window.addEventListener('blur', () => this.clearHeld());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clearHeld();
    });
  }

  _setMouse(e) {
    const r = this.element.getBoundingClientRect();
    this.mouse.set(e.clientX - r.left, e.clientY - r.top);
    this.mouseNdc.set((this.mouse.x / r.width) * 2 - 1, -(this.mouse.y / r.height) * 2 + 1);
    this.mouseInside =
      this.mouse.x >= 0 && this.mouse.y >= 0 && this.mouse.x <= r.width && this.mouse.y <= r.height;
  }

  clearHeld() {
    for (const k of this.keysDown) this.keysReleased.add(k);
    for (const b of this.buttonsDown) this.buttonsReleased.add(b);
    this.keysDown.clear();
    this.buttonsDown.clear();
  }

  // Pointer lock for mouse look (needs a recent user gesture; failures are harmless).
  // With CONFIG.input.rawMouse the lock asks for raw, unaccelerated motion (Chrome/Edge on Windows
  // and ChromeOS); browsers without it (Linux, Firefox) fall back to a plain lock.
  requestLock() {
    if (this.locked || !this.element.requestPointerLock) return;
    const plain = () => {
      try {
        const r2 = this.element.requestPointerLock();
        if (r2 && r2.catch) r2.catch(() => this.onLockError?.());
      } catch {
        this.onLockError?.();
      }
    };
    if (!CONFIG.input.rawMouse) {
      plain();
      return;
    }
    try {
      const r = this.element.requestPointerLock({ unadjustedMovement: true });
      if (r && r.then) {
        r.then(() => (this.mouseStats.raw = true)).catch((err) => {
          // Raw input unsupported → plain lock; refused (cooldown / no gesture) → tell the game.
          if (err && err.name === 'NotSupportedError') plain();
          else this.onLockError?.();
        });
      }
    } catch {
      /* not allowed right now */
    }
  }

  /**
   * One pointer-locked mouse event. Every count is passed through 1:1 except:
   *  • corrupt events (a delta no hand can produce, > input.maxJump);
   *  • warp spikes: an event much larger than the current motion that points back against it
   *    (the cursor being re-centred by the OS / browser, seen on Linux X11 and non-raw Windows
   *    locks). Real flicks build up over several events and never reverse instantly, so they pass;
   *  • drift guard (Linux by default): when sideways sweeps keep reporting the same ±1 vertical
   *    count, that ±1 is removed from those near-horizontal events only. Events with 2+ vertical
   *    counts, pure vertical motion and mixed-sign noise are never touched, so deliberate vertical
   *    aim always gets through.
   */
  look(dx, dy, t = performance.now()) {
    const M = CONFIG.input;
    const st = this.mouseStats;
    if (this._skipLook > 0) {
      this._skipLook--;
      return;
    }
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return;
    st.events++;
    if (Math.abs(dx) > M.maxJump || Math.abs(dy) > M.maxJump) {
      st.dropped++;
      return;
    }
    // Recent motion: an exponential average of the per-event delta, forgotten after a pause.
    if (t - this._lookT > M.spike.restMs) this._avgX = this._avgY = this._prevX = this._prevY = 0;
    this._lookT = t;
    const mag = Math.hypot(dx, dy);
    const avg = Math.hypot(this._avgX, this._avgY);
    // A spike lands in the middle of steady motion: the previous event still went the old way.
    // A real reversal slows down and turns first, so its big events follow ones already pointing back.
    const steady = this._prevX * this._avgX + this._prevY * this._avgY > 0;
    if (steady && avg >= M.spike.movingMin && mag > Math.max(M.spike.min, M.spike.ratio * avg) && dx * this._avgX + dy * this._avgY < 0) {
      st.dropped++;
      return;
    }
    const k = M.spike.avgWeight;
    this._avgX += (dx - this._avgX) * k;
    this._avgY += (dy - this._avgY) * k;
    this._prevX = dx;
    this._prevY = dy;

    const guard = M.driftGuard === 'auto' ? IS_LINUX : !!M.driftGuard;
    st.guard = guard;
    if (guard && Math.abs(dx) >= M.drift.minDx && Math.abs(dy) <= 1) {
      const w = this._driftWin;
      w.push(dy);
      if (w.length > M.drift.window) w.shift();
      let plus = 0, minus = 0;
      for (const v of w) {
        if (v > 0) plus++;
        else if (v < 0) minus++;
      }
      const nz = plus + minus;
      // Same-sign ±1 on a clear share of sideways events, almost never the other sign → bias.
      st.bias = 0;
      if (w.length >= M.drift.window && nz >= M.drift.minShare * w.length) {
        if (plus >= M.drift.consistency * nz) st.bias = 1;
        else if (minus >= M.drift.consistency * nz) st.bias = -1;
      }
      if (st.bias !== 0 && dy === st.bias) {
        dy = 0;
        st.straightened++;
      }
    }
    this.lookDX += dx;
    this.lookDY += dy;
  }

  _resetLook() {
    this._skipLook = 0;
    this._avgX = this._avgY = this._prevX = this._prevY = 0;
    this._lookT = -1e9;
    this._driftWin.length = 0;
    this.mouseStats.bias = 0;
    this.lookDX = this.lookDY = 0;
  }

  releaseLock() {
    if (this.locked) document.exitPointerLock?.();
  }

  /**
   * Call once per frame, before game update, with the (unshaken) picking camera. With
   * `centerAim`, the aim ray goes through the crosshair and the ground point is kept between
   * aimMinDist and aimMaxDist ahead of `origin` (looking at the sky still aims forward).
   */
  update(camera, origin = null) {
    // Skill aiming in the follow camera: the camera rig supplies the ground point directly.
    if (this.centerAim && this.fixedAim) {
      this.groundPoint.copy(this.fixedAim);
      this.groundValid = true;
      this.mouseInside = true;
      return;
    }
    if (!this.centerAim || !origin) {
      this._raycaster.setFromCamera(this.mouseNdc, camera);
      this.groundValid = this._raycaster.ray.intersectPlane(this._plane, this.groundPoint) !== null;
      return;
    }
    const F = CONFIG.camera.follow;
    this.mouseInside = true;
    this._ndc.set(0, F.crosshairY);
    this._raycaster.setFromCamera(this._ndc, camera);
    const ray = this._raycaster.ray;
    const hit = ray.intersectPlane(this._plane, this.groundPoint) !== null;
    const fx = ray.direction.x, fz = ray.direction.z;
    const fl = Math.hypot(fx, fz) || 1;
    let dx, dz, d;
    if (hit) {
      dx = this.groundPoint.x - origin.x;
      dz = this.groundPoint.z - origin.z;
      d = dx * fx / fl + dz * fz / fl; // distance ahead along the view direction
    }
    if (!hit || d > F.aimMaxDist || d < F.aimMinDist) {
      const t = !hit || d > F.aimMaxDist ? F.aimMaxDist : F.aimMinDist;
      // Keep the lateral part of the hit (shoulder offset) when there is one.
      const lx = hit ? dx - (d * fx) / fl : 0;
      const lz = hit ? dz - (d * fz) / fl : 0;
      this.groundPoint.set(origin.x + (fx / fl) * t + lx, 0, origin.z + (fz / fl) * t + lz);
    }
    this.groundValid = true;
  }

  // Call at the very end of the frame.
  endFrame() {
    this.lookDX = 0;
    this.lookDY = 0;
    this.wheel = 0;
    this.keysPressed.clear();
    this.keysReleased.clear();
    this.buttonsPressed.clear();
    this.buttonsReleased.clear();
  }

  isDown(code) {
    return this.keysDown.has(code);
  }
  wasPressed(code) {
    return this.keysPressed.has(code);
  }
  wasReleased(code) {
    return this.keysReleased.has(code);
  }
  isButtonDown(b) {
    return this.buttonsDown.has(b);
  }
  wasButtonPressed(b) {
    return this.buttonsPressed.has(b);
  }
  wasButtonReleased(b) {
    return this.buttonsReleased.has(b);
  }
}

const IS_LINUX = typeof navigator !== 'undefined' && /Linux|X11/.test(navigator.userAgent) && !/Android|CrOS/.test(navigator.userAgent);

function isTextField(el) {
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return (tag === 'INPUT' && el.type !== 'checkbox' && el.type !== 'range') || tag === 'TEXTAREA' || tag === 'SELECT';
}
