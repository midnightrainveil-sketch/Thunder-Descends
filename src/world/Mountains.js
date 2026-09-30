import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { BoxBatch, hash01, makeRng, getOpaqueMaterial } from '../voxel/VoxelBuilder.js';

const DEG = Math.PI / 180;

// Three layered big-block mountain ridges around the back and sides (spec §4). The fixed camera
// looks down on them, so each layer is a band of stepped karst cones (block pyramids) rising out of
// the mist sea. Farther layers use bigger blocks, lighter/bluer colors and pick up more distance fog
// (atmospheric perspective); lower blocks fade toward the mist color. One layer carries a
// flat-topped peak for the pagoda.
export class Mountains {
  // pagodaSite: { x, z, y } world position of the pagoda base (gets its own flat-topped peak).
  constructor(pagodaSite = null) {
    const M = CONFIG.map.mountains;
    const P = CONFIG.map.pagoda;
    const mistCol = new THREE.Color(CONFIG.map.mist.color);
    const batch = new BoxBatch();
    const col = new THREE.Color();
    const a0 = M.arcDeg[0] * DEG;
    const a1 = M.arcDeg[1] * DEG;

    M.layers.forEach((L, li) => {
      const rng = makeRng(700 + li * 31);
      const base = new THREE.Color(L.color);
      const depth = M.rows * L.block;
      // Peaks: { a (rad), r (m), h (top y), slope, plateau (m) }.
      const peaks = [];
      const count = Math.round(((a1 - a0) * L.radius) / (L.block * L.spacing));
      for (let k = 0; k < count; k++) {
        const a = a0 + ((k + 0.5 + (rng() - 0.5) * 0.8) / count) * (a1 - a0);
        const h = L.low + (L.high - L.low) * Math.pow(rng(), M.peakPower);
        peaks.push({ a, r: L.radius + rng() * depth, h, slope: L.slope * (0.8 + rng() * 0.4), plateau: 0 });
      }

      for (let row = 0; row < M.rows; row++) {
        const r = L.radius + (row + 0.5) * L.block;
        const step = L.block / r;
        const n = Math.ceil((a1 - a0) / step);
        for (let k = 0; k <= n; k++) {
          const a = a0 + k * step;
          let top = L.base;
          for (const pk of peaks) {
            const d = Math.hypot((a - pk.a) * r, r - pk.r);
            top = Math.max(top, pk.h - Math.max(0, d - pk.plateau) * pk.slope);
          }
          // Sink toward the arc ends so ridges fade into the mist at the sides.
          const edge = Math.min(1, Math.min(a - a0, a1 - a) / (22 * DEG));
          top = L.base + (top - L.base) * (0.3 + 0.7 * edge);
          const levels = Math.round((top - L.base) / L.block);
          if (levels < 1) continue;
          const cx = Math.sin(a) * r;
          const cz = Math.cos(a) * r;
          const hb = L.block / 2;
          for (let y = 0; y < levels; y++) {
            const y0 = L.base + y * L.block;
            const low = 1 - y / Math.max(1, levels - 1);
            col.copy(base).multiplyScalar(0.9 + hash01(500 + li, k, y * 7 + row) * 0.2);
            col.lerp(mistCol, low * low * 0.4);
            if (y === levels - 1) col.multiplyScalar(1.15); // moonlit top block
            batch.add(cx - hb, y0, cz - hb, cx + hb, y0 + L.block, cz + hb, col, 1, true);
          }
        }
      }
    });
    // The pagoda's own stepped peak: a block pyramid with a flat top under the pagoda.
    if (pagodaSite) {
      const L = M.layers[P.layer];
      const base = new THREE.Color(L.color);
      const B = L.block;
      const top = P.y;
      const levels = Math.round((top - L.base) / B);
      const reach = P.plateau + (levels * B) / L.slope;
      const n = Math.ceil(reach / B);
      for (let ix = -n; ix <= n; ix++) {
        for (let iz = -n; iz <= n; iz++) {
          const d = Math.hypot(ix * B, iz * B);
          const h = top - Math.max(0, d - P.plateau) * L.slope;
          const lv = Math.round((h - L.base) / B);
          if (lv < 1) continue;
          const cx = pagodaSite.x + ix * B;
          const cz = pagodaSite.z + iz * B;
          for (let y = 0; y < lv; y++) {
            const y0 = L.base + y * B;
            const low = 1 - y / Math.max(1, levels - 1);
            col.copy(base).multiplyScalar(0.9 + hash01(900, ix * 31 + iz, y) * 0.2);
            col.lerp(mistCol, low * low * 0.4);
            if (y === lv - 1) col.multiplyScalar(1.15);
            batch.add(cx - B / 2, y0, cz - B / 2, cx + B / 2, y0 + B, cz + B / 2, col, 1, true);
          }
        }
      }
    }
    this.mesh = batch.toMesh(getOpaqueMaterial(0.95, 0), 'mountains');
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
  }
}
