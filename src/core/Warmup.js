import * as THREE from 'three';
import { buildEnemyRig } from '../voxel/models/EnemyModels.js';
import { buildBossRig } from '../voxel/models/BossModels.js';

/**
 * Shader warm-up (once, at load, behind the title screen). WebGL compiles a material's program the
 * first time it is drawn; on Windows (ANGLE → Direct3D) that can freeze the game for a noticeable
 * moment the first time a skill effect, enemy or boss appears. Here every hidden object in the
 * scene (FX pools, skill rings, afterimages, decals…) is made visible for one off-screen render,
 * one rig of each enemy and boss is added, and the time-stop mask path is exercised, so all
 * programs (colour, shadow depth, post passes) exist before play. Everything is restored after;
 * the extra rigs are kept (unrendered) so their programs are not released.
 */
export function warmUp({ engine, postFX }) {
  const scene = engine.scene;
  const hidden = [];
  scene.traverse((o) => {
    if (!o.visible) {
      hidden.push(o);
      o.visible = true;
    }
  });
  const extra = new THREE.Group();
  const keep = [];
  for (const t of ['ronin', 'teppo', 'tate']) keep.push(buildEnemyRig(t));
  for (const t of ['juggernaut', 'kitsune', 'raiju']) keep.push(buildBossRig(t));
  keep.forEach((r, i) => {
    r.group.position.set((i - 2.5) * 2, 0, 0);
    extra.add(r.group);
  });
  scene.add(extra);
  try {
    postFX.setTimeRing(new THREE.Vector3(), 6, true);
    postFX.render();
    postFX.setTimeRing(null, 0, false);
    postFX.render();
  } finally {
    scene.remove(extra);
    for (const o of hidden) o.visible = false;
  }
  return keep;
}
