import { withMirrorX, splitCells, makeRng } from '../VoxelBuilder.js';

// Voxel box lists for the shrine props (IMG-02). Grid units; the voxel size is chosen by the
// caller (ENV_VOXEL for lanterns/balustrade, ENV_BIG_VOXEL for torii/shrine/steps).
// Models are centered on x = 0 / z = 0 with mirror axis 0 (even widths) unless noted.

// Stone tōrō lantern, 0.25 m blocks, ~2 m tall, 4×4 footprint.
export function lanternBoxes() {
  return [
    { p: [-2, 0, -2], s: [4, 1, 4], c: 'basalt2' }, // base
    { p: [-1, 1, -1], s: [2, 2, 2], c: 'basalt1' }, // pillar
    { p: [-2, 3, -2], s: [4, 1, 4], c: 'basalt2' }, // platform
    { p: [-2, 4, -2], s: [1, 2, 1], c: 'basalt1' }, // fire box corner posts
    { p: [1, 4, -2], s: [1, 2, 1], c: 'basalt1' },
    { p: [-2, 4, 1], s: [1, 2, 1], c: 'basalt1' },
    { p: [1, 4, 1], s: [1, 2, 1], c: 'basalt1' },
    { p: [-1, 4, -1], s: [2, 2, 2], c: 'lantern', e: 1 }, // fire (emissive; intensity set by instance color)
    { p: [-3, 6, -3], s: [6, 1, 6], c: 'basalt3' }, // roof
    { p: [-2, 7, -2], s: [4, 1, 4], c: 'basalt2' }, // roof step
    { p: [-1, 8, -1], s: [2, 1, 2], c: 'basalt1' }, // cap
    { p: [-3, 6, 2], s: [2, 1, 1], c: 'moss' }, // moss on the roof edge
    { p: [1, 7, -2], s: [1, 1, 1], c: 'moss' },
  ];
}

// Balustrade post, 0.25 m blocks: 2×2 footprint, 0.75 m tall with a cap.
export function balustradePostBoxes() {
  return [
    { p: [-1, 0, -1], s: [2, 2, 2], c: 'basalt1' },
    { p: [-1, 2, -1], s: [2, 1, 2], c: 'basalt2' },
  ];
}

// Balustrade rail segment along local +X, `len` blocks, 0.5 m tall: feet with openings + top rail.
// Centered on x (origin handled by the caller: −len/2) and z (−0.5).
export function balustradeRailBoxes(len) {
  const boxes = [];
  for (let x = 0; x < len; x += 2) boxes.push({ p: [x, 0, 0], s: [1, 1, 1], c: 'basalt2' });
  boxes.push({ p: [0, 1, 0], s: [len, 1, 1], c: 'basalt1' });
  boxes.push({ p: [Math.floor(len / 2) + 1, 1, 0], s: [1, 1, 1], c: 'moss' });
  return boxes;
}

// Vermilion torii, 0.5 m blocks: 8 m wide, 6.5 m tall, black kasagi with upturned ends.
// Split into single blocks with a share of darker worn blocks.
export function toriiBoxes(wornFraction, seed) {
  const boxes = [
    ...withMirrorX([
      { p: [-6, 0, -2], s: [4, 1, 4], c: 'basalt3' }, // stone base
      { p: [-5, 1, -1], s: [2, 1, 2], c: 'beamBlack' }, // black foot band
      { p: [-5, 2, -1], s: [2, 9, 2], c: 'vermilion' }, // pillar
      { p: [-8, 12, -1], s: [1, 1, 2], c: 'beamBlack' }, // upturned kasagi end
    ]),
    { p: [-6, 7, -1], s: [12, 1, 2], c: 'vermilion' }, // nuki (tie beam)
    { p: [-1, 8, -1], s: [2, 2, 2], c: 'vermilion' }, // gakuzuka (center strut)
    { p: [-6, 10, -1], s: [12, 1, 2], c: 'vermilion' }, // shimaki
    { p: [-8, 11, -1], s: [16, 1, 2], c: 'beamBlack' }, // kasagi (black top beam)
  ];
  const rng = makeRng(seed);
  return splitCells(boxes).map((b) => (b.c === 'vermilion' && rng() < wornFraction ? { ...b, c: '#8f3526' } : b));
}

