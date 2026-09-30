import * as THREE from 'three';
import { ArenaFloor } from './ArenaFloor.js';
import { Rim } from './Rim.js';
import { Terrain } from './Terrain.js';
import { Structures } from './Structures.js';
import { SakuraGrove } from './SakuraTree.js';
import { Petals } from './Petals.js';
import { Sky } from './Sky.js';
import { Mountains } from './Mountains.js';
import { Mist } from './Mist.js';
import { Lighting } from './Lighting.js';
import { Wind } from './Wind.js';
import { syncMapUniforms } from './mapMaterials.js';

// The circular sakura shrine arena (spec §4, Stage 1). Owns every map piece and runs them on the
// world clock: seam pulse, tree sway, petals, mist, clouds, stars and lantern flicker all freeze
// when worldScale is 0.
export class ArenaMap {
  constructor({ scene, rig }) {
    this.scene = scene;
    this.rig = rig;
    this.group = new THREE.Group();
    this.group.name = 'arenaMap';

    this.wind = new Wind();
    this.floor = new ArenaFloor();
    this.rim = new Rim(this.floor);
    this.terrain = new Terrain(this.floor);
    this.structures = new Structures(rig);
    this.sky = new Sky(rig);
    this.mountains = new Mountains(this.structures.pagodaSite);
    this.mist = new Mist(this.wind);
    this.lighting = new Lighting(scene, this.sky);

    // Ground height: platform tiles, then terrain; null = void (mist).
    this.groundHeightAt = (x, z) => {
      const h = this.floor.heightAt(x, z);
      return h != null ? h : this.terrain.heightAt(x, z);
    };

    this.grove = new SakuraGrove({ groundHeightAt: this.groundHeightAt, camera: rig.compositionCamera });
    this.petals = new Petals({
      groundHeightAt: this.groundHeightAt,
      canopyPoints: this.grove.canopyPoints,
      treeBases: this._treeBases(),
      wind: this.wind,
    });

    this.group.add(
      this.floor.group,
      this.rim.group,
      this.terrain.group,
      this.structures.group,
      this.grove.group,
      this.petals.mesh,
      this.sky.group,
      this.mountains.mesh,
      this.mist.group,
    );
    scene.add(this.group);
  }

  _treeBases() {
    return this.grove.trees.map((t) => ({ x: t.position.x, z: t.position.z, spread: Math.max(1.5, t.data.maxR * 0.95) }));
  }

  // World clock update (dt = time.worldDt).
  update(time, camera) {
    const dt = time.worldDt;
    this.wind.update(dt, time.worldTime);
    syncMapUniforms(time.worldTime, this.wind);
    this.rim.update(dt, time.worldTime, this.wind);
    this.petals.update(dt);
    this.mist.update();
    this.sky.update(time.worldTime, camera);
  }

  // Camera refit (resize / camera edits): moon stays at its screen position, light follows it.
  onCameraChanged() {
    this.sky.placeMoon();
    this.lighting.applySettings();
    this.grove.updateCheck();
  }

  rebuildTrees() {
    this.grove.build();
    this.petals.canopyPoints = this.grove.canopyPoints;
    this.petals.treeBases = this._treeBases();
    this.rebuildPetals();
  }

  rebuildPetals() {
    this.group.remove(this.petals.mesh);
    this.petals.build();
    this.group.add(this.petals.mesh);
  }

  rebuildMist() {
    this.mist.build();
  }

  // ── Gameplay API passthroughs (later stages) ────────────────────────────
  petalImpulse(center, radius, strength) {
    this.petals.impulse(center, radius, strength);
  }
  petalSweep(origin, dir, arcDeg, reach, strength, spin = 1) {
    this.petals.sweep(origin, dir, arcDeg, reach, strength, spin);
  }
  petalVortex(center, radius, strength) {
    this.petals.vortex(center, radius, strength);
  }

  // Environment draw calls: visible meshes under the map (main pass) and shadow casters (shadow pass).
  countDrawCalls() {
    let main = 0;
    let shadow = 0;
    this.group.traverseVisible((o) => {
      if (!(o.isMesh || o.isPoints || o.isLine)) return;
      if (o.isInstancedMesh && o.count === 0) return;
      const mats = Array.isArray(o.material) ? o.material.length : 1;
      main += mats;
      if (o.castShadow) shadow += mats;
    });
    return { main, shadow, total: main + shadow };
  }
}
