import * as THREE from 'three';
import { VOXEL } from '../../config.js';
import { buildPart, withMirrorX } from '../VoxelBuilder.js';
import { HERO_PALETTE } from '../palettes.js';

// Stage 0 placeholder mannequin: ~20 blocks tall (2.4 m) at VOXEL scale, ~7 heads tall,
// legs ≈ half the height, broad shoulders tapering to a narrow waist, hero colors,
// glowing visor row and chest core, block sword in the right hand.
// The real rigged model replaces this in Stage 2.
//
// Grid: center column x ∈ [0, 1] (mirror axis 0.5), model faces +Z, feet at y = 0.
// Character's right side is −X (screen-left when facing the camera).
const AXIS = 0.5;

export const PLACEHOLDER_HERO_BOXES = [
  // Paired (defined on the right/−X side, mirrored to +X)
  ...withMirrorX(
    [
      { p: [-2, 0, -1], s: [2, 1, 3], c: 'darkSteel' }, // boot
      { p: [-2, 1, -1], s: [2, 4, 2], c: 'gunmetal' }, // shin
      { p: [-2, 2, 1], s: [2, 3, 1], c: 'ivory' }, // shin guard
      { p: [-2, 5, -1], s: [2, 1, 2], c: 'darkSteel' }, // knee joint
      { p: [-2, 6, -1], s: [2, 4, 2], c: 'gunmetal' }, // thigh
      { p: [-4, 10, -1], s: [2, 1, 2], c: 'darkSteel' }, // elbow joint
      { p: [-4, 11, -1], s: [2, 2, 2], c: 'gunmetal' }, // upper arm
      { p: [-5, 13, -2], s: [3, 1, 4], c: 'ivory' }, // pauldron, lower slab
      { p: [-4, 14, -1], s: [2, 1, 3], c: 'ivory' }, // pauldron, upper slab
      { p: [-2, 14, 1], s: [2, 2, 1], c: 'ivory' }, // chest plate
      { p: [-2, 14, -2], s: [1, 2, 1], c: 'gunmetal' }, // back fin
      { p: [-2, 16, -2], s: [1, 1, 1], c: 'worn' }, // back fin tip (cyan tip in the Stage 2 model)
    ],
    AXIS,
  ),

  // Center column / torso
  { p: [0, 8, -1], s: [1, 2, 2], c: 'darkSteel' }, // crotch
  { p: [-1, 6, 1], s: [3, 4, 1], c: 'crimson' }, // front waist sash (to the knees)
  { p: [-1, 7, -2], s: [3, 3, 1], c: 'crimson' }, // back sash
  { p: [-2, 10, -1], s: [5, 1, 3], c: 'crimson' }, // belt band
  { p: [-1, 11, -1], s: [3, 2, 3], c: 'darkSteel' }, // narrow waist
  { p: [-2, 13, -1], s: [5, 3, 2], c: 'gunmetal' }, // chest (back half)
  { p: [-2, 13, 1], s: [5, 1, 1], c: 'gunmetal' }, // chest lower front row
  { p: [0, 14, 1], s: [1, 1, 1], c: 'cyan', e: 3.2 }, // chest core
  { p: [0, 15, 1], s: [1, 1, 1], c: 'ivory' },
  { p: [0, 16, 0], s: [1, 1, 1], c: 'darkSteel' }, // neck
  { p: [-1, 16, -1], s: [3, 1, 1], c: 'gunmetal' }, // stepped neck flap
  { p: [-1, 17, -1], s: [3, 3, 2], c: 'gunmetal' }, // helmet
  { p: [-1, 17, 1], s: [3, 1, 1], c: 'darkSteel' }, // jaw mask
  { p: [-1, 18, 1], s: [3, 1, 1], c: 'cyan', e: 3.0 }, // visor row
  { p: [-1, 19, 1], s: [3, 1, 1], c: 'gunmetal' }, // brow
  { p: [0, 20, 0], s: [1, 1, 1], c: 'ivory' }, // crest base
  { p: [0, 21, 1], s: [1, 1, 1], c: 'ivory' }, // forward-swept crest

  // Right forearm (sword hand, −X)
  { p: [-4, 7, -1], s: [2, 3, 2], c: 'gunmetal' },
  { p: [-4, 6, -1], s: [2, 1, 2], c: 'darkSteel' }, // hand
  // Left gauntlet (+X), oversized, with claws and wrist housing
  { p: [3, 7, -1], s: [3, 3, 3], c: 'gunmetal' },
  { p: [5, 9, 1], s: [1, 1, 1], c: 'cyan', e: 2.2 }, // edge block
  { p: [3, 6, -1], s: [3, 1, 3], c: 'darkSteel' }, // wrist chain housing
  { p: [3, 5, 1], s: [1, 1, 1], c: 'ivory' }, // claw
  { p: [5, 5, 1], s: [1, 1, 1], c: 'ivory' }, // claw
  { p: [4, 5, -1], s: [1, 1, 1], c: 'ivory' }, // claw (thumb)
];

// Nodachi along local +Z from the grip: hilt, square guard, 8 two-block blade segments with a cyan edge row.
export function placeholderSwordBoxes() {
  const boxes = [
    { p: [0, 0, -2], s: [1, 1, 4], c: 'crimson' }, // hilt
    { p: [-1, -1, 2], s: [3, 3, 1], c: 'darkSteel' }, // guard
  ];
  for (let i = 0; i < 8; i++) {
    boxes.push({ p: [0, 0, 3 + i * 2], s: [1, 1, 2], c: i % 2 ? 'worn' : '#6E7480' }); // steel segment
    boxes.push({ p: [0, -1, 3 + i * 2], s: [1, 1, 2], c: 'cyan', e: 2.4 }); // edge row
  }
  return boxes;
}

export function buildPlaceholderHero() {
  const root = new THREE.Group();
  root.name = 'placeholderHero';

  const body = buildPart(PLACEHOLDER_HERO_BOXES, HERO_PALETTE, {
    voxelSize: VOXEL,
    origin: [-AXIS, 0, -0.5],
    seed: 7,
    name: 'heroBody',
  });
  root.add(body.group);

  const sword = buildPart(placeholderSwordBoxes(), HERO_PALETTE, {
    voxelSize: VOXEL,
    origin: [-0.5, -0.5, 0],
    seed: 9,
    name: 'heroSword',
  });
  // Grip at the center of the right hand block, blade low and outward (IMG-00 stance).
  const swordPivot = new THREE.Group();
  swordPivot.name = 'swordPivot';
  swordPivot.position.set((-3 - AXIS) * VOXEL, 6.5 * VOXEL, -0.5 * VOXEL);
  swordPivot.rotation.set(0.24, -1.0, 0, 'YXZ');
  swordPivot.add(sword.group);
  root.add(swordPivot);

  return { root, body, sword, swordPivot };
}
