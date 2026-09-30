import * as THREE from 'three';
import { CONFIG, ARENA_RADIUS, FLOOR_BLOCK } from '../config.js';
import { buildPart, BoxBatch, getEmissiveMaterial } from '../voxel/VoxelBuilder.js';
import { MAP_PALETTE, resolveColor } from '../voxel/palettes.js';
import { getBlockEdgeMaterial } from '../voxel/blockEdgeMaterial.js';

// Arena helpers live in ArenaBounds.js so Stage 1 keeps them; re-exported here for convenience.
export { clampToArena, isInsideArena, randomRimPoint } from './ArenaBounds.js';

// Stage 0 placeholder: flat stepped circle of 1 m basalt blocks, alternating ring bands,
// cyan glow lines on a couple of stepped ring edges and a stepped foundation wall.
// Exists only to test framing, lighting and bloom; replaced by the full map in Stage 1.
export class PlaceholderArena {
  constructor() {
    const A = CONFIG.arena;
    this.group = new THREE.Group();
    this.group.name = 'placeholderArena';

    const R = ARENA_RADIUS;
    const n = Math.ceil(R) + 1;
    const inFloor = (i, j, radius) => {
      // Cell [i, i+1] × [j, j+1] (block units) is part of the floor if it touches the disc,
      // so the stepped edge always covers the true circle used for movement.
      const nx = Math.max(i, Math.min(0, i + 1));
      const nz = Math.max(j, Math.min(0, j + 1));
      return nx * nx + nz * nz < radius * radius;
    };
    const centerDist = (i, j) => Math.hypot(i + 0.5, j + 0.5);

    // Floor slab (top at y = 0) and foundation tiers.
    const floor = [];
    const wall = [];
    for (let i = -n; i < n; i++) {
      for (let j = -n; j < n; j++) {
        if (!inFloor(i, j, R)) continue;
        const band = Math.floor(centerDist(i, j) / A.bandWidth);
        floor.push({ p: [i, -1, j], s: [1, 1, 1], c: band % 2 === 0 ? 'basalt2' : 'basalt1' });

        const edge1 = !inFloor(i + 1, j, R) || !inFloor(i - 1, j, R) || !inFloor(i, j + 1, R) || !inFloor(i, j - 1, R);
        if (edge1) {
          for (let y = 0; y < A.foundationDepth; y++) wall.push({ p: [i, -2 - y, j], s: [1, 1, 1], c: y % 2 ? 'basalt2' : 'basalt1' });
        }
        const R2 = R - A.foundationInset;
        if (inFloor(i, j, R2)) {
          const edge2 = !inFloor(i + 1, j, R2) || !inFloor(i - 1, j, R2) || !inFloor(i, j + 1, R2) || !inFloor(i, j - 1, R2);
          if (edge2) {
            for (let y = 0; y < A.foundationTier2Depth; y++)
              wall.push({ p: [i, -2 - A.foundationDepth - y, j], s: [1, 1, 1], c: y % 2 ? 'basalt3' : 'basalt2' });
          }
        }
      }
    }

    this.floorPart = buildPart(floor, MAP_PALETTE, {
      voxelSize: FLOOR_BLOCK,
      jitter: A.floorJitter,
      seed: 11,
      castShadow: false,
      receiveShadow: true,
      material: getBlockEdgeMaterial(FLOOR_BLOCK),
      name: 'arenaFloor',
    });
    this.wallPart = buildPart(wall, MAP_PALETTE, {
      voxelSize: FLOOR_BLOCK,
      jitter: A.wallJitter,
      seed: 23,
      castShadow: false,
      receiveShadow: true,
      material: getBlockEdgeMaterial(FLOOR_BLOCK),
      name: 'arenaFoundation',
    });
    this.group.add(this.floorPart.group, this.wallPart.group);

    // Glow seams along the stepped edges of selected ring radii.
    const seams = new BoxBatch();
    const cyan = resolveColor(MAP_PALETTE, 'seam');
    const hw = A.seamWidth / 2;
    const y0 = -0.02;
    const y1 = A.seamHeight;
    for (const ring of A.seamRings) {
      const inside = (i, j) => inFloor(i, j, R) && centerDist(i, j) < ring;
      for (let i = -n; i < n; i++) {
        for (let j = -n; j < n; j++) {
          if (!inside(i, j)) continue;
          if (!inside(i + 1, j)) seams.add(i + 1 - hw, y0, j - hw, i + 1 + hw, y1, j + 1 + hw, cyan, A.seamIntensity);
          if (!inside(i - 1, j)) seams.add(i - hw, y0, j - hw, i + hw, y1, j + 1 + hw, cyan, A.seamIntensity);
          if (!inside(i, j + 1)) seams.add(i - hw, y0, j + 1 - hw, i + 1 + hw, y1, j + 1 + hw, cyan, A.seamIntensity);
          if (!inside(i, j - 1)) seams.add(i - hw, y0, j - hw, i + 1 + hw, y1, j + hw, cyan, A.seamIntensity);
        }
      }
    }
    this.seamMesh = seams.toMesh(getEmissiveMaterial(), 'arenaSeams');
    if (this.seamMesh) this.group.add(this.seamMesh);
  }

  update(/* worldDt, worldTime */) {
    // Stage 1: seam pulse, lantern flicker, etc. (world clock).
  }
}
