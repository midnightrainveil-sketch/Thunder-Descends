import { CONFIG } from '../config.js';
import { Lighting } from '../world/Lighting.js';
import { PlaceholderArena } from '../world/PlaceholderArena.js';
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

    this.lighting = new Lighting(scene);
    this.arena = new PlaceholderArena();
    scene.add(this.arena.group);

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
    this.arena.update(time.worldDt, time.worldTime);
    this.voxelTest.visible = CONFIG.voxel.test.enabled;
  }

  updateFX(time, input) {
    this.reticle.update(time.realDt, input);
  }

  // Photo mode hides gameplay actors (enemies join in Stage 3).
  setPhotoMode(on) {
    this.photoMode = on;
    this.hero.group.visible = !on;
    this.reticle.visible = !on;
  }
}
