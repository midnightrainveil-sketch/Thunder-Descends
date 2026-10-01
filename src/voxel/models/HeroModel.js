import { HERO_VOXEL } from '../../config.js';
import { mirrorX } from '../VoxelBuilder.js';
import { HERO_PALETTE } from '../palettes.js';
import { Rig } from '../../anim/Rig.js';

// KUROGANE — mecha samurai (spec §5; final look per the character reference sheet: navy armor,
// tan-gold trim, broad gold crescent horns, ō-sode shoulder guards sloping down and outward with a
// serrated gold blade on top and a gold mon, two tall back thruster pods with cyan nozzles, wide cyan
// V chest core framed by gold bars, red bead rope, long navy center panel between crimson strips,
// segmented nodachi with a glowing edge, oversized gray claw gauntlet).
//
// The hero alone uses a finer block (HERO_VOXEL = 0.06 m, half the other characters) so the details
// of the reference read; he is ~42 blocks tall (~2.5 m to the helmet, horns to ~3 m).
// Model grid: center column x ∈ [0, 2] (mirror axis 1), faces +Z, feet at y = 0.
// Character's RIGHT side is −X (sword hand); the claw gauntlet is on the LEFT (+X).
// Rest pose: standing straight, arms hanging, sword pointing forward (+Z) from the right fist.
// Every joint pivot is exactly 2× the previous 0.12 m grid, so all bone lengths in meters (and the
// hand-solved attack poses) are unchanged.

export const HERO_GLOW = ['default', 'visor', 'core', 'blade', 'accent', 'ult'];
const G = Object.fromEntries(HERO_GLOW.map((n, i) => [n, i]));
const AXIS = 1;
const SEGMENTS = 8;
const SEG_LEN = 4; // blocks per blade segment (0.24 m)
export const HERO_BLADE_SEGMENTS = SEGMENTS;
export const HERO_SEG_LEN_M = SEG_LEN * HERO_VOXEL; // blade segment length in meters (whip, trail)

// Joints: [name, parent, pivot (model grid units)] — pivots sit at the real joints.
function heroJoints() {
  const j = [
    ['root', null, [1, 0, 1]],
    ['pelvis', 'root', [1, 20, 1]],
    ['spine', 'pelvis', [1, 22, 1]],
    ['chest', 'spine', [1, 26, 1]],
    ['head', 'chest', [1, 33, 1]],
    ['sashFront', 'pelvis', [1, 20, 4]],
    ['sashBack', 'pelvis', [1, 20, -2]],
    ['sashR', 'pelvis', [-5, 21, 1]],
    ['sashL', 'pelvis', [7, 21, 1]],
    ['thighR', 'pelvis', [-2, 20, 0]],
    ['shinR', 'thighR', [-2, 11, 0]],
    ['footR', 'shinR', [-2, 3, 0]],
    ['thighL', 'pelvis', [4, 20, 0]],
    ['shinL', 'thighL', [4, 11, 0]],
    ['footL', 'shinL', [4, 3, 0]],
    // Right arm (sword)
    ['shoulderR', 'chest', [-4, 30, 0]],
    ['pauldronR', 'shoulderR', [-7, 31, 1]],
    ['upperArmR', 'shoulderR', [-6, 28, 0]],
    ['forearmR', 'upperArmR', [-6, 21, 0]],
    ['handR', 'forearmR', [-6, 14, 0]],
    ['weapon', 'handR', [-6, 12, 0]],
    ['bladeRoot', 'weapon', [-6, 12, 6]],
    // Left arm (claw gauntlet)
    ['shoulderL', 'chest', [6, 30, 0]],
    ['pauldronL', 'shoulderL', [9, 31, 1]],
    ['upperArmL', 'shoulderL', [8, 28, 0]],
    ['forearmL', 'upperArmL', [8, 21, 0]],
    ['chainAnchor', 'forearmL', [9, 14, 1]],
    ['clawHand', 'forearmL', [9, 14, 1]],
    ['clawFinger_0', 'clawHand', [7, 10, 3]],
    ['clawFinger_1', 'clawHand', [11, 10, 3]],
    ['clawFinger_2', 'clawHand', [9, 10, -1]], // thumb (back)
  ];
  for (let i = 0; i < SEGMENTS; i++) j.push([`bladeSeg_${i}`, 'bladeRoot', [-6, 12, 6 + SEG_LEN * i]]);
  for (let i = 0; i < SEGMENTS; i++) j.push([`bladeUlt_${i}`, `bladeSeg_${i}`, [-6, 12, 6 + SEG_LEN * i]]);
  return j;
}

