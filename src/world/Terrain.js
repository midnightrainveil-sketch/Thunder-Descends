import * as THREE from 'three';
import { CONFIG, FLOOR_BLOCK } from '../config.js';
import { buildPart, hash01 } from '../voxel/VoxelBuilder.js';
import { MAP_PALETTE } from '../voxel/palettes.js';
import { getBlockEdgeMaterial } from '../voxel/blockEdgeMaterial.js';

// Hilltop terrain around the back and sides of the platform (spec §4): 1 m block columns on the
// same tile grid as the floor, stepping down away from the rim and ending in cliffs that drop into
// the mist. Flat landing for the torii, a cut for the steps, a lower path and the shrine terrace.
// Nothing in the front arc: the platform edge drops straight into mist there.
export class Terrain {
  constructor(floor) {
    const T = CONFIG.map.terrain;
    const FL = CONFIG.map.floor;
    const tor = CONFIG.map.torii;
    const st = CONFIG.map.steps;
    const sh = CONFIG.map.shrine;
    this.group = new THREE.Group();
    this.group.name = 'terrain';
    this.heights = new Map();
    const key = (i, j) => i * 4096 + j;
    this._key = key;

    // Zones in meters.
    const stepsHalfW = (st.width * 0.5) / 2 + 0.5; // stair cut half width incl. side walls
    const landingZ0 = tor.z + 1.6; // front edge of the landing (toward the arena)
    const stairZ0 = tor.z - CONFIG.map.steps.offset; // stairs start behind the torii
    const stairZ1 = stairZ0 - st.count * st.depth * 0.5;
    const inRect = (x, z, x0, x1, z0, z1) => x >= x0 && x <= x1 && z >= z0 && z <= z1;

    const rMax = Math.max(T.backRadius, T.sideRadius) + 3;
    for (let i = -rMax; i <= rMax; i++) {
      for (let j = -rMax; j <= rMax; j++) {
        if (floor.hasTile(i, j)) continue;
        const d = Math.hypot(i, j);
        if (d <= FL.rimOuterRadius) continue;
        const ang = (Math.atan2(i, j) * 180) / Math.PI; // from +Z toward +X
        const fromBack = Math.abs(180 - Math.abs(ang)); // 0 at the back
        if (fromBack > T.backArcDeg) continue;
        const u = fromBack / T.backArcDeg;
        const edgeNoise = (hash01(81, i >> 1, j >> 1) - 0.5) * 3;
        const rOuter = T.backRadius + (T.sideRadius - T.backRadius) * Math.pow(u, 1.4) + edgeNoise;
        if (d > rOuter) continue;

        let h = T.nearHeight + T.slope * (d - FL.rimOuterRadius) + (hash01(83, i >> 1, j >> 1) - 0.5) * T.noise
          + (hash01(85, i, j) - 0.5) * T.noise * 0.4;
        h = Math.round(h);
        const x = i, z = j;
        // Torii landing flush with the platform.
        if (inRect(x, z, tor.x - 5, tor.x + 5, stairZ0, landingZ0)) h = 0;
        // Banks on both sides of the stairs stay high.
        else if (inRect(x, z, tor.x - stepsHalfW - 2.5, tor.x + stepsHalfW + 2.5, stairZ1, stairZ0)) {
          h = inRect(x, z, tor.x - stepsHalfW, tor.x + stepsHalfW, stairZ1, stairZ0) ? st.cutDepth : Math.min(0, Math.max(h, -1));
        }
        // Lower path behind the stairs, rising in 1 m steps to the shrine terrace.
        const pathY = -st.count * st.rise * 0.5;
        const terraceZ = sh.z + 3.5;
        if (inRect(x, z, tor.x - stepsHalfW + 0.5, tor.x + stepsHalfW - 0.5, terraceZ, stairZ1)) {
          const u = (stairZ1 - z) / Math.max(1, stairZ1 - terraceZ); // 0 at the stairs → 1 at the terrace
          h = Math.round(pathY + (sh.y - pathY) * Math.max(0, u * 1.4 - 0.4));
        }
        if (inRect(x, z, sh.x - 5, sh.x + 5, sh.z - 4, terraceZ)) h = sh.y;
        this.heights.set(key(i, j), h);
      }
    }

    // Columns: moss/basalt top block + dark column below, down to the cliff bottom.
    const boxes = [];
    for (const [k, h] of this.heights) {
      const i = Math.round(k / 4096);
      const j = k - i * 4096;
      const top = hash01(87, i, j) < T.mossChance ? 'moss' : hash01(89, i, j) < 0.5 ? 'basalt1' : 'basalt2';
      boxes.push({ p: [i, h - 1, j], s: [1, 1, 1], c: top });
      const below = h - 1 - T.bottom;
      if (below > 0) boxes.push({ p: [i, T.bottom, j], s: [1, below, 1], c: hash01(91, i, j) < 0.5 ? 'basalt3' : 'basalt2' });
    }
    this.part = buildPart(boxes, MAP_PALETTE, {
      voxelSize: FLOOR_BLOCK,
      origin: [-0.5, 0, -0.5],
      jitter: T.jitter,
      seed: 93,
      castShadow: false,
      faceShade: { top: 1.0, side: 0.85, bottom: 0.6 },
      material: getBlockEdgeMaterial(FLOOR_BLOCK, { offset: 0.5 }),
      name: 'terrain',
    });
    this.group.add(this.part.group);
  }

  // Top height at (x, z), or null when there is no terrain there.
  heightAt(x, z) {
    const h = this.heights.get(this._key(Math.round(x), Math.round(z)));
    return h === undefined ? null : h;
  }
}
