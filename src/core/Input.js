import * as THREE from 'three';

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

    this._raycaster = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

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
      this.buttonsPressed.add(e.button);
      this.buttonsDown.add(e.button);
      this._setMouse(e);
    });
    window.addEventListener('mouseup', (e) => {
      if (this.buttonsDown.has(e.button)) this.buttonsReleased.add(e.button);
      this.buttonsDown.delete(e.button);
    });
    window.addEventListener('mousemove', (e) => this._setMouse(e));
    el.addEventListener('mouseenter', () => (this.mouseInside = true));
    el.addEventListener('mouseleave', () => (this.mouseInside = false));
    el.addEventListener('contextmenu', (e) => e.preventDefault());

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

  // Call once per frame, before game update, with the (unshaken) picking camera.
  update(camera) {
    this._raycaster.setFromCamera(this.mouseNdc, camera);
    this.groundValid = this._raycaster.ray.intersectPlane(this._plane, this.groundPoint) !== null;
  }

  // Call at the very end of the frame.
  endFrame() {
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