// ── Legs (right; mirrored for the left). Leg column x ∈ [−4, 0], z ∈ [−2, 2]. ──────────────────
function legBoxes() {
  return {
    // Heavy sabaton: dark sole, navy shell, gold toe cap and side plate, gold heel spur.
    foot: [
      { p: [-5, 0, -3], s: [6, 1, 11], c: 'navyDark' }, // sole
      { p: [-5, 1, -2], s: [6, 2, 8], c: 'navy' },
      { p: [-5, 1, 6], s: [6, 2, 2], c: 'gold' }, // toe cap
      { p: [-4, 1, 8], s: [4, 1, 1], c: 'goldDark' },
      { p: [-4, 3, 2], s: [4, 1, 5], c: 'navyLight' }, // instep plate
      { p: [-3, 3, 6], s: [2, 1, 1], c: 'gold' },
      { p: [-4, 3, -2], s: [4, 2, 4], c: 'navy' }, // ankle block
      { p: [-4, 1, -4], s: [4, 2, 1], c: 'gold' }, // heel spur
      { p: [-6, 1, 0], s: [1, 2, 5], c: 'gold' }, // outer plate
      { p: [-6, 2, 1], s: [1, 1, 3], c: 'goldDark' },
    ],
    shin: [
      { p: [-4, 4, -2], s: [4, 7, 4], c: 'navy' },
      { p: [-5, 4, -3], s: [6, 1, 6], c: 'crimson' }, // red ankle band
      { p: [-4, 5, 2], s: [4, 5, 1], c: 'navyLight' }, // shin guard
      { p: [-3, 6, 3], s: [2, 3, 1], c: 'navy' }, // guard ridge
      { p: [-3, 9, 3], s: [2, 1, 1], c: 'cyan', e: 1.5 }, // front light
      { p: [-5, 5, -2], s: [1, 5, 3], c: 'navyDark' }, // outer greave
      { p: [-6, 5, -1], s: [1, 4, 1], c: 'goldDark' },
      { p: [-5, 6, 1], s: [1, 4, 1], c: 'cyan', e: 1.6 }, // shin light strip
      { p: [-4, 5, -3], s: [4, 5, 1], c: 'navyDark' }, // calf
      { p: [-3, 6, -4], s: [2, 3, 1], c: 'navyDark' },
      { p: [-4, 10, -2], s: [4, 2, 4], c: 'navyDark' }, // knee joint
      { p: [-5, 10, 2], s: [6, 3, 1], c: 'gold' }, // knee guard
      { p: [-4, 9, 2], s: [4, 1, 2], c: 'gold' },
      { p: [-3, 13, 2], s: [2, 1, 1], c: 'goldDark' },
      { p: [-6, 11, -1], s: [1, 2, 3], c: 'gold' }, // knee side plate
      { p: [-6, 10, 1], s: [1, 1, 1], c: 'cyan', e: 1.4 }, // knee light
    ],
    thigh: [
      { p: [-4, 12, -2], s: [4, 8, 4], c: 'navy' },
      { p: [-4, 13, 2], s: [4, 5, 1], c: 'navyLight' }, // front plate
      { p: [-4, 18, 2], s: [4, 1, 1], c: 'gold' },
      { p: [-3, 14, 3], s: [2, 2, 1], c: 'navy' },
      { p: [-5, 13, -2], s: [1, 6, 4], c: 'navyDark' }, // outer plate
      { p: [-6, 14, 0], s: [1, 4, 1], c: 'cyan', e: 1.4 }, // thigh light
      { p: [-6, 13, -1], s: [1, 1, 3], c: 'gold' },
      { p: [-4, 13, -3], s: [4, 5, 1], c: 'navyDark' }, // hamstring plate
    ],
  };
}