// Stone steps behind the torii, 0.5 m blocks, descending toward −Z from y = 0.
// Each step: `depth` blocks deep, `rise` blocks lower than the previous, filled down to `bottom`.
export function stepsBoxes({ count, width, rise, depth }, bottom = -6) {
  const boxes = [];
  const hw = width / 2;
  for (let k = 0; k < count; k++) {
    const top = -(k + 1) * rise;
    const z0 = -(k + 1) * depth;
    boxes.push({ p: [-hw, bottom, z0], s: [width, top - bottom, depth], c: k % 2 ? 'basalt1' : 'basalt2' });
    // side walls one block above the step
    for (const x of [-hw - 1, hw]) boxes.push({ p: [x, bottom, z0], s: [1, top + 1 - bottom, depth], c: 'basalt3' });
  }
  boxes.push({ p: [-hw - 1, -count * rise + 1, -count * depth], s: [1, 1, 1], c: 'moss' });
  return boxes;
}

// Small shrine hall, 0.5 m blocks, 8 m wide, ~5 m tall, stepped roof, warm windows.
export function shrineHallBoxes() {
  const wood = '#2f2422';
  const roof = '#22242b';
  return [
    { p: [-7, 0, -5], s: [14, 1, 10], c: 'basalt1' }, // plinth
    { p: [-3, 0, 5], s: [6, 1, 1], c: 'basalt2' }, // front step
    { p: [-5, 1, -3], s: [10, 4, 6], c: wood }, // walls
    ...withMirrorX([
      { p: [-6, 1, -4], s: [1, 4, 1], c: 'vermilion' }, // corner pillars
      { p: [-6, 1, 3], s: [1, 4, 1], c: 'vermilion' },
      { p: [-4, 2, 2], s: [2, 2, 1], c: 'lantern', e: 1.3 }, // warm windows (front)
      { p: [-9, 6, -5], s: [1, 1, 10], c: roof }, // upturned eaves
    ]),
    { p: [-1, 1, 2], s: [2, 3, 1], c: '#161213' }, // door
    { p: [-8, 5, -5], s: [16, 1, 10], c: roof }, // roof layers
    { p: [-7, 6, -4], s: [14, 1, 8], c: roof },
    { p: [-5, 7, -3], s: [10, 1, 6], c: '#1c1e24' },
    { p: [-3, 8, -2], s: [6, 1, 4], c: roof },
    { p: [-4, 9, -1], s: [8, 1, 2], c: 'beamBlack' }, // ridge
  ];
}

// Distant five-tier pagoda silhouette. Center column x ∈ [0, 1] (mirror axis 0.5).
export function pagodaBoxes() {
  const body = '#2a2d38';
  const roof = '#181a21';
  const boxes = [{ p: [-5, 0, -5], s: [11, 1, 11], c: 'basalt3' }];
  const halves = [3, 3, 2, 2, 1];
  let y = 1;
  for (const h of halves) {
    const w = 2 * h + 1;
    boxes.push({ p: [-h, y, -h], s: [w, 2, w], c: body });
    boxes.push({ p: [0, y + 1, -h + w - 1], s: [1, 1, 1], c: 'lantern', e: 1.8 }); // lit window (front)
    boxes.push({ p: [-h - 1, y + 2, -h - 1], s: [w + 2, 1, w + 2], c: roof });
    y += 3;
  }
  boxes.push({ p: [0, y, 0], s: [1, 3, 1], c: 'beamBlack' }); // spire
  return boxes;
}
