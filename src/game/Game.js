import { CONFIG } from '../config.js';
import { ArenaMap } from '../world/ArenaMap.js';
import { Hero } from '../entities/Hero.js';
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

    this.map = new ArenaMap({ scene, rig });
    this.lighting = this.map.lighting; // debug panel compatibility

    this.hero = new Hero();
    scene.add(this.hero.group);
    postFX.addToMask(this.hero.group); // hero keeps full color inside the time-stop ring

    this.reticle = new MouseReticle();
    scene.add(this.reticle.mesh);

    this.voxelTest = buildVoxelTest();
    const vt = CONFIG.voxel.test.position;
    this.voxelTest.position.set(vt.x, 0, vt.z);
    scene.add(this.voxelTest);

    this.photoMode = false;
  }

  update(time, input) {
    this.hero.update(time.heroDt, input, this.rig);
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

  // Photo mode hides gameplay actors (enemies join in Stage 3).
  setPhotoMode(on) {
    this.photoMode = on;
    this.hero.group.visible = !on;
    this.reticle.visible = !on;
  }
}
