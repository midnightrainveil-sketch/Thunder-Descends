import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GradePass } from './GradePass.js';
import { CONFIG } from '../config.js';

// Objects on this layer are drawn into the hero mask and keep their color inside the time ring.
export const MASK_LAYER = 5;

// RenderPass → UnrealBloomPass → GradePass → OutputPass (spec §12).
export class PostFX {
  constructor(engine, rig) {
    this.engine = engine;
    this.rig = rig;
    const renderer = engine.renderer;
    const R = CONFIG.render;

    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: R.msaaSamples,
    });
    this.composer = new EffectComposer(renderer, rt);

    this.renderPass = new RenderPass(engine.scene, rig.activeCamera);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 1, 0.5, 1);
    this.gradePass = new GradePass();
    this.outputPass = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.gradePass);
    this.composer.addPass(this.outputPass);

    // Hero mask target: depth prepass of the whole scene, then MASK_LAYER objects in white.
    this.maskTarget = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.UnsignedByteType });
    this._maskDepthMat = new THREE.MeshBasicMaterial({ colorWrite: false, fog: false });
    this._maskWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
    this._maskWhiteMat.depthFunc = THREE.LessEqualDepth;
    this.gradePass.uniforms.tMask.value = this.maskTarget.texture;

    // Timed effects (real time).
    this._flash = { strength: 0, duration: 0, t: 0 };
    this._tweens = {}; // uniform name → {from, to, t, duration}
    this._ringWorld = new THREE.Vector3();
    this._ringWorldRadius = 0;
    this._ringActive = 0;
    this._tmpV = new THREE.Vector3();
    this._tmpV2 = new THREE.Vector3();
    this._clearColor = new THREE.Color();

    this.applySettings();
    engine.onResize((w, h) => this.resize(w, h));
  }

  get uniforms() {
    return this.gradePass.uniforms;
  }

  resize(w, h) {
    const pr = this.engine.pixelRatio;
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.maskTarget.setSize(Math.floor(w * pr), Math.floor(h * pr));
    this.uniforms.aspect.value = w / Math.max(h, 1);
  }

  // Push config values (bloom + neutral grade defaults) into the passes.
  applySettings() {
    const P = CONFIG.post;
    this.bloomPass.strength = P.bloom.strength;
    this.bloomPass.radius = P.bloom.radius;
    this.bloomPass.threshold = P.bloom.threshold;
    const u = this.uniforms;
    u.saturation.value = P.grade.saturation;
    u.vignette.value = P.grade.vignette;
    u.vignetteSoftness.value = P.grade.vignetteSoftness;
    u.chromaticAberration.value = P.grade.chromatic;
    u.tintColor.value.set(P.grade.tintColor);
    u.tintStrength.value = P.grade.tintStrength;
    u.ringLineWidth.value = P.timeRing.lineWidth;
    u.ringLineColor.value.set(P.timeRing.lineColor);
    u.ringLineIntensity.value = P.timeRing.lineIntensity;
    u.ringDistort.value = P.timeRing.distort;
    this._tweens = {};
  }

  // ── Effect API ─────────────────────────────────────────────────────────
  setSaturation(value, duration = 0) {
    this._tweenUniform('saturation', value, duration);
  }

  setTint(color, strength, duration = 0) {
    if (color != null) this.uniforms.tintColor.value.set(color);
    this._tweenUniform('tintStrength', strength, duration);
  }

  setChromatic(value, duration = 0) {
    this._tweenUniform('chromaticAberration', value, duration);
  }

  setVignette(value, duration = 0) {
    this._tweenUniform('vignette', value, duration);
  }

  // Additive white flash that decays to 0 over duration seconds.
  flash(strength, duration = 0.2, color = 0xffffff) {
    this._flash.strength = Math.max(strength, this.uniforms.flash.value);
    this._flash.duration = Math.max(duration, 1e-3);
    this._flash.t = 0;
    this.uniforms.flashColor.value.set(color);
  }

  // Time-stop ring centered on a world position; radius in meters (screen-parallel at that depth).
  setTimeRing(worldPos, radius, active) {
    if (worldPos) this._ringWorld.copy(worldPos);
    this._ringWorldRadius = Math.max(radius, 0);
    this._ringActive = typeof active === 'number' ? active : active ? 1 : 0;
  }

  // Opt an object (and its children) into the hero mask.
  addToMask(object) {
    object.traverse((o) => o.layers.enable(MASK_LAYER));
  }

  removeFromMask(object) {
    object.traverse((o) => o.layers.disable(MASK_LAYER));
  }

  _tweenUniform(name, to, duration) {
    const u = this.uniforms[name];
    if (duration <= 0) {
      u.value = to;
      delete this._tweens[name];
      return;
    }
    this._tweens[name] = { from: u.value, to, t: 0, duration };
  }

  // Real-time update of timed effects.
  update(realDt) {
    const u = this.uniforms;
    for (const name in this._tweens) {
      const tw = this._tweens[name];
      tw.t += realDt;
      const k = Math.min(tw.t / tw.duration, 1);
      const e = k * k * (3 - 2 * k);
      u[name].value = tw.from + (tw.to - tw.from) * e;
      if (k >= 1) delete this._tweens[name];
    }

    const f = this._flash;
    if (f.strength > 0) {
      f.t += realDt;
      const k = Math.min(f.t / f.duration, 1);
      u.flash.value = f.strength * (1 - k) * (1 - k);
      if (k >= 1) {
        f.strength = 0;
        u.flash.value = 0;
      }
    }
  }

  _updateRingUniforms(camera) {
    const u = this.uniforms;
    u.ringActive.value = this._ringActive;
    if (this._ringActive <= 0) return;
    const c = this._tmpV.copy(this._ringWorld).project(camera);
    u.ringCenter.value.set(c.x * 0.5 + 0.5, c.y * 0.5 + 0.5);
    // Radius: project a point offset along the camera's right axis at the same depth.
    const right = this._tmpV2.setFromMatrixColumn(camera.matrixWorld, 0);
    const e = right.multiplyScalar(this._ringWorldRadius).add(this._ringWorld).project(camera);
    // NDC x distance → screen-height units: dx_ndc/2 * aspect.
    u.ringRadius.value = Math.abs(e.x - c.x) * 0.5 * u.aspect.value;
  }

  _renderMask(camera) {
    const renderer = this.engine.renderer;
    const scene = this.engine.scene;
    const prevTarget = renderer.getRenderTarget();
    const prevBg = scene.background;
    const prevOverride = scene.overrideMaterial;
    const prevMask = camera.layers.mask;
    renderer.getClearColor(this._clearColor);
    const prevAlpha = renderer.getClearAlpha();

    scene.background = null;
    renderer.setRenderTarget(this.maskTarget);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, true, true);

    // 1) depth of everything the camera normally sees
    scene.overrideMaterial = this._maskDepthMat;
    renderer.render(scene, camera);
    // 2) masked objects in white, depth-tested against the scene (occluders stay gray)
    camera.layers.set(MASK_LAYER);
    scene.overrideMaterial = this._maskWhiteMat;
    renderer.autoClear = false;
    renderer.render(scene, camera);
    renderer.autoClear = true;

    camera.layers.mask = prevMask;
    scene.overrideMaterial = prevOverride;
    scene.background = prevBg;
    renderer.setClearColor(this._clearColor, prevAlpha);
    renderer.setRenderTarget(prevTarget);
  }

  render() {
    const camera = this.rig.activeCamera;
    this.renderPass.camera = camera;
    this._updateRingUniforms(camera);

    const ringOn = this._ringActive > 0;
    this.uniforms.useMask.value = ringOn ? 1 : 0;
    if (ringOn) this._renderMask(camera);

    this.engine.renderer.shadowMap.needsUpdate = true;
    this.composer.render();
  }
}
