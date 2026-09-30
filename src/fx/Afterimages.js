import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { buildHeroRig } from '../voxel/models/HeroModel.js';

/**
 * Hero afterimages: a small pool of ghost hero rigs (translucent additive cyan). `spawn(hero)`
 * snapshots the hero's current pose and transform into the next ghost, which fades out on the hero
 * clock. Used by the Thunderclaw pull-dash and Overdrive.
 */
export class Afterimages {
  constructor(scene, postFX) {
    const A = CONFIG.skills.afterimages;
    this.pool = [];
    for (let i = 0; i < A.pool; i++) {
      const rig = buildHeroRig();
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(A.color).multiplyScalar(1.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
      rig.opaqueMesh.material.dispose();
      rig.opaqueMesh.material = mat;
      rig.opaqueMesh.castShadow = false;
      rig.opaqueMesh.receiveShadow = false;
      if (rig.emissiveMesh) rig.emissiveMesh.visible = false;
      rig.group.visible = false;
      rig.group.name = 'fx:afterimage';
      scene.add(rig.group);
      postFX?.addToMask(rig.group);
      this.pool.push({ rig, mat, t: 0, life: A.life, active: false, color: new THREE.Color() });
    }
    this.next = 0;
  }

  spawn(hero, { color = CONFIG.skills.afterimages.color, life = CONFIG.skills.afterimages.life, opacity = CONFIG.skills.afterimages.opacity } = {}) {
    const g = this.pool[this.next];
    this.next = (this.next + 1) % this.pool.length;
    const src = hero.rig.boneList;
    const dst = g.rig.boneList;
    for (let i = 0; i < src.length; i++) {
      dst[i].position.copy(src[i].position);
      dst[i].quaternion.copy(src[i].quaternion);
      dst[i].scale.copy(src[i].scale);
    }
    hero.group.updateMatrixWorld(true);
    g.rig.group.position.setFromMatrixPosition(hero.rig.group.matrixWorld);
    g.rig.group.quaternion.setFromRotationMatrix(hero.rig.group.matrixWorld);
    g.rig.group.updateMatrixWorld(true);
    g.mat.color.set(color).multiplyScalar(1.4);
    g.opacity = opacity;
    g.mat.opacity = opacity;
    g.t = 0;
    g.life = life;
    g.active = true;
    g.rig.group.visible = true;
  }

  update(heroDt) {
    for (const g of this.pool) {
      if (!g.active) continue;
      g.t += heroDt;
      const k = g.t / g.life;
      if (k >= 1) {
        g.active = false;
        g.rig.group.visible = false;
        continue;
      }
      g.mat.opacity = g.opacity * (1 - k) * (1 - k);
    }
  }

  clear() {
    for (const g of this.pool) {
      g.active = false;
      g.rig.group.visible = false;
    }
  }
}
