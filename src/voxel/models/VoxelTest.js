import * as THREE from 'three';
import { VOXEL, BOSS_VOXEL, ENV_VOXEL } from '../../config.js';
import { buildPart, withMirrorX } from '../VoxelBuilder.js';
import { ALL_PALETTE } from '../palettes.js';

// Debug "voxel test" model: the same small totem at VOXEL, BOSS_VOXEL and ENV_VOXEL scale.
// Proves grid snapping (a deliberately off-grid box snaps), per-block jitter (a 5×5 plate of
// identical blocks reads as separate cubes) and emissive bloom (cyan/ember/magenta/yellow cubes).
function totemBoxes() {
  const boxes = [];
  // Jitter plate: 25 separate same-color blocks (exaggerated jitter so the effect is obvious).
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) boxes.push({ p: [x, 0, z], s: [1, 1, 1], c: 'basalt1', j: 0.15 });
  boxes.push({ p: [-1, 1, -1], s: [3, 5, 3], c: 'gunmetal' }); // pillar
  boxes.push({ p: [-1, 3, 2], s: [3, 1, 1], c: 'crimson' }); // color-blocked band
  boxes.push({ p: [-1.4, 6.3, -0.8], s: [3.2, 0.9, 2.6], c: 'ivory' }); // off-grid → snaps to p[-1,6,-1] s[3,1,3]
  boxes.push({ p: [0, 7, 0], s: [1, 1, 1], c: 'cyan', e: 3 }); // emissive top
  boxes.push(...withMirrorX([{ p: [-2, 5, 0], s: [1, 1, 1], c: 'ember', e: 3 }], 0.5)); // ember pair
  boxes.push({ p: [0, 4, 2], s: [1, 1, 1], c: 'kitsune', e: 2.5 });
  boxes.push({ p: [0, 2, 2], s: [1, 1, 1], c: 'raiju', e: 2.5 });
  return boxes;
}

export function buildVoxelTest() {
  const group = new THREE.Group();
  group.name = 'voxelTest';
  const boxes = totemBoxes();
  let x = 0;
  for (const size of [VOXEL, BOSS_VOXEL, ENV_VOXEL]) {
    const part = buildPart(boxes, ALL_PALETTE, { voxelSize: size, origin: [-0.5, 0, -0.5], seed: 3, name: `voxelTest@${size}` });
    part.group.position.x = x;
    x += size * 5 + 0.6;
    group.add(part.group);
  }
  return group;
}
