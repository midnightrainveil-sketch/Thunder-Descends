import * as THREE from 'three';
import GUI from 'lil-gui';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CONFIG } from '../config.js';
import { Stats } from './Stats.js';
import { ModelViewer } from './ModelViewer.js';

// lil-gui debug panel (toggle with `) + FPS/draw-call counter + debug hotkeys (spec §14).
// Hotkeys only work while debug is on.
export class DebugPanel {
  constructor({ engine, rig, postFX, time, game, ui, input }) {
    this.engine = engine;
    this.input = input;
    this._extra = '';
    this._extraT = 0;
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
    this.viewer = new ModelViewer(this);
    this._buildGui();
    this.setEnabled(this.enabled);
  }

  setEnabled(on) {
    this.enabled = on;
    const visible = on && !this.flags?.photo;
    this.gui.show(visible);
    this.stats.setVisible(visible);
  }

  // Extra stats line: environment draw calls (recomputed a couple of times per second).
  statsExtra() {
    const now = performance.now();
    if (now - this._extraT > CONFIG.debug.statsInterval * 1000) {
      this._extraT = now;
      const d = this.game.map.countDrawCalls();
      const v = this.game.map.grove.violationCount;
      const m = this.input.mouseStats;
      const look = `\nmouse ${this.input.locked ? 'locked' : 'free'}${m.raw ? ' raw' : ''} · ev ${m.events} · spikes ${m.dropped}` + (m.guard ? ` · drift ${m.bias > 0 ? '+1' : m.bias < 0 ? '−1' : '0'} fixed ${m.straightened}` : '') + ` · boom ${this.rig.boom.toFixed(1)} m` + (window.__loop?.errors ? `\nFRAME ERRORS ${window.__loop.errors} (see console)` : '');
      this._extra = `env calls ${d.main} + ${d.shadow} shadow` + look + (CONFIG.map.debug.canopyCheck ? `\ncanopy over play ${v}` : '');
    }
    return this._extra;
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
    if (input.wasPressed('Backquote')) {
      this.setEnabled(!this.enabled);
      if (this.enabled) this.game.releasePointer(); // cursor for the panel; click the game to re-lock
    }
    if (!this.enabled) return;

    if (input.wasPressed('KeyT')) {
      const scales = CONFIG.time.debugScales;
      this._debugScaleIndex = (this._debugScaleIndex + 1) % scales.length;
      this.time.debugScale = scales[this._debugScaleIndex];
    }
    if (input.wasPressed('KeyO')) this.toggleOrbit();
    if (input.wasPressed('KeyF')) this.togglePhoto();
    if (input.wasPressed('KeyI')) this.petalImpulseAtMouse();
    // Stage 3: spawn (with telegraph), kill all, god mode, next wave, level up, model viewer.
    const menu = this.game.mode !== 'play'; // digits pick cards; no debug spawns in menus
    if (menu) return;
    if (input.wasPressed('Digit1')) this.game.spawnEnemy('ronin');
    if (input.wasPressed('Digit2')) this.game.spawnEnemy('teppo');
    if (input.wasPressed('Digit3')) this.game.spawnEnemy('tate');
    if (input.wasPressed('KeyK')) this.game.killAll();
    if (input.wasPressed('KeyG')) this.game.godMode = !this.game.godMode;
    if (input.wasPressed('KeyN')) this.game.waves.skip();
    if (input.wasPressed('KeyL')) this.game.progression.levelUp();
    if (input.wasPressed('KeyM')) this.viewer.enable();
    if (input.wasPressed('KeyC')) this.game.hero.skills.resetCooldowns();

    if (input.wasPressed('Digit4')) this.game.spawnBoss('juggernaut');
    if (input.wasPressed('Digit5')) this.game.spawnBoss('kitsune');
    if (input.wasPressed('Digit6')) this.game.spawnBoss('raiju');
  }

