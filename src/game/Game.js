import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { ArenaMap } from '../world/ArenaMap.js';
import { spawnGates, randomRimPoint } from '../world/ArenaBounds.js';
import { Hero } from '../entities/Hero.js';
import { Enemy } from '../entities/Enemy.js';
import { MouseReticle } from '../fx/MouseReticle.js';
import { buildVoxelTest } from '../voxel/models/VoxelTest.js';

// Owns the world and entities. Each system picks its clock explicitly:
// world → time.worldDt, hero → time.heroDt, UI-like FX → time.realDt.
export class Game {
  constructor({ engine, rig, postFX }) {
    this.engine = engine;
    this.rig = rig;
    this.postFX = postFX;
    const scene = engine.scene;
    this.scene = scene;

    this.map = new ArenaMap({ scene, rig });
    this.lighting = this.map.lighting; // debug panel compatibility

    this.hero = new Hero();
    scene.add(this.hero.group);
    scene.add(this.hero.trail.mesh);
    postFX.addToMask(this.hero.group); // hero keeps full color inside the time-stop ring
    postFX.addToMask(this.hero.trail.mesh);

    this.enemies = [];

    this.reticle = new MouseReticle();
    scene.add(this.reticle.mesh);

    this.voxelTest = buildVoxelTest();
    const vt = CONFIG.voxel.test.position;
    this.voxelTest.position.set(vt.x, 0, vt.z);
    scene.add(this.voxelTest);

    this.photoMode = false;
  }

  // Debug spawn (keys 1/2/3): from a balustrade gate ≥ spawnMinDist from the hero, else a rim point.
  spawnEnemy(type) {
    const E = CONFIG.enemies;
    const far = spawnGates.filter((g) => g.spawn.distanceTo(this.hero.position) >= E.spawnMinDist);
    const pos = far.length ? far[Math.floor(Math.random() * far.length)].spawn.clone() : randomRimPoint(this.hero.position, E.spawnMinDist, new THREE.Vector3());
    const enemy = new Enemy(type, pos);
    enemy.group.visible = !this.photoMode;
    this.enemies.push(enemy);
    this.scene.add(enemy.group);
    return enemy;
  }

  clearEnemies() {
    for (const e of this.enemies) {
      this.scene.remove(e.group);
      e.dispose();
    }
    this.enemies.length = 0;
  }

  update(time, input) {
    this.hero.update(time.heroDt, input, this.rig);
    for (const e of this.enemies) e.update(time.worldDt, this.hero, this.enemies);
    this.map.update(time, this.rig.activeCamera);
    this.voxelTest.visible = CONFIG.voxel.test.enabled;
  }

  updateFX(time, input) {
    this.reticle.update(time.realDt, input);
  }

  // The fixed camera was refit (resize or debug edit).
  onCameraChanged() {
    this.map.onCameraChanged();
  }

  // Photo mode hides gameplay actors.
  setPhotoMode(on) {
    this.photoMode = on;
    this.hero.group.visible = !on;
    this.hero.trail.mesh.visible = !on;
    for (const e of this.enemies) e.group.visible = !on;
    this.reticle.visible = !on;
  }
}