// A sloped armor band as a voxel staircase from (x0, y0) stepping outward (−X) one block per step
// and dropping `drop` blocks per step: navy plate with a gold lower edge, darker outer end.
function band(x0, y0, z0, drop, len, h, depth, body) {
  const out = [];
  for (let i = 0; i < len; i++) {
    const x = x0 - i - 1;
    const y = y0 - Math.round(i * drop);
    const outer = i === len - 1;
    out.push({ p: [x, y, z0], s: [1, h, depth], c: outer ? 'navyDark' : body });
    out.push({ p: [x, y, z0], s: [1, 1, depth], c: outer ? 'goldDark' : 'gold' }); // gold lower edge
    out.push({ p: [x, y + h - 1, z0], s: [1, 1, depth], c: i % 2 ? 'navyLight' : body });
  }
  return out;
}

// ── Shoulder guard (right; mirrored for the left), per the reference: a navy cap on the shoulder,
// an ō-sode of two layered bands sloping down and outward (gold lower edges, darker spiky outer
// ends), a gold mon on the cap front and a serrated gold blade rising diagonally from the top. ──
function shoulderGuardBoxes() {
  const spike = [];
  for (let i = 0; i < 7; i++) {
    const x = -12 - i;
    const y = 32 + Math.round(i * 1.35);
    spike.push({ p: [x, y, 0], s: [1, 3, 2], c: 'gold' });
    if (i % 2 === 0) spike.push({ p: [x, y + 3, 0], s: [1, 1, 2], c: 'goldLight' }); // serration teeth
  }
  spike.push({ p: [-19, 42, 0], s: [1, 2, 2], c: 'goldLight' }); // tip
  return [
    { p: [-12, 28, -3], s: [6, 5, 9], c: 'navy' }, // cap on the shoulder
    { p: [-12, 33, -2], s: [5, 1, 7], c: 'navyLight' },
    { p: [-12, 28, 6], s: [6, 1, 1], c: 'goldDark' },
    // Ō-sode bands, lowest first so each upper band's gold edge overlaps the one below.
    ...band(-11, 25, -3, 0.75, 6, 5, 10, 'navy'),
    ...band(-11, 29, -3, 0.75, 5, 5, 10, 'navy'),
    ...spike,
    // Gold mon (round crest) on the cap front, near the collar.
    { p: [-10, 29, 6], s: [3, 3, 1], c: 'gold' },
    { p: [-9, 28, 6], s: [1, 5, 1], c: 'gold' },
    { p: [-11, 30, 6], s: [5, 1, 1], c: 'gold' },
    { p: [-9, 30, 7], s: [1, 1, 1], c: 'goldDark' },
  ];
}

// Blue-gray segmented upper arm.
function upperArmBoxes() {
  return [
    { p: [-8, 27, -2], s: [4, 2, 4], c: 'navyDark' }, // shoulder joint
    { p: [-8, 22, -2], s: [4, 5, 4], c: 'slate' },
    { p: [-8, 24, -2], s: [4, 1, 4], c: 'clawDark' }, // segment seam
    { p: [-8, 22, 2], s: [4, 1, 1], c: 'gold' }, // band
    { p: [-9, 23, -1], s: [1, 3, 2], c: 'clawLight' },
  ];
}

