import { HERO_VOXEL } from '../../config.js';
import { mirrorX } from '../VoxelBuilder.js';
import { HERO_PALETTE } from '../palettes.js';
import { Rig } from '../../anim/Rig.js';

// KUROGANE — mecha samurai (spec §5; final look per the character reference sheet: navy armor,
// tan-gold trim, huge gold crescent horns, wing-like layered pauldrons with gold-tipped feathers and
// a gold mon, tall glowing back fins, wide cyan V chest core, long crimson sash, segmented nodachi
// with a glowing edge, oversized gray claw gauntlet).
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

// A feather plate as a voxel staircase from (x0, y0) stepping outward (−X) by one block per step and
// rising `dy` blocks per step; navy body, a lighter top row, gold tip.
function feather(x0, y0, z0, dy, len, depth, body) {
  const out = [];
  const h = Math.max(3, Math.ceil(Math.abs(dy)) + 2);
  for (let i = 0; i < len; i++) {
    const y = y0 + Math.round(i * dy);
    const last = i === len - 1;
    if (last) {
      // Narrow gold tip (centered in depth) so the side view isn't a wall of gold.
      out.push({ p: [x0 - i - 1, y, z0 + 1], s: [1, h, Math.max(1, depth - 2)], c: 'gold' });
    } else {
      out.push({ p: [x0 - i - 1, y, z0], s: [1, h, depth], c: body });
      out.push({ p: [x0 - i - 1, y + h - 1, z0], s: [1, 1, depth], c: i % 2 ? 'navyLight' : 'slate' });
      out.push({ p: [x0 - i - 1, y + h - 1, z0 + depth - 1], s: [1, 1, 1], c: i === len - 2 ? 'gold' : 'goldDark' }); // gilded front edge
    }
  }
  const tip = out[out.length - 1];
  out.push({ p: [tip.p[0], dy >= 0 ? tip.p[1] + h : tip.p[1] - 1, tip.p[2]], s: [1, 1, 1], c: 'goldLight' });
  return out;
}

// ── Pauldron (right; mirrored for the left): a rounded shell under a wing of layered feather plates
// fanning up and out (gold tips), a short lower skirt with a gold hem and a gold mon on the front. ─
function pauldronBoxes() {
  return [
    { p: [-12, 26, -4], s: [6, 7, 10], c: 'navy' }, // shell
    { p: [-12, 32, -3], s: [6, 2, 8], c: 'navyLight' }, // rounded top
    { p: [-11, 34, -2], s: [4, 1, 6], c: 'navy' },
    { p: [-12, 33, 5], s: [6, 1, 1], c: 'gold' }, // front rim
    { p: [-13, 24, -4], s: [5, 2, 10], c: 'navy' }, // skirt plate
    { p: [-13, 23, -4], s: [5, 1, 10], c: 'gold' }, // gold hem
    // Feathers, steep → shallow → drooping, back layers deeper.
    ...feather(-11, 33, -3, 1.5, 6, 7, 'navy'),
    ...feather(-12, 31, -2, 1.0, 7, 6, 'navy'),
    ...feather(-12, 29, -2, 0.6, 7, 6, 'navyDark'),
    ...feather(-12, 27, -1, 0.25, 7, 5, 'navy'),
    ...feather(-13, 25, 0, -0.3, 5, 4, 'navyDark'),
    // Gold mon (round crest) on the front of the shell.
    { p: [-11, 28, 6], s: [3, 3, 1], c: 'gold' },
    { p: [-10, 27, 6], s: [1, 5, 1], c: 'gold' },
    { p: [-12, 29, 6], s: [5, 1, 1], c: 'gold' },
    { p: [-10, 29, 7], s: [1, 1, 1], c: 'goldDark' },
  ];
}

