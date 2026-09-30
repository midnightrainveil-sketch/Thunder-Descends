import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { buildHeroRig } from '../voxel/models/HeroModel.js';
import { buildEnemyRig } from '../voxel/models/EnemyModels.js';
import { Animator } from '../anim/Animator.js';
import { heroClips, HERO_UPPER_MASK } from '../anim/clips/heroClips.js';
import { enemyClips } from '../anim/clips/enemyClips.js';

// Model viewer (debug hotkey M): shows one rig on the arena with the orbit camera, plays any clip
// (real time, independent of the game clocks), scrubs, and can mark every joint pivot.
export class ModelViewer {
  constructor(debug) {
    this.debug = debug;
    this.active = false;
    this.state = { model: 'hero', clip: 'idle', speed: 1, paused: false, time: 0, pivots: false, loopOneShots: true };
    this.rig = null;
    this.animator = null;
    this.pivotGroup = null;
  }

  clipNames() {
    if (!this.animator) return ['idle'];
    return Object.keys(this.animator.clips);
  }

  _build() {
    this._dispose();
    const type = this.state.model;
    const scene = this.debug.engine.scene;
    if (type === 'hero') {
      this.rig = buildHeroRig();
      this.animator = new Animator(this.rig, heroClips());
      this.animator.addLayer('base');
      this.animator.addLayer('upper', { mask: this.animator.mask(HERO_UPPER_MASK), weight: 0 });
    } else {
      this.rig = buildEnemyRig(type);
      this.animator = new Animator(this.rig, enemyClips(type));
      this.animator.addLayer('base');
    }
    const V = CONFIG.debug.modelViewer;
    this.rig.group.position.set(V.position.x, 0, V.position.z);
    scene.add(this.rig.group);
    this.pivotGroup = new THREE.Group();
    const geo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe14a, depthTest: false, toneMapped: false });
    for (const b of this.rig.boneList) {
      const m = new THREE.Mesh(geo, mat);
      m.renderOrder = 20;
      m.userData.bone = b;
      this.pivotGroup.add(m);
    }
    scene.add(this.pivotGroup);
    this.play(this.state.clip in this.animator.clips ? this.state.clip : 'idle');
  }

  play(name) {
    if (!this.animator || !this.animator.clips[name]) return;
    this.state.clip = name;
    this.state.time = 0;
    const isUpper = /^attack\d$/.test(name) && this.animator.upper;
    if (isUpper) {
      this.animator.base.play('idle', { fade: 0 });
      this.animator.upper.play(name, { fade: 0 });
      this.animator.upper.weight = this.animator.upper.targetWeight = 1;
    } else {
      this.animator.base.play(name, { fade: 0.1 });
      if (this.animator.upper) this.animator.upper.fadeOut(0.1);
    }
  }

  enable(on = !this.active) {
    this.active = on;
    const game = this.debug.game;
    if (on) {
      this._build();
      game.setPhotoMode(true);
      this.debug.toggleOrbit(true);
      const V = CONFIG.debug.modelViewer;
      const cam = this.debug.orbitCamera;
      this.debug.orbit.target.set(V.position.x, V.height * 0.9, V.position.z);
      cam.position.set(V.position.x + V.distance * 0.45, V.height + 0.6, V.position.z + V.distance);
      this.debug.orbit.update();
    } else {
      this._dispose();
      game.setPhotoMode(this.debug.flags.photo);
      this.debug.toggleOrbit(false);
    }
  }

  setModel(type) {
    this.state.model = type;
    if (this.active) this._build();
  }

  update(realDt) {
    if (!this.active || !this.animator) return;
    const dt = this.state.paused ? 0 : realDt * this.state.speed;
    const clip = this.animator.clips[this.state.clip];
    this.state.time += dt;
    if (clip && !clip.loop && this.state.loopOneShots && this.state.time > clip.duration + 0.5) this.play(this.state.clip);
    this.animator.update(dt);
    this.rig.group.updateMatrixWorld(true);
    this.pivotGroup.visible = this.state.pivots;
    if (this.state.pivots) for (const m of this.pivotGroup.children) m.userData.bone.getWorldPosition(m.position);
  }

  // Scrub: jump the current clip to normalized time u (paused).
  scrub(u) {
    if (!this.animator) return;
    const clip = this.animator.clips[this.state.clip];
    for (const l of this.animator.layers) for (const e of l.entries) if (e.clip === clip) e.time = u * clip.duration;
    this.state.paused = true;
    this.animator.update(0);
  }

  _dispose() {
    const scene = this.debug.engine.scene;
    if (this.rig) {
      scene.remove(this.rig.group);
      this.rig.dispose();
      this.rig = null;
    }
    if (this.pivotGroup) {
      scene.remove(this.pivotGroup);
      this.pivotGroup = null;
    }
    this.animator = null;
  }
}
