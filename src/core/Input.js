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
      const F = CONFIG.camera.follow;
      // The first event after locking can carry the cursor's jump to the center: skip it.
      if (this._skipLook > 0) {
        this._skipLook--;
        return;
      }
      let dx = e.movementX;
      let dy = e.movementY;
      // Only discard deltas no hand can produce (corrupt events); fast flicks always pass.
      if (Math.abs(dx) > F.maxLookJump || Math.abs(dy) > F.maxLookJump) return;
      if (F.linuxMouseFix) {
        // Optional Linux (X11/Wayland) workaround: a steady ±1 px vertical bias during sideways
        // sweeps and warp spikes. Off by default — it eats real motion on Windows.
        if (Math.abs(dy) <= 1 && Math.abs(dx) >= 2) dy = 0;
        const mag = Math.max(Math.abs(dx), Math.abs(dy));
        if (mag > Math.max(60, this._lastMag * 6)) {
          this._lastMag = Math.max(this._lastMag * 0.5, 10);
          return;
        }
        this._lastMag = mag;
      }
      this.lookDX += dx;
      this.lookDY += dy;
    });
    document.addEventListener('pointerlockerror', () => this.onLockError?.());
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === this.element;
      if (this.locked) {
        this.mouseInside = true;
        this._skipLook = 1;
        this._lastMag = 20;
        this.lookDX = this.lookDY = 0;
      }
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
  requestLock() {
    if (this.locked || !this.element.requestPointerLock) return;
    try {
      // Raw (unaccelerated) motion where supported: same feel on every OS, no OS acceleration.
      const r = this.element.requestPointerLock({ unadjustedMovement: true });
      if (r && r.catch) r.catch((err) => {
        // Raw input unsupported → plain lock; refused (cooldown / no gesture) → tell the game.
        if (err && err.name === 'NotSupportedError') {
          try {
            const r2 = this.element.requestPointerLock();
            if (r2 && r2.catch) r2.catch(() => this.onLockError?.());
          } catch {
            this.onLockError?.();
          }
        } else this.onLockError?.();
      });
    } catch {
      /* not allowed right now */
    }
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

function isTextField(el) {
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return (tag === 'INPUT' && el.type !== 'checkbox' && el.type !== 'range') || tag === 'TEXTAREA' || tag === 'SELECT';
}
