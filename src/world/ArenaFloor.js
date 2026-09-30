import * as THREE from 'three';
import { CONFIG, ARENA_RADIUS, ENV_BIG_VOXEL } from '../config.js';
import { QuadSink, BoxBatch, hash01 } from '../voxel/VoxelBuilder.js';
import { MAP_PALETTE, resolveColor } from '../voxel/palettes.js';
import { makeTileEdgeMaterial, makeSeamMaterial } from './mapMaterials.js';

const DEG = Math.PI / 180;
const FINE = ENV_BIG_VOXEL; // 0.5 m sub-grid used by the crest and for tile lips

// Center crest (spec §4): original emblem, 10×10 cells of 0.5 m (5 m across), rows back → front.
// R ring · B lightning bolt · S blade (passes behind the bolt) · C faint cyan block · . dark stone
const CREST = [
  '...RRCR...',
  '.RR....RR.',
  '.RS...B.R.',
  'R..S.BB..R',
  'C...BB...R',
  'R..BBBB..C',
  'R...BBS..R',
  '.R.BB..SR.',
  '.RRB...RR.',
  '...RCRR...',
];
const CREST_COLORS = { '.': '#16171d', R: '#4c5160', B: '#7b8190', S: '#8f96a5' };

// Arena floor (spec §4): 1 m basalt tiles on a grid centered on the origin. Tiles whose center
// lies inside ARENA_RADIUS are the play floor (stepped pixel circle, 2-block ring bands); tiles out
// to rimOuterRadius form the rim ledge that carries the balustrade and lanterns. Tops vary by
// ≤ 2 cm; tile borders are shaded procedurally. Cyan seams follow stepped ring-band edges and 4
// stepped radial lines, with a slow outward pulse on the world clock.
export class ArenaFloor {
  constructor() {
    const F = CONFIG.map.floor;
    this.group = new THREE.Group();
    this.group.name = 'arenaFloor';

    const R = ARENA_RADIUS;
    const n = Math.ceil(F.rimOuterRadius) + 1;
    this.tiles = new Map(); // key(i,j) → tile
    this.fine = new Map(); // key(fi,fj) → { h, color } at 0.5 m resolution
    const key = (i, j) => i * 4096 + j;
    this._key = key;

    const colors = {
      b1: resolveColor(MAP_PALETTE, 'basalt1'),
      b2: resolveColor(MAP_PALETTE, 'basalt2'),
      b3: resolveColor(MAP_PALETTE, 'basalt3'),
      moss: resolveColor(MAP_PALETTE, 'moss'),
    };
    const crestCol = {};
    for (const k in CREST_COLORS) crestCol[k] = new THREE.Color(CREST_COLORS[k]);
    const tileHeight = (a, b, s) => F.heightMin + hash01(s, a, b) * F.heightJitter;

    // ── Tiles
    for (let i = -n; i <= n; i++) {
      for (let j = -n; j <= n; j++) {
        const d = Math.hypot(i, j);
        const play = d < R;
        const rim = !play && d <= F.rimOuterRadius;
        if (!play && !rim) continue;
        const crest = Math.abs(i) <= F.crestHalf && Math.abs(j) <= F.crestHalf;
        const tile = { i, j, x: i, z: j, play, rim, crest, h: tileHeight(i, j, 5), color: new THREE.Color() };
        if (!crest) {
          let base;
          const moss = play
            ? d > F.mossFrom && hash01(17, i, j) < F.mossChance
            : hash01(19, i, j) < F.rimMossChance;
          if (moss) base = colors.moss;
          else if (play) base = Math.floor(d / F.bandWidth) % 2 === 0 ? colors.b2 : colors.b1;
          else base = colors.b3;
          const jit = play ? F.jitter : F.rimJitter;
          tile.color.copy(base).multiplyScalar(1 + (hash01(23, i, j) * 2 - 1) * jit);
          for (const fi of [2 * i - 1, 2 * i]) for (const fj of [2 * j - 1, 2 * j]) this.fine.set(key(fi, fj), tile);
        }
        this.tiles.set(key(i, j), tile);
      }
    }

    // Crest cells (0.5 m) replace the center tiles.
    this.crestCyan = [];
    const half = F.crestHalf + 0.5; // meters
    const cells = CREST.length;
    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        const ch = CREST[r][c];
        const x0 = -half + c * FINE;
        const z0 = -half + r * FINE;
        const fi = Math.round(x0 / FINE);
        const fj = Math.round(z0 / FINE);
        const cell = {
          x0, z0, size: FINE, h: tileHeight(fi, fj, 7),
          color: new THREE.Color(), cyan: ch === 'C',
        };
        const base = crestCol[ch === 'C' ? 'R' : ch];
        cell.color.copy(base).multiplyScalar(1 + (hash01(29, fi, fj) * 2 - 1) * F.jitter);
        this.fine.set(key(fi, fj), cell);
        if (cell.cyan) this.crestCyan.push(cell);
      }
    }

    this._buildFloorMesh();
    this._buildSeams();
  }

  _buildFloorMesh() {
    const F = CONFIG.map.floor;
    const sink = new QuadSink({ tileUv: 3 });
    const key = this._key;
    let uvTile = null;
    sink.extraFn = (_, x, y, z) => (uvTile ? [x - uvTile.x0, z - uvTile.z0, uvTile.size] : [0, 0, 0]);

    // Tops: one quad per 1 m tile, one per 0.5 m crest cell (cyan crest cells are emissive, drawn by the seams mesh).
    for (const t of this.tiles.values()) {
      if (t.crest) continue;
      uvTile = { x0: t.x - 0.5, z0: t.z - 0.5, size: 1 };
      sink.quad(1, 1, t.h, t.z - 0.5, t.z + 0.5, t.x - 0.5, t.x + 0.5, t.color.r, t.color.g, t.color.b);
    }
    const half = F.crestHalf + 0.5;
    for (let fi = -half / FINE; fi < half / FINE; fi++) {
      for (let fj = -half / FINE; fj < half / FINE; fj++) {
        const c = this.fine.get(key(fi, fj));
        if (!c || c.cyan) continue;
        uvTile = c;
        sink.quad(1, 1, c.h, c.z0, c.z0 + FINE, c.x0, c.x0 + FINE, c.color.r, c.color.g, c.color.b);
      }
    }
    uvTile = null;

    // Lips between cells of different height (0.5 m resolution) and the outer boundary down to y = 0.
    const lipShade = 0.78;
    const fineKeys = [];
    for (const t of this.tiles.values()) {
      if (t.crest) continue;
      for (const fi of [2 * t.i - 1, 2 * t.i]) for (const fj of [2 * t.j - 1, 2 * t.j]) fineKeys.push([fi, fj]);
    }
    for (let fi = -half / FINE; fi < half / FINE; fi++) for (let fj = -half / FINE; fj < half / FINE; fj++) fineKeys.push([fi, fj]);

    for (const [fi, fj] of fineKeys) {
      const a = this.fine.get(key(fi, fj));
      if (!a) continue;
      const x0 = fi * FINE, x1 = x0 + FINE, z0 = fj * FINE, z1 = z0 + FINE;
      const cr = a.color.r * lipShade, cg = a.color.g * lipShade, cb = a.color.b * lipShade;
      // ±X neighbours
      for (const sg of [-1, 1]) {
        const b = this.fine.get(key(fi + sg, fj));
        const other = b ? b.h : 0;
        if (b === a || other >= a.h) continue;
        sink.quad(0, sg, sg > 0 ? x1 : x0, other, a.h, z0, z1, cr, cg, cb);
      }
      // ±Z neighbours
      for (const sg of [-1, 1]) {
        const b = this.fine.get(key(fi, fj + sg));
        const other = b ? b.h : 0;
        if (b === a || other >= a.h) continue;
        sink.quad(2, sg, sg > 0 ? z1 : z0, x0, x1, other, a.h, cr, cg, cb);
      }
    }

    const geo = sink.toGeometry();
    this.floorMesh = new THREE.Mesh(geo, makeTileEdgeMaterial());
    this.floorMesh.name = 'arenaFloor:tiles';
    this.floorMesh.receiveShadow = true;
    this.group.add(this.floorMesh);
  }

  _buildSeams() {
    const F = CONFIG.map.floor;
    const S = CONFIG.map.seams;
    const R = ARENA_RADIUS;
    const batch = new BoxBatch();
    const cyan = resolveColor(MAP_PALETTE, 'seam');
    const hw = S.width / 2;
    const y0 = -0.01;
    const y1 = F.heightMin + F.heightJitter + S.height;
    const tileAt = (i, j) => this.tiles.get(this._key(i, j));
    const isPlay = (i, j) => {
      const t = tileAt(i, j);
      return !!t && t.play;
    };
    const n = Math.ceil(R) + 1;
    // Strip along the edge between tile (i,j) and its neighbour in direction (di,dj).
    const edge = (i, j, di, dj) => {
      if (di !== 0) {
        const x = i + di * 0.5;
        batch.add(x - hw, y0, j - 0.5 - hw, x + hw, y1, j + 0.5 + hw, cyan);
      } else {
        const z = j + dj * 0.5;
        batch.add(i - 0.5 - hw, y0, z - hw, i + 0.5 + hw, y1, z + hw, cyan);
      }
    };
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    // Ring-band edges.
    for (const ring of S.rings) {
      const inside = (i, j) => isPlay(i, j) && Math.hypot(i, j) < ring;
      for (let i = -n; i <= n; i++)
        for (let j = -n; j <= n; j++) {
          if (!inside(i, j)) continue;
          for (const [di, dj] of dirs) if (isPlay(i + di, j + dj) && !inside(i + di, j + dj)) edge(i, j, di, dj);
        }
    }

    // Stepped radial lines: boundaries between tiles on either side of the ray.
    for (const deg of S.radialAngles) {
      const a = deg * DEG;
      const sx = Math.sin(a), sz = Math.cos(a);
      const side = (i, j) => (i * sz - j * sx >= -1e-6 ? 1 : 0);
      const along = (i, j) => i * sx + j * sz;
      for (let i = -n; i <= n; i++)
        for (let j = -n; j <= n; j++) {
          if (!isPlay(i, j) || side(i, j) !== 1) continue;
          for (const [di, dj] of dirs) {
            const ni = i + di, nj = j + dj;
            if (!isPlay(ni, nj) || side(ni, nj) !== 0) continue;
            const mid = along(i + di * 0.5, j + dj * 0.5);
            if (mid < S.radialFrom || mid > S.radialTo) continue;
            edge(i, j, di, dj);
          }
        }
    }

    // Faint cyan crest blocks (whole 0.5 m cells).
    for (const c of this.crestCyan) {
      batch.add(c.x0, y0, c.z0, c.x0 + FINE, c.h, c.z0 + FINE, cyan, S.crestCyan);
    }

    this.seamMesh = batch.toMesh(makeSeamMaterial(), 'arenaFloor:seams');
    this.group.add(this.seamMesh);
  }

  // Top height of the platform at (x, z), or null when off the platform.
  heightAt(x, z) {
    const c = this.fine.get(this._key(Math.floor(x / FINE), Math.floor(z / FINE)));
    return c ? c.h : null;
  }

  // Rim-edge tiles: platform tiles with a missing 4-neighbour (foundation wall positions).
  boundaryTiles() {
    const out = [];
    for (const t of this.tiles.values()) {
      const k = this._key;
      if (!this.tiles.has(k(t.i + 1, t.j)) || !this.tiles.has(k(t.i - 1, t.j)) || !this.tiles.has(k(t.i, t.j + 1)) || !this.tiles.has(k(t.i, t.j - 1)))
        out.push(t);
    }
    return out;
  }

  hasTile(i, j) {
    return this.tiles.has(this._key(i, j));
  }
}