export function heroDefinition() {
  const parts = [];
  // A part's `glow` group applies to its emissive boxes; mixed boxes stay in one part so overlaps
  // resolve last-box-wins (no coplanar faces across parts).
  const add = (name, joint, boxes, extra = {}) => parts.push({ name, joint, boxes, ...extra });
  const addSplit = (name, joint, boxes, glow) => add(name, joint, boxes, { glow });
  const M = (boxes) => mirrorX(boxes, AXIS);

  // Legs
  const leg = legBoxes();
  for (const side of ['R', 'L']) {
    const m = side === 'L' ? M : (b) => b;
    add(`foot${side}`, `foot${side}`, m(leg.foot));
    addSplit(`shin${side}`, `shin${side}`, m(leg.shin), G.accent);
    addSplit(`thigh${side}`, `thigh${side}`, m(leg.thigh), G.accent);
  }

  // Pelvis: belt with the red sash band and a gold buckle.
  add('pelvis', 'pelvis', [
    { p: [-4, 20, -2], s: [10, 2, 6], c: 'navyDark' }, // belt
    { p: [-4, 20, 4], s: [10, 2, 1], c: 'crimson' }, // red sash band
    { p: [0, 20, 5], s: [2, 2, 1], c: 'gold' }, // buckle
    { p: [-4, 20, -3], s: [10, 1, 1], c: 'crimson' },
    { p: [0, 18, -1], s: [2, 2, 4], c: 'navyDark' }, // crotch (high, so the legs read long)
  ]);
  // Front: gold belt plate over a long navy center panel (mask-like face), crimson strips on both
  // sides hanging to the ankles.
  const strip = [
    { p: [-3, 3, 5], s: [2, 17, 1], c: 'crimson' },
    { p: [-3, 2, 5], s: [1, 1, 1], c: 'crimsonDark' }, // ragged end
    { p: [-2, 5, 5], s: [1, 2, 1], c: 'crimsonDark' },
  ];
  add('sashFront', 'sashFront', [
    ...strip,
    ...M(strip),
    { p: [-1, 8, 6], s: [4, 11, 1], c: 'navy' }, // center panel
    { p: [0, 7, 6], s: [2, 1, 1], c: 'navy' }, // pointed end
    { p: [-1, 8, 6], s: [1, 9, 1], c: 'navyDark' }, // panel edges
    { p: [2, 8, 6], s: [1, 9, 1], c: 'navyDark' },
    { p: [0, 15, 7], s: [2, 1, 1], c: 'navyLight' }, // mask face
    { p: [-1, 14, 7], s: [1, 1, 1], c: 'navyLight' },
    { p: [2, 14, 7], s: [1, 1, 1], c: 'navyLight' },
    { p: [0, 12, 7], s: [2, 1, 1], c: 'navyDark' },
    { p: [-1, 18, 6], s: [4, 3, 1], c: 'gold' }, // gold belt plate
    { p: [0, 19, 7], s: [2, 1, 1], c: 'goldDark' },
  ]);
  add('sashBack', 'sashBack', [
    { p: [-1, 4, -4], s: [4, 16, 1], c: 'crimson' }, // long back sash to the ankles
    { p: [0, 5, -4], s: [2, 14, 1], c: 'crimsonDark' },
    { p: [-1, 3, -4], s: [1, 1, 1], c: 'crimson' },
    { p: [2, 3, -4], s: [1, 1, 1], c: 'crimsonDark' },
    { p: [-4, 20, -4], s: [10, 1, 1], c: 'crimson' }, // knotted rope belt
    { p: [-2, 17, -5], s: [6, 3, 1], c: 'crimsonDark' }, // knot
    { p: [0, 15, -5], s: [2, 2, 1], c: 'crimson' },
  ]);
  // Thigh tassets: front-outer plates with a gold zigzag trim, a gold hem and a hanging red cord.
  const tasset = [
    { p: [-8, 12, 1], s: [4, 9, 3], c: 'navy' },
    { p: [-8, 12, 1], s: [4, 1, 3], c: 'gold' }, // hem
    { p: [-8, 20, 1], s: [4, 1, 3], c: 'navyDark' },
    { p: [-8, 18, 4], s: [2, 1, 1], c: 'gold' }, // zigzag
    { p: [-7, 17, 4], s: [2, 1, 1], c: 'gold' },
    { p: [-6, 16, 4], s: [2, 1, 1], c: 'gold' },
    { p: [-8, 15, 4], s: [2, 1, 1], c: 'gold' },
    { p: [-7, 14, 4], s: [2, 1, 1], c: 'gold' },
    { p: [-9, 13, -1], s: [1, 7, 4], c: 'navyDark' }, // side plate
    { p: [-9, 7, 2], s: [1, 13, 1], c: 'crimson' }, // red cord
    { p: [-9, 6, 2], s: [1, 1, 1], c: 'crimsonDark' },
  ];
  add('sashR', 'sashR', tasset);
  add('sashL', 'sashL', M(tasset));

  // Torso
  const lowBeads = [[-4, 25], [-3, 24], [-2, 23], [-1, 22]].map(([x, y], i) => ({ p: [x, y, 5], s: [1, 1, 1], c: i % 2 ? 'crimson' : 'crimsonDark' }));
  add('spine', 'spine', [
    ...lowBeads,
    ...M(lowBeads),
    { p: [0, 22, 5], s: [2, 1, 1], c: 'crimson' }, // rope knot at the belt
    { p: [-3, 22, -2], s: [8, 4, 6], c: 'navyDark' },
    { p: [-2, 22, 4], s: [6, 1, 1], c: 'navyLight' }, // ab plates
    { p: [-2, 24, 4], s: [6, 1, 1], c: 'navyLight' },
    { p: [0, 22, 4], s: [2, 4, 1], c: 'navy' },
    { p: [-3, 23, 4], s: [1, 2, 1], c: 'goldDark' },
    { p: [4, 23, 4], s: [1, 2, 1], c: 'goldDark' },
  ]);
  const pec = { p: [-5, 28, 4], s: [5, 4, 1], c: 'navyLight' };
  const chestTrim = { p: [-7, 24, 3], s: [2, 9, 2], c: 'gold' }; // tall gold bar framing the chest
  // Red bead rope: from the collar down the chest sides (continues on the spine, see below).
  const beadPath = [[-5, 32], [-6, 31], [-6, 30], [-6, 29], [-6, 28], [-5, 27], [-5, 26]];
  const beads = beadPath.map(([x, y], i) => ({ p: [x, y, 5], s: [1, 1, 1], c: i % 2 ? 'crimsonDark' : 'crimson' }));
  // Wide V chest core: two arms from the shoulders down to the sternum (glow group 'core').
  const vArm = [
    { p: [-5, 31, 5], s: [2, 1, 1], c: 'cyan', e: 1.3 },
    { p: [-4, 30, 5], s: [2, 1, 1], c: 'cyan', e: 1.4 },
    { p: [-3, 29, 5], s: [2, 1, 1], c: 'cyan', e: 1.5 },
    { p: [-2, 28, 5], s: [2, 1, 1], c: 'cyan', e: 1.6 },
    { p: [-1, 27, 5], s: [2, 1, 1], c: 'cyan', e: 1.8 },
  ];
  add('chest', 'chest', [
    { p: [-4, 26, -3], s: [10, 6, 7], c: 'navy' },
    pec,
    ...M([pec]),
    { p: [-5, 30, 3], s: [12, 2, 1], c: 'navy' }, // upper chest plate
    { p: [-7, 30, -3], s: [16, 2, 6], c: 'navy' }, // broad shoulder yoke
    chestTrim,
    ...M([chestTrim]),
    { p: [-4, 32, 3], s: [10, 1, 1], c: 'gold' }, // gold collar trim
    { p: [-3, 32, -2], s: [8, 2, 5], c: 'navyDark' }, // collar
    ...beads,
    ...M(beads),
    { p: [-4, 26, 4], s: [10, 2, 1], c: 'navyDark' }, // lower chest
    { p: [-4, 26, -4], s: [10, 6, 1], c: 'navyDark' }, // back plate
    { p: [-2, 24, -6], s: [6, 8, 2], c: 'navy' }, // backpack
    { p: [-2, 31, -6], s: [6, 1, 2], c: 'gold' },
    { p: [-1, 29, -7], s: [4, 1, 1], c: 'cyan', e: 1.3 }, // back light bar
    { p: [-2, 24, -7], s: [1, 3, 1], c: 'cyan', e: 1.1 }, // lower vents
    { p: [3, 24, -7], s: [1, 3, 1], c: 'cyan', e: 1.1 },
    { p: [-1, 26, -7], s: [4, 2, 1], c: 'navyDark' },
    ...vArm,
    ...M(vArm),
    { p: [0, 26, 5], s: [2, 1, 1], c: 'core', e: 2.2 }, // sternum point
  ], { glow: G.core });

  // Back thruster pods: two tall rocket pods behind the shoulders, from the waist to above the
  // head, gold stripe on the inner side, cyan glow at the top and the bottom exhaust.
  const pod = [
    { p: [-9, 20, -9], s: [3, 21, 3], c: 'navy' }, // pod body
    { p: [-9, 22, -10], s: [3, 17, 1], c: 'navyLight' }, // rear face
    { p: [-8, 24, -11], s: [1, 13, 1], c: 'slate' }, // rear rib
    { p: [-6, 24, -8], s: [1, 11, 1], c: 'gold' }, // inner gold stripe
    { p: [-10, 26, -9], s: [1, 10, 2], c: 'navyDark' }, // outer edge
    { p: [-10, 41, -9], s: [3, 2, 3], c: 'navyDark' }, // nozzle collar (top)
    { p: [-10, 43, -9], s: [3, 2, 3], c: 'cyan', e: 1.6 }, // top glow
    { p: [-9, 45, -8], s: [1, 1, 1], c: 'cyan', e: 2.0 },
    { p: [-9, 18, -9], s: [3, 2, 3], c: 'navyDark' }, // bottom nozzle
    { p: [-8, 17, -8], s: [1, 1, 1], c: 'cyan', e: 1.8 }, // exhaust glow
    { p: [-9, 19, -10], s: [3, 1, 1], c: 'cyan', e: 1.3 },
    { p: [-6, 27, -8], s: [4, 3, 2], c: 'navyDark' }, // mount bracket to the backpack
  ];
  add('finTips', 'chest', [...pod, ...M(pod)], { glow: G.accent });

  // Head: navy kabuto, gold crescent horns, gold side flaps, stepped neck guard, dark center crest.
  // The face layer (z = 4) is built cell by cell so the visor part's eyes never overlap it.
  // Kuwagata: a broad crescent per side, thick at the brow, sweeping out and up to a fine tip.
  const hornRows = [
    [40, -3, 4], [41, -5, 4], [42, -6, 4], [43, -7, 3], [44, -8, 3], [45, -9, 3],
    [46, -9, 2], [47, -10, 2], [48, -10, 2], [49, -11, 2], [50, -11, 1],
  ];
  const horn = hornRows.map(([y, x, w], i) => ({ p: [x, y, 4], s: [w, 1, 1], c: i < 3 ? 'gold' : 'gold' }));
  horn.push(...hornRows.slice(0, 6).map(([y, x]) => ({ p: [x, y, 4], s: [1, 1, 1], c: 'goldDark' }))); // shaded outer edge
  horn.push({ p: [-12, 51, 4], s: [1, 1, 1], c: 'goldLight' }); // tip
  horn.push({ p: [-1, 40, 3], s: [2, 1, 1], c: 'goldDark' }); // root seated into the brow
  const flap = [
    { p: [-4, 35, -1], s: [2, 4, 5], c: 'navy' }, // fukigaeshi
    { p: [-5, 36, 0], s: [1, 3, 4], c: 'gold' },
    { p: [-5, 39, 1], s: [1, 1, 3], c: 'goldLight' },
  ];
  const faceSide = [
    { p: [-2, 37, 4], s: [1, 1, 1], c: 'navyDark' },
    { p: [0, 37, 4], s: [1, 1, 1], c: 'navyDark' },
    { p: [-1, 38, 4], s: [1, 1, 1], c: 'navyLight' },
    { p: [0, 38, 4], s: [1, 1, 1], c: 'navyLight' },
  ];
  add('head', 'head', [
    { p: [-2, 34, -2], s: [6, 5, 6], c: 'navy' },
    { p: [-2, 34, 4], s: [6, 2, 1], c: 'navyDark' }, // jaw mask
    { p: [-1, 33, 4], s: [4, 1, 1], c: 'navyDark' }, // chin
    { p: [-2, 36, 4], s: [6, 1, 1], c: 'navy' }, // cheek plate
    ...faceSide,
    ...M(faceSide),
    { p: [-1, 39, 4], s: [4, 1, 1], c: 'gold' }, // forehead plate
    { p: [-3, 39, -3], s: [8, 3, 7], c: 'navyDark' }, // helmet bowl
    { p: [-4, 38, -3], s: [10, 1, 6], c: 'navy' }, // brim
    { p: [0, 42, 0], s: [2, 5, 2], c: 'darkSteel' }, // center crest blade
    { p: [0, 47, 1], s: [2, 1, 1], c: 'gunmetal' },
    { p: [-3, 34, -3], s: [8, 2, 1], c: 'navyDark' }, // neck guard (stepped)
    { p: [-4, 33, -3], s: [10, 1, 2], c: 'navy' },
    { p: [-4, 33, -4], s: [10, 1, 1], c: 'goldDark' },
    ...flap,
    ...M(flap),
    ...horn,
    ...M(horn),
  ]);
  const eye = [
    { p: [-1, 37, 4], s: [1, 1, 1], c: 'cyan', e: 2.4 },
    { p: [-2, 38, 4], s: [1, 1, 1], c: 'cyan', e: 2.0 }, // angled outer corner
  ];
  add('visor', 'head', [...eye, ...M(eye), { p: [0, 40, 4], s: [2, 1, 1], c: 'cyan', e: 2.4 }], { glow: G.visor });

  // Shoulders: pauldrons on their own joints (lag), right sword arm, left claw gauntlet.
  add('pauldronR', 'pauldronR', shoulderGuardBoxes());
  add('pauldronL', 'pauldronL', M(shoulderGuardBoxes()));
  add('upperArmR', 'upperArmR', upperArmBoxes());
  add('upperArmL', 'upperArmL', M(upperArmBoxes()));
  addSplit('forearmR', 'forearmR', [
    { p: [-8, 20, -2], s: [4, 2, 4], c: 'navyDark' }, // elbow
    { p: [-7, 21, 2], s: [2, 1, 1], c: 'gold' },
    { p: [-8, 15, -2], s: [4, 5, 4], c: 'navy' },
    { p: [-8, 16, 2], s: [4, 3, 1], c: 'gold' }, // bracer
    { p: [-7, 17, 3], s: [2, 1, 1], c: 'goldDark' },
    { p: [-9, 15, -2], s: [1, 5, 4], c: 'navyDark' }, // outer plate
    { p: [-10, 16, 0], s: [1, 3, 1], c: 'cyan', e: 1.6 },
    { p: [-9, 15, -2], s: [1, 1, 4], c: 'gold' },
  ], G.accent);
  add('handR', 'handR', [
    { p: [-8, 10, -2], s: [4, 4, 4], c: 'navyDark' },
    { p: [-8, 12, 2], s: [4, 2, 1], c: 'gold' }, // knuckles
  ]);
  addSplit('forearmL', 'forearmL', [
    { p: [6, 20, -2], s: [4, 2, 4], c: 'navyDark' }, // elbow
    { p: [5, 15, -3], s: [8, 5, 8], c: 'claw' }, // oversized gauntlet
    { p: [5, 19, -3], s: [8, 1, 8], c: 'navy' }, // bracer band
    { p: [5, 19, 5], s: [8, 1, 1], c: 'gold' },
    { p: [6, 15, 5], s: [6, 4, 1], c: 'slate' }, // front plate
    { p: [8, 16, 6], s: [2, 2, 1], c: 'cyan', e: 1.8 },
    { p: [13, 15, -2], s: [1, 5, 6], c: 'clawDark' }, // outer plate
    { p: [14, 16, 0], s: [1, 3, 1], c: 'cyan', e: 1.8 },
    { p: [14, 16, 3], s: [1, 2, 1], c: 'cyan', e: 1.4 },
    { p: [6, 16, -4], s: [6, 1, 1], c: 'clawDark' }, // ridges
    { p: [6, 18, -4], s: [6, 1, 1], c: 'clawDark' },
    { p: [6, 14, -2], s: [6, 1, 6], c: 'clawDark' }, // wrist chain housing (stays on the arm)
  ], G.accent);
  add('clawHand', 'clawHand', [
    { p: [5, 10, -2], s: [8, 4, 7], c: 'claw' }, // palm
    { p: [5, 12, 5], s: [8, 2, 1], c: 'clawDark' }, // knuckle plate
    { p: [6, 13, 6], s: [6, 1, 1], c: 'clawLight' },
    { p: [13, 10, 0], s: [1, 4, 3], c: 'clawDark' },
  ]);
  // Talons: a straight segment, a darker forward-stepping segment and a hooked tip.
  const talon = (x, w) => [
    { p: [x, 7, 2], s: [w, 3, 2], c: 'claw' },
    { p: [x, 5, 3], s: [w, 2, 2], c: 'clawDark' },
    { p: [x, 4, 5], s: [w, 1, 1], c: 'darkSteel' },
  ];
  add('clawFinger_0', 'clawFinger_0', [...talon(5, 2), ...talon(8, 2)]);
  add('clawFinger_1', 'clawFinger_1', talon(11, 2));
  add('clawFinger_2', 'clawFinger_2', [
    { p: [8, 6, -3], s: [2, 4, 2], c: 'claw' },
    { p: [8, 5, -4], s: [2, 1, 1], c: 'clawDark' },
  ]);

  // Nodachi, authored in the weapon's local grid (grip centered on x ∈ [0, 2], y ∈ [−1, 1];
  // +Z = blade). The edge is the lower row (y −2..−1), the spine the upper one.
  const LOCAL = [-1, 0, 0];
  add('weapon', 'weapon', [
    { p: [0, -1, -8], s: [2, 2, 2], c: 'gold' }, // pommel
    { p: [0, -1, -6], s: [2, 2, 10], c: 'crimson' }, // hilt through the fist
    { p: [0, -1, -4], s: [2, 2, 1], c: 'navyDark' }, // wraps
    { p: [0, -1, -1], s: [2, 2, 1], c: 'navyDark' },
    { p: [0, -1, 2], s: [2, 2, 1], c: 'navyDark' },
    { p: [-2, -3, 4], s: [6, 6, 2], c: 'gold' }, // square tsuba
    { p: [-1, -2, 5], s: [4, 4, 1], c: 'goldDark' },
  ], { local: LOCAL });
  for (let i = 0; i < SEGMENTS; i++) {
    const last = i === SEGMENTS - 1;
    const steel = i % 2 ? 'worn' : 'steelDark';
    add(`bladeSeg_${i}`, `bladeSeg_${i}`, last
      ? [
          { p: [0, -1, 0], s: [2, 2, 3], c: steel },
          { p: [0, 1, 0], s: [2, 1, 2], c: 'darkSteel' },
        ]
      : [
          { p: [0, -1, 0], s: [2, 2, SEG_LEN], c: steel },
          { p: [0, 1, 0], s: [2, 1, SEG_LEN], c: 'darkSteel' }, // spine
          { p: [0, 0, SEG_LEN - 1], s: [2, 1, 1], c: i % 2 ? 'steelDark' : 'worn' }, // segment seam
        ], { local: LOCAL });
    add(`bladeEdge_${i}`, `bladeSeg_${i}`, last
      ? [
          { p: [0, -2, 0], s: [2, 1, 4], c: 'cyan', e: 2.4 },
          { p: [0, -1, 3], s: [2, 1, 1], c: 'cyan', e: 2.8 }, // glowing point
        ]
      : [{ p: [0, -2, 0], s: [2, 1, SEG_LEN], c: 'cyan', e: 2.4 }], { local: LOCAL, glow: G.blade });
    // Demontime plates (hidden until the ult): thicker sides, raised spine, crimson core glow.
    add(`bladeUlt_${i}`, `bladeUlt_${i}`, [
      { p: [-1, -2, 0], s: [1, 4, SEG_LEN], c: 'navy' },
      { p: [2, -2, 0], s: [1, 4, SEG_LEN], c: 'navy' },
    ], { local: LOCAL });
    add(`bladeUltCore_${i}`, `bladeUlt_${i}`, [{ p: [0, 2, 0], s: [2, 1, SEG_LEN], c: 'crimson', e: 2.0 }], {
      local: LOCAL,
      glow: G.ult,
    });
  }

  return { joints: heroJoints(), parts, glowGroups: HERO_GLOW };
}

export function buildHeroRig() {
  const rig = new Rig(heroDefinition(), { voxelSize: HERO_VOXEL, origin: [-1, 0, -1], palette: HERO_PALETTE, seed: 7, name: 'hero' });
  for (let i = 0; i < SEGMENTS; i++) rig.setBoneVisible(`bladeUlt_${i}`, false);
  return rig;
}