function upperArmBoxes() {
  return [
    { p: [-8, 27, -2], s: [4, 2, 4], c: 'navyDark' }, // shoulder cap
    { p: [-8, 22, -2], s: [4, 5, 4], c: 'navy' },
    { p: [-8, 23, 2], s: [4, 1, 1], c: 'gold' }, // band
    { p: [-9, 23, -1], s: [1, 3, 2], c: 'slate' },
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
  // Front: navy panel with a gold V over a long crimson sash with ragged ends.
  const vee = [
    { p: [-2, 18, 6], s: [1, 1, 1], c: 'gold' },
    { p: [-1, 17, 6], s: [1, 1, 1], c: 'gold' },
    { p: [0, 16, 6], s: [1, 1, 1], c: 'gold' },
    { p: [0, 15, 6], s: [1, 1, 1], c: 'goldDark' },
  ];
  add('sashFront', 'sashFront', [
    { p: [-2, 9, 5], s: [2, 10, 1], c: 'crimson' },
    { p: [0, 10, 5], s: [2, 9, 1], c: 'crimsonDark' },
    { p: [2, 9, 5], s: [2, 10, 1], c: 'crimson' },
    { p: [-2, 8, 5], s: [1, 1, 1], c: 'crimson' },
    { p: [3, 8, 5], s: [1, 1, 1], c: 'crimson' },
    { p: [0, 9, 5], s: [1, 1, 1], c: 'crimsonDark' },
    { p: [-2, 15, 6], s: [6, 4, 1], c: 'navy' }, // front panel
    { p: [-1, 14, 6], s: [4, 1, 1], c: 'navy' },
    { p: [0, 13, 6], s: [2, 1, 1], c: 'navy' },
    { p: [-2, 19, 6], s: [6, 1, 1], c: 'gold' },
    ...vee,
    ...M(vee),
  ]);
  add('sashBack', 'sashBack', [
    { p: [-2, 9, -4], s: [6, 11, 1], c: 'crimson' },
    { p: [0, 10, -4], s: [2, 10, 1], c: 'crimsonDark' },
    { p: [-1, 7, -4], s: [4, 2, 1], c: 'crimson' },
    { p: [-2, 17, -5], s: [6, 3, 1], c: 'crimsonDark' }, // knot
    { p: [0, 15, -5], s: [2, 2, 1], c: 'crimson' },
  ]);
  // Hip tassets with gold hems and a hanging red cord.
  const tasset = [
    { p: [-7, 15, -2], s: [2, 6, 6], c: 'navy' },
    { p: [-7, 15, -2], s: [2, 1, 6], c: 'gold' },
    { p: [-7, 20, -2], s: [2, 1, 6], c: 'goldDark' },
    { p: [-8, 16, 0], s: [1, 3, 2], c: 'gold' },
    { p: [-6, 13, 4], s: [1, 7, 1], c: 'crimson' }, // red cord
    { p: [-6, 12, 4], s: [1, 1, 1], c: 'crimsonDark' },
  ];
  add('sashR', 'sashR', tasset);
  add('sashL', 'sashL', M(tasset));

  // Torso
  add('spine', 'spine', [
    { p: [-3, 22, -2], s: [8, 4, 6], c: 'navyDark' },
    { p: [-2, 22, 4], s: [6, 1, 1], c: 'navyLight' }, // ab plates
    { p: [-2, 24, 4], s: [6, 1, 1], c: 'navyLight' },
    { p: [0, 22, 4], s: [2, 4, 1], c: 'navy' },
    { p: [-3, 23, 4], s: [1, 2, 1], c: 'goldDark' },
    { p: [4, 23, 4], s: [1, 2, 1], c: 'goldDark' },
  ]);
  const pec = { p: [-5, 28, 4], s: [5, 4, 1], c: 'navyLight' };
  const chestTrim = { p: [-6, 27, 3], s: [1, 5, 1], c: 'gold' };
  const beads = [
    { p: [-6, 32, 1], s: [1, 1, 1], c: 'crimson' },
    { p: [-5, 32, 3], s: [1, 1, 1], c: 'crimson' },
    { p: [-4, 31, 4], s: [1, 1, 1], c: 'crimsonDark' },
  ];
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

  // Back fins: two tall panels rising above the head, glowing inner edges and tips.
  const fin = [
    { p: [-8, 28, -6], s: [3, 13, 2], c: 'navyLight' },
    { p: [-8, 27, -7], s: [3, 11, 1], c: 'navy' },
    { p: [-9, 30, -6], s: [1, 9, 1], c: 'navyDark' },
    { p: [-8, 32, -5], s: [1, 8, 1], c: 'slate' },
    { p: [-5, 30, -6], s: [1, 11, 1], c: 'cyan', e: 1.1 },
    { p: [-8, 41, -6], s: [3, 1, 1], c: 'navyLight' },
    { p: [-7, 42, -6], s: [2, 1, 1], c: 'cyan', e: 1.4 },
    { p: [-6, 43, -6], s: [1, 2, 1], c: 'cyan', e: 1.6 },
  ];
  add('finTips', 'chest', [...fin, ...M(fin)], { glow: G.accent });

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
  add('pauldronR', 'pauldronR', pauldronBoxes());
  add('pauldronL', 'pauldronL', M(pauldronBoxes()));
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
