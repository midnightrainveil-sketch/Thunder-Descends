import * as THREE from 'three';
import GUI from 'lil-gui';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CONFIG } from '../config.js';
import { Stats } from './Stats.js';

// lil-gui debug panel (toggle with `) + FPS/draw-call counter + debug hotkeys (spec §14).
// Hotkeys only work while debug is on.
export class DebugPanel {
  constructor({ engine, rig, postFX, time, game, ui }) {
    this.engine = engine;
    this.rig = rig;
    this.postFX = postFX;
    this.time = time;
    this.game = game;
    this.ui = ui;

    this.enabled = CONFIG.debug.startOpen;
    this.stats = new Stats(document.getElementById('ui'));
    this._previews = []; // timed preview animations (real time)
    this._debugScaleIndex = 0;

    this._setupOrbit();
    this._buildGui();
    this.setEnabled(this.enabled);
  }

  setEnabled(on) {
    this.enabled = on;
    this.gui.show(on);
    this.stats.setVisible(on);
  }

  // ── Orbit camera (O) ───────────────────────────────────────────────────
  _setupOrbit() {
    const C = CONFIG.camera;
    this.orbitCamera = new THREE.PerspectiveCamera(C.fov, 1, C.near, C.far);
    this.orbit = new OrbitControls(this.orbitCamera, this.engine.renderer.domElement);
    this.orbit.enabled = false;
    this.orbit.enableDamping = true;
    this.engine.onResize((w, h) => {
      this.orbitCamera.aspect = w / Math.max(h, 1);
      this.orbitCamera.updateProjectionMatrix();
    });
  }

  toggleOrbit(on = !this.orbit.enabled) {
    if (on) {
      this.orbitCamera.position.copy(this.rig.basePosition);
      this.orbitCamera.fov = CONFIG.camera.fov;
      this.orbitCamera.updateProjectionMatrix();
      this.orbit.target.copy(this.rig.target);
      this.orbit.update();
      this.orbit.enabled = true;
      this.rig.override = this.orbitCamera;
    } else {
      this.orbit.enabled = false;
      this.rig.override = null; // always returns to the fixed camera
    }
    this.flags.orbit = on;
  }

  // ── Hotkeys ────────────────────────────────────────────────────────────
  handleHotkeys(input) {
    if (input.wasPressed('Backquote')) this.setEnabled(!this.enabled);
    if (!this.enabled) return;

    if (input.wasPressed('KeyT')) {
      const scales = CONFIG.time.debugScales;
      this._debugScaleIndex = (this._debugScaleIndex + 1) % scales.length;
      this.time.debugScale = scales[this._debugScaleIndex];
    }
    if (input.wasPressed('KeyO')) this.toggleOrbit();
    if (input.wasPressed('KeyF')) this.togglePhoto();

    // TODO(Stage 3): 1/2/3 spawn Ronin/Teppo/Tate, K kill all, G god mode, N next wave, C reset cooldowns.
    // TODO(Stage 5): 4/5/6 spawn bosses, L gain a level.
    // TODO(Stage 2): M model viewer.
    const stubs = {
      Digit1: 'spawn Ronin (Stage 3)',
      Digit2: 'spawn Teppo (Stage 3)',
      Digit3: 'spawn Tate (Stage 3)',
      Digit4: 'spawn Oni Juggernaut (Stage 5)',
      Digit5: 'spawn Kage Kitsune (Stage 5)',
      Digit6: 'spawn Raiju Serpent (Stage 5)',
      KeyK: 'kill all enemies (Stage 3)',
      KeyG: 'god mode (Stage 3)',
      KeyN: 'next wave (Stage 3)',
      KeyL: 'gain a level (Stage 5)',
      KeyC: 'reset cooldowns (Stage 4)',
      KeyM: 'model viewer (Stage 2)',
    };
    for (const code in stubs) if (input.wasPressed(code)) console.info(`[debug] ${code}: ${stubs[code]} — not implemented yet`);
  }

  togglePhoto(on = !this.flags.photo) {
    this.flags.photo = on;
    this.game.setPhotoMode(on);
    this.ui.setHidden(on);
  }

  // ── Timed previews (real time) ─────────────────────────────────────────
  _preview(duration, step, done) {
    this._previews.push({ t: 0, duration, step, done });
  }

  update(realDt) {
    for (let i = this._previews.length - 1; i >= 0; i--) {
      const p = this._previews[i];
      p.t += realDt;
      const k = Math.min(p.t / p.duration, 1);
      p.step?.(k, p.t);
      if (k >= 1) {
        p.done?.();
        this._previews.splice(i, 1);
      }
    }
    if (this.orbit.enabled) this.orbit.update();
  }