  // Photo mode: hide the hero, reticle, UI and the debug overlay (F again to return).
  togglePhoto(on = !this.flags.photo) {
    this.flags.photo = on;
    this.game.setPhotoMode(on);
    this.ui.setHidden(on);
    this.setEnabled(this.enabled);
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
    this.viewer.update(realDt);
    this.game.lockBlocked = this.viewer.active || this.orbit.enabled || this.enabled; // these need the cursor
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
    const gui = new GUI({ title: `${CONFIG.names.game} debug` });
    this.gui = gui;
    this.flags = { orbit: false, photo: false };
    const C = CONFIG;
    const refit = () => {
      this.rig.fit();
      this.game.onCameraChanged();
    };

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
    const FC = C.camera.follow;
    cam.add({ toggle: () => this.game.toggleCameraMode() }, 'toggle').name('Follow ⇄ fixed (V)');
    cam.add(FC, 'fov', 30, 90, 0.5).name('follow fov');
    cam.add(FC, 'distance', 2, 12, 0.1).name('follow distance');
    cam.add(FC, 'height', 0.5, 3, 0.05).name('follow height');
    cam.add(FC, 'shoulder', -1.5, 1.5, 0.05).name('follow shoulder');
    cam.add(FC, 'boundRadius', 11, 24, 0.1).name('follow bound radius');
    cam.add(FC, 'minHeight', 0.2, 3, 0.05).name('follow min height');
    cam.add(this.flags, 'orbit').name('Orbit camera (O)').onChange((v) => this.toggleOrbit(v)).listen();
    cam.add(this.flags, 'photo').name('Photo mode (F)').onChange((v) => this.togglePhoto(v)).listen();

    // Mouse (pointer-lock look; live counters in the stats overlay)
    const mouse = gui.addFolder('Mouse');
    const IN = C.input;
    mouse.add(FC, 'sensitivity', 0.0003, 0.02, 0.0001).name('sensitivity (rad/count)').listen();
    mouse.add(FC, 'invertY').name('invert Y');
    mouse.add(FC, 'lookSmoothing', 0, 0.08, 0.002).name('look smoothing s').listen();
    mouse.add(FC, 'pitchMinDeg', -40, 0, 1).name('pitch min°');
    mouse.add(FC, 'pitchMaxDeg', 30, 85, 1).name('pitch max°');
    mouse.add(IN, 'rawMouse').name('raw input (next capture)').listen();
    mouse.add(IN, 'driftGuard', { auto: 'auto', on: true, off: false }).name('drift guard');
    mouse.add(IN.spike, 'min', 10, 400, 1).name('spike min counts');
    mouse.add(IN.spike, 'ratio', 2, 20, 0.5).name('spike ratio');
    mouse.add(IN.drift, 'consistency', 0.5, 1, 0.01).name('drift consistency');
    mouse.add(C.hero.anim, 'aimTurnSpeed', 5, 80, 1).name('hero aim turn rad/s');
    mouse.add({ reset: () => Object.assign(this.input.mouseStats, { events: 0, dropped: 0, straightened: 0 }) }, 'reset').name('Reset counters');

    // Post
    const post = gui.addFolder('Post');
    const apply = () => this.postFX.applySettings();
    post.add(C.render, 'exposure', 0.2, 3, 0.01).onChange(() => this.engine.applySettings());
    post.add(C.render, 'autoQuality').name('auto quality (dyn. res)');
    post.add(this.engine, 'renderScale', 0.5, 1, 0.05).name('render scale').listen().onChange((v) => this.engine.setRenderScale(v));
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
    const H = this.game.hero;
    hero.add(C.hero, 'moveSpeed', 0, 14, 0.1);
    hero.add(C.hero, 'accel', 1, 150, 1);
    hero.add(C.hero, 'decel', 1, 150, 1);
    hero.add(C.hero.anim, 'aimTurnRate', 1, 60, 0.5).name('aim turn rate');
    hero.add(C.hero.anim, 'legTurnRate', 1, 60, 0.5).name('leg turn rate');
    hero.add(C.hero.anim, 'twistMaxDeg', 0, 90, 1).name('twist max°');
    hero.add(C.hero, 'leanDeg', 0, 15, 0.5);
    hero.add(C.hero.anim, 'breathDeg', 0, 5, 0.1).name('breathing°');
    hero.add(H, 'attackSpeed', 0.25, 3, 0.05).name('attack speed');
    hero.add(this.game, 'godMode').name('god mode (G)').listen();
    hero.add(C.hero, 'lifesteal', 0, 0.5, 0.01).name('lifesteal');
    hero.add(this.game.hero.stats, 'critRate', 0, 1, 0.05).name('crit rate').listen();
    hero.add({ f: () => this.game.progression.levelUp() }, 'f').name('Level up (L)');
    hero.add({ f: () => this.game.hero.heal(1e6) }, 'f').name('Full heal');
    hero.add({ f: () => this.game.combat.enemyHitsHero({ position: this.game.hero.position.clone().add({ x: 0, y: 0, z: 1 }) }, 50, 5) }, 'f').name('Take 50 damage');
    hero.add({ f: () => this.game.hero.testClaw() }, 'f').name('Test claw');
    hero.add({ f: () => this.game.hero.testBladeSplit() }, 'f').name('Test blade split');
    hero.add({ f: () => this.game.hero.playHurt() }, 'f').name('Play hurt');
    hero.add({ f: () => this.game.hero.playDeath() }, 'f').name('Play death');
    hero.add({ f: () => this.game.hero.revive() }, 'f').name('Revive');
    const ult = { on: false };
    hero.add(ult, 'on').name('Ult blade plates').onChange((v) => {
      for (let i = 0; i < 8; i++) this.game.hero.rig.setBoneVisible(`bladeUlt_${i}`, v);
    });
    hero.add({ f: () => this.game.hero.rig.setFlash(1) || setTimeout(() => this.game.hero.rig.setFlash(0), 80) }, 'f').name('Hit flash (80 ms)');
    const DS = C.hero.dash;
    const dash = hero.addFolder('Dash (Shift)');
    dash.add(DS, 'distance', 1, 12, 0.1).name('distance m');
    dash.add(DS, 'duration', 0.08, 0.6, 0.01).name('duration s');
    dash.add(DS, 'recharge', 0.2, 10, 0.1).name('recharge s/stack');
    dash.add(DS, 'charges', 1, 5, 1).name('stacks');
    dash.add(DS, 'graceIFrames', 0, 0.5, 0.01).name('grace i-frames s');
    dash.add(DS, 'afterimageEvery', 0.01, 0.1, 0.002).name('afterimage every s');
    dash.add({ f: () => this.game.hero.dash.refill() }, 'f').name('Refill stacks (C)');
    const DSS = DS.strike;
    dash.add(DSS, 'window', 0.1, 2, 0.05).name('strike window s');
    dash.add(DSS, 'range', 2, 15, 0.1).name('strike range m');
    dash.add(DSS, 'coneDeg', 20, 180, 1).name('strike cone°');
    dash.add(DSS, 'mult', 0.5, 6, 0.1).name('strike ×ATK');
    dash.add(DSS, 'shake', 0, 1, 0.05).name('strike shake');
    dash.close();
    hero.close();

    // Enemies
    const sk = gui.addFolder('Skills');
    const S = this.game.hero.skills;
    sk.add({ f: () => S.resetCooldowns() }, 'f').name('Reset cooldowns (C)');
    sk.add(S.q, 'rank', 1, 4, 1).name(`Q ${CONFIG.names.q} rank`);
    sk.add(S.e, 'rank', 1, 4, 1).name(`E ${CONFIG.names.e} rank`);
    sk.add(S.r, 'rank', 1, 4, 1).name(`R ${CONFIG.names.r} rank`);
    sk.add(CONFIG.skills.thunderclaw, 'aimScale', 0.05, 1, 0.01).name('Q aim time scale');
    sk.add(CONFIG.skills.shatter, 'slashEvery', 0.04, 0.2, 0.01).name('E overdrive slash every');
    sk.add(CONFIG.skills.demontime, 'ringMax', 10, 80, 1).name('R ring max (m)');
    sk.add({ f: () => S.r._startBuff() }, 'f').name('R: buff now (no cast)');
    sk.add({ f: () => S.r.endBuff(true) }, 'f').name('R: end buff');

    const en = gui.addFolder('Enemies');
    en.add({ f: () => this.game.spawnEnemy('ronin') }, 'f').name('Spawn Ronin (1)');
    en.add({ f: () => this.game.spawnEnemy('teppo') }, 'f').name('Spawn Teppo (2)');
    en.add({ f: () => this.game.spawnEnemy('tate') }, 'f').name('Spawn Tate (3)');
    en.add({ f: () => this.game.killAll() }, 'f').name('Kill all (K)');
    en.add({ f: () => this.game.clearEnemies() }, 'f').name('Remove all (no FX)');
    const aiState = { ai: true };
    en.add(aiState, 'ai').name('AI enabled').onChange((v) => this.game.enemies.forEach((e) => (e.ai = v)));
    en.add(this.game.waves, 'enabled').name('waves running');
    en.add({ f: () => this.game.waves.skip() }, 'f').name('Next wave (N)');
    en.add({ f: () => this.game.enemies.forEach((e) => e.stun(2)) }, 'f').name('Stun all 2 s');
    const all = (fn) => () => this.game.enemies.forEach(fn);
    en.add({ f: all((e) => e.playAction('attack')) }, 'f').name('Attack (windup → strike)');
    en.add({ f: all((e) => e.playAction('aimFire')) }, 'f').name('Teppo aim → fire');
    en.add({ f: all((e) => e.playAction('block')) }, 'f').name('Tate block');
    en.add({ f: all((e) => e.playAction('slam')) }, 'f').name('Tate slam');
    en.add({ f: all((e) => e.playAction('stunned')) }, 'f').name('Stunned');
    en.add({ f: all((e) => e.playHurt()) }, 'f').name('Hurt + hit flash');
    en.add({ f: all((e) => (e.eyeFlare = 1)) }, 'f').name('Flare eyes');
    en.add(C.enemies, 'stopDistance', 0.5, 6, 0.1).name('stop distance');
    const bo = en.addFolder('Bosses');
    bo.add(C.bosses, 'damageMul', 0.2, 4, 0.05).name('damage × (next spawn)');
    bo.add(C.bosses, 'hpMul', 0.2, 4, 0.05).name('HP × (next spawn)');
    bo.add(C.bosses, 'tempo', 0.5, 2, 0.05).name('tempo × (next spawn)');
    bo.add(C.bosses, 'enrageAt', 0, 1, 0.05).name('enrage at HP');
    bo.add(C.bosses, 'maxTempo', 1, 3, 0.05).name('tempo cap');
    bo.add(C.bosses, 'chainChance', 0, 1, 0.05).name('chain attack chance');
    bo.add(C.bosses.attackJitter, '0', 0.5, 1.5, 0.05).name('attack jitter min');
    bo.add(C.bosses.attackJitter, '1', 0.5, 2, 0.05).name('attack jitter max');
    bo.add({ f: () => this.game.boss && (this.game.boss.dmgScale = C.bosses.damageMul * (1 + C.bosses.loopDamage * this.game.boss.loop)) }, 'f').name('Apply damage × to current');
    bo.close();
    en.close();

    // Model viewer
    const mv = gui.addFolder('Model viewer (M)');
    const V = this.viewer.state;
    mv.add({ f: () => this.viewer.enable() }, 'f').name('Toggle viewer (M)');
    mv.add(V, 'model', ['hero', 'ronin', 'teppo', 'tate']).onChange((v) => {
      this.viewer.setModel(v);
      clipCtrl.options(this.viewer.clipNames()).setValue(this.viewer.state.clip);
    });
    const clipCtrl = mv.add(V, 'clip', ['idle', 'run', 'attack1', 'attack2', 'attack3', 'hurt', 'death']).onChange((v) => this.viewer.play(v));
    mv.add(V, 'speed', 0, 2, 0.05);
    mv.add(V, 'paused').listen();
    mv.add({ u: 0 }, 'u', 0, 1, 0.01).name('scrub').onChange((u) => this.viewer.scrub(u));
    mv.add(V, 'pivots').name('show joint pivots');
    mv.add(V, 'loopOneShots').name('loop one-shots');
    mv.close();

    // Lighting
    const light = gui.addFolder('Lighting');
    const applyL = () => this.game.lighting.applySettings();
    light.add(C.lighting, 'moonIntensity', 0, 8, 0.05).onChange(applyL);
    light.addColor(C.lighting, 'moonColor').onChange(applyL);
    light.add(C.lighting, 'moonFollowsSky').name('moon follows sky').onChange(applyL);
    light.add(C.lighting, 'moonElevationDeg', 10, 85, 0.5).name('moon elevation°').onChange(applyL);
    light.add(C.lighting.moonDir, 'x', -1, 1, 0.01).name('moon dir x').onChange(applyL);
    light.add(C.lighting.moonDir, 'y', 0.1, 2, 0.01).name('moon dir y').onChange(applyL);
    light.add(C.lighting.moonDir, 'z', -1, 1, 0.01).name('moon dir z').onChange(applyL);
    light.add(C.lighting, 'hemiIntensity', 0, 5, 0.05).onChange(applyL);
    light.addColor(C.lighting, 'hemiSky').onChange(applyL);
    light.add(C.lighting, 'rimIntensity', 0, 5, 0.05).onChange(applyL);
    light.add(C.lighting, 'shadowRadius', 0, 8, 0.1).onChange(applyL);
    light.close();

    this._buildMapFolder(gui);

    // Voxel
    const vox = gui.addFolder('Voxel');
    vox.add(C.voxel.test, 'enabled').name('Voxel test');
    vox.close();

    const help = gui.addFolder('Hotkeys');
    help.add({ t: 'T time · O orbit · F photo' }, 't').name('keys').disable();
    help.add({ t: 'I petal impulse at mouse' }, 't').name('map').disable();
    help.add({ t: '1/2/3 spawn · K kill all · M viewer' }, 't').name('enemies').disable();
    help.add({ t: 'G god · N next wave · L level up' }, 't').name('combat').disable();
    help.add({ t: 'Q claw · E shatter · R demontime · Shift dash · C cooldowns' }, 't').name('skills').disable();
    help.close();
  }
}