  previewTimeRing() {
    const P = CONFIG.post.preview;
    const total = P.ringExpand + P.ringHold + P.ringCollapse;
    const hero = this.game.hero;
    const prevWorld = this.time.worldScale;
    this.time.tweenScale('world', 0, 0); // world freezes while the ring is up
    this._preview(
      total,
      (k, t) => {
        let r;
        if (t < P.ringExpand) r = easeOutCubic(t / P.ringExpand);
        else if (t < P.ringExpand + P.ringHold) r = 1;
        else r = 1 - easeInCubic((t - P.ringExpand - P.ringHold) / P.ringCollapse);
        const center = hero.position.clone().setY(1.0);
        this.postFX.setTimeRing(center, r * P.ringMaxRadius, r > 0.001);
      },
      () => {
        this.postFX.setTimeRing(null, 0, false);
        this.time.tweenScale('world', prevWorld, 0);
      },
    );
  }

  _buildGui() {
    const gui = new GUI({ title: 'KUROGANE debug' });
    this.gui = gui;
    this.flags = { orbit: false, photo: false };
    const C = CONFIG;
    const refit = () => this.rig.fit();

    // Camera
    const cam = gui.addFolder('Camera');
    cam.add(C.camera, 'elevationDeg', 15, 75, 0.5).onChange(refit);
    cam.add(C.camera, 'yawDeg', -60, 60, 0.5).onChange(refit);
    cam.add(C.camera, 'fov', 15, 70, 0.5).onChange(refit);
    cam.add(C.camera, 'fitMargin', 0, 6, 0.1).onChange(refit);
    cam.add(C.camera, 'fitHeight', 0, 8, 0.1).onChange(refit);
    cam.add(C.camera, 'fitDepth', 0, 8, 0.1).onChange(refit);
    cam.add(C.camera, 'headroomTop', 0, 0.5, 0.01).onChange(refit);
    cam.add(C.camera, 'bottomPad', 0, 0.2, 0.005).onChange(refit);
    cam.add(C.camera.target, 'x', -6, 6, 0.1).name('target x').onChange(refit);
    cam.add(C.camera.target, 'z', -6, 6, 0.1).name('target z').onChange(refit);
    cam.add(C.camera.shake, 'maxOffset', 0, 2, 0.01).name('shake offset');
    cam.add(C.camera.shake, 'maxRollDeg', 0, 5, 0.1).name('shake roll°');
    cam.add(C.camera.shake, 'frequency', 1, 60, 1).name('shake freq');
    cam.add({ shakeS: () => this.rig.shake(0.35, 0.25) }, 'shakeS').name('Shake small');
    cam.add({ shakeB: () => this.rig.shake(0.9, 0.6) }, 'shakeB').name('Shake big');
    cam.add({ punch: () => this.rig.punch(0.07, 0.3) }, 'punch').name('Zoom punch');
    cam.add(this.flags, 'orbit').name('Orbit camera (O)').onChange((v) => this.toggleOrbit(v)).listen();
    cam.add(this.flags, 'photo').name('Photo mode (F)').onChange((v) => this.togglePhoto(v)).listen();

    // Post
    const post = gui.addFolder('Post');
    const apply = () => this.postFX.applySettings();
    post.add(C.render, 'exposure', 0.2, 3, 0.01).onChange(() => this.engine.applySettings());
    post.add(C.post.bloom, 'strength', 0, 3, 0.01).name('bloom strength').onChange(apply);
    post.add(C.post.bloom, 'radius', 0, 1, 0.01).name('bloom radius').onChange(apply);
    post.add(C.post.bloom, 'threshold', 0, 3, 0.01).name('bloom threshold').onChange(apply);
    post.add(C.post.grade, 'saturation', 0, 2, 0.01).onChange(apply);
    post.add(C.post.grade, 'vignette', 0, 1, 0.01).onChange(apply);
    post.add(C.post.grade, 'chromatic', 0, 3, 0.01).onChange(apply);
    post.addColor(C.post.grade, 'tintColor').onChange(apply);
    post.add(C.post.grade, 'tintStrength', 0, 1, 0.01).onChange(apply);
    post.add(C.post.timeRing, 'lineWidth', 0.001, 0.05, 0.001).name('ring line width').onChange(apply);
    post.add(C.post.timeRing, 'lineIntensity', 0, 8, 0.1).name('ring line intensity').onChange(apply);
    const P = C.post.preview;
    const G = C.post.grade;
    post.add({ f: () => this.postFX.flash(P.flashStrength, P.flashDuration) }, 'f').name('Test flash');
    post
      .add(
        {
          f: () => {
            this.postFX.setTint(G.tintColor, P.tintStrength, 0.12);
            this.postFX.setSaturation(P.tintSaturation, 0.12);
            this._preview(P.previewHold, null, () => {
              this.postFX.setTint(null, G.tintStrength, 0.2);
              this.postFX.setSaturation(G.saturation, 0.2);
            });
          },
        },
        'f',
      )
      .name('Test tint (Q slow-mo)');
    post
      .add(
        {
          f: () => {
            this.postFX.setSaturation(0, 0.15);
            this._preview(P.previewHold, null, () => this.postFX.setSaturation(G.saturation, 0.3));
          },
        },
        'f',
      )
      .name('Test desaturate');
    post
      .add(
        {
          f: () => {
            this.postFX.setChromatic(P.chromatic, 0.05);
            this._preview(P.previewHold * 0.5, null, () => this.postFX.setChromatic(G.chromatic, 0.3));
          },
        },
        'f',
      )
      .name('Test chromatic');
    post
      .add(
        {
          f: () => {
            this.postFX.setVignette(0.85, 0.1);
            this._preview(P.previewHold, null, () => this.postFX.setVignette(G.vignette, 0.3));
          },
        },
        'f',
      )
      .name('Test vignette');
    post.add({ f: () => this.previewTimeRing() }, 'f').name('Test time-stop ring');

    // Time
    const time = gui.addFolder('Time');
    time.add(this.time, 'worldScale', 0, 2, 0.01).listen();
    time.add(this.time, 'heroScale', 0, 2, 0.01).listen();
    time.add(this.time, 'debugScale').name('debug scale (T)').listen().disable();
    time.add(this.time, 'paused').listen();
    time.add({ f: () => this.time.hitstop(C.time.hitstopTest) }, 'f').name('Hitstop 0.07 s');
    time.add({ f: () => this.time.hitstop(0.5) }, 'f').name('Hitstop 0.5 s');
    time
      .add(
        {
          f: () => {
            this.time.tweenScale('both', C.time.slowTest, C.time.slowTestTween);
            this._preview(P.previewHold * 1.5, null, () => this.time.tweenScale('both', 1, C.time.slowTestTween));
          },
        },
        'f',
      )
      .name('Slow-mo tween test');
    time
      .add(
        {
          f: () => {
            this.time.tweenScale('both', 1, 0);
            this.time.debugScale = 1;
            this._debugScaleIndex = 0;
          },
        },
        'f',
      )
      .name('Reset scales');

    // Hero
    const hero = gui.addFolder('Hero');
    hero.add(C.hero, 'moveSpeed', 0, 14, 0.1);
    hero.add(C.hero, 'accel', 1, 150, 1);
    hero.add(C.hero, 'decel', 1, 150, 1);
    hero.add(C.hero, 'turnRate', 1, 60, 0.5);
    hero.add(C.hero, 'leanDeg', 0, 15, 0.5);

    // Lighting
    const light = gui.addFolder('Lighting');
    const applyL = () => this.game.lighting.applySettings();
    light.add(C.lighting, 'moonIntensity', 0, 8, 0.05).onChange(applyL);
    light.addColor(C.lighting, 'moonColor').onChange(applyL);
    light.add(C.lighting.moonDir, 'x', -1, 1, 0.01).name('moon dir x').onChange(applyL);
    light.add(C.lighting.moonDir, 'y', 0.1, 2, 0.01).name('moon dir y').onChange(applyL);
    light.add(C.lighting.moonDir, 'z', -1, 1, 0.01).name('moon dir z').onChange(applyL);
    light.add(C.lighting, 'hemiIntensity', 0, 4, 0.05).onChange(applyL);
    light.add(C.lighting, 'rimIntensity', 0, 5, 0.05).onChange(applyL);
    light.add(C.lighting, 'shadowRadius', 0, 8, 0.1).onChange(applyL);
    light.add(C.render, 'fogDensity', 0, 0.03, 0.0005).onChange(() => this.engine.applySettings());
    light.close();

    // Voxel
    const vox = gui.addFolder('Voxel');
    vox.add(C.voxel.test, 'enabled').name('Voxel test');
    vox.close();

    const help = gui.addFolder('Hotkeys');
    help.add({ t: 'T time · O orbit · F photo' }, 't').name('keys').disable();
    help.close();
  }
}

const easeOutCubic = (k) => 1 - Math.pow(1 - k, 3);
const easeInCubic = (k) => k * k * k;