DebugPanel.prototype.petalImpulseAtMouse = function () {
  const P = CONFIG.map.debugTests;
  if (!this.input.groundValid) return;
  this.game.map.petalImpulse(this.input.groundPoint, P.impulseRadius, P.impulseStrength);
};

DebugPanel.prototype._buildMapFolder = function (gui) {
  const C = CONFIG;
  const M = C.map;
  const map = this.game.map;
  const f = gui.addFolder('Map');

  const wind = f.addFolder('Wind');
  wind.add(M.wind, 'strength', 0, 6, 0.05);
  wind.add(M.wind, 'dirDeg', 0, 360, 1).name('direction°');
  wind.add(M.wind, 'gustFreq', 0, 1, 0.01).name('gust frequency');
  wind.add(M.wind, 'gustStrength', 0, 3, 0.05).name('gust strength');
  wind.close();

  const pet = f.addFolder('Petals');
  pet.add(C.quality, 'petalCount', 0, 2000, 50).name('pool size').onFinishChange(() => map.rebuildPetals());
  pet.add(M.petals, 'spawnRate', 0, 200, 1).name('spawn / s');
  pet.add(M.petals, 'floorCarpet', 0, 1500, 10).name('floor carpet').onFinishChange(() => map.rebuildPetals());
  pet.add(M.petals, 'offscreenFrac', 0, 1, 0.01).name('off-screen share');
  pet.add(M.petals, 'flutterAmp', 0, 2, 0.01).name('flutter');
  pet.add(M.debugTests, 'impulseStrength', 0, 20, 0.1).name('test strength');
  pet.add({ f: () => this.petalImpulseAtMouse() }, 'f').name('Impulse at mouse (I)');
  pet.add({
    f: () => {
      const h = this.game.hero;
      map.petalSweep(h.position, h.aim, 170, 5.5, M.debugTests.impulseStrength);
    },
  }, 'f').name('Sweep test (whip arc)');
  pet.add({ f: () => map.petalVortex(this.game.hero.position, 4, M.debugTests.impulseStrength * 0.6) }, 'f').name('Vortex test');
  pet.close();

  const trees = f.addFolder('Trees');
  const rebuild = () => map.rebuildTrees();
  trees.add(M.trees, 'seed', 0, 99999, 1).onFinishChange(rebuild);
  trees.add({ f: () => { M.trees.seed = Math.floor(Math.random() * 99999); rebuild(); trees.controllers.forEach((c) => c.updateDisplay()); } }, 'f').name('Re-roll seed');
  trees.add(M.trees, 'density', 0.6, 1.4, 0.01).name('canopy density').onFinishChange(rebuild);
  trees.add(M.trees, 'colorBalance', 0, 1, 0.01).name('pink ↔ pale').onFinishChange(rebuild);
  trees.add(M.trees, 'swayAmp', 0, 0.3, 0.005).name('sway amount');
  trees.add(M.trees, 'swaySpeed', 0, 4, 0.05).name('sway speed');
  trees.add(M.trees, 'emissiveLift', 0, 0.2, 0.005).name('blossom lift').onChange((v) => (map.grove.blossomMat.userData.liftUniforms.uLift.value = v));
  trees.add(C.quality, 'treeShadows').name('tree shadows').onChange(() => map.grove.applyShadows());
  trees.add(M.debug, 'canopyCheck').name('canopy check').onChange(() => map.grove.updateCheck());
  trees.close();

  const lan = f.addFolder('Lanterns');
  lan.add(M.lanterns, 'flickerAmount', 0, 0.8, 0.01).name('flicker');
  lan.add(M.lanterns, 'flickerSpeed', 0, 30, 0.1).name('flicker speed');
  lan.add(M.lanterns, 'emissive', 0, 6, 0.05).name('fire glow');
  lan.add(M.lanterns, 'lightIntensity', 0, 20, 0.1).name('point light');
  lan.add(M.lanterns, 'lightDistance', 1, 25, 0.5).name('light distance');
  lan.add(M.lanterns, 'poolIntensity', 0, 1.5, 0.01).name('light pools');
  lan.close();

  const seams = f.addFolder('Seams');
  seams.add(M.seams, 'rest', 0, 4, 0.01).name('intensity');
  seams.add(M.seams, 'pulse', 0, 6, 0.05).name('pulse');
  seams.add(M.seams, 'pulsePeriod', 1, 20, 0.1).name('pulse period s');
  seams.add(M.seams, 'pulseSpeed', 0.5, 20, 0.1).name('pulse speed');
  seams.close();

  const atm = f.addFolder('Atmosphere');
  atm.add(M.mist, 'density', 0, 3, 0.01).name('mist density');
  atm.add(C.quality, 'mistLayers', 0, 4, 1).name('mist layers').onFinishChange(() => map.rebuildMist());
  atm.addColor(M.mist, 'color').name('mist color');
  atm.add(C.render, 'fogDensity', 0, 0.02, 0.0002).name('fog').onChange(() => this.engine.applySettings());
  atm.addColor(C.render, 'fogColor').name('fog color').onChange(() => this.engine.applySettings());
  const moon = () => this.game.onCameraChanged();
  atm.add(M.sky.moon.screen, 'x', -1, 1, 0.01).name('moon x (screen)').onChange(moon);
  atm.add(M.sky.moon.screen, 'y', -1, 1, 0.01).name('moon y (screen)').onChange(moon);
  atm.add(M.sky.moon, 'size', 0.02, 0.3, 0.005).name('moon size').onChange(moon);
  atm.add(M.sky.moon, 'intensity', 0, 3, 0.01).name('moon brightness');
  atm.add(M.sky.clouds, 'opacity', 0, 1, 0.01).name('cloud opacity');
  atm.add(M.sky.clouds, 'speed', 0, 30, 0.1).name('cloud speed');
  atm.close();
  f.close();
};

const easeOutCubic = (k) => 1 - Math.pow(1 - k, 3);
const easeInCubic = (k) => k * k * k;
