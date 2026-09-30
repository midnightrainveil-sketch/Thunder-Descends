import { VOXEL } from '../../config.js';
import { mirrorX } from '../VoxelBuilder.js';
import { HERO_PALETTE } from '../palettes.js';
import { Rig } from '../../anim/Rig.js';

// KUROGANE — mecha samurai (spec §5; final look per the character sheet: navy armor, gold trim,
// crescent horns, layered pauldrons, tall glowing back fins, V chest core, long crimson sash). ~20 blocks tall at VOXEL = 0.12 m, ~7 heads tall.
// Model grid: center column x ∈ [0, 1] (mirror axis 0.5), faces +Z, feet at y = 0.
// Character's RIGHT side is −X (sword hand); the oversized claw gauntlet is on the LEFT (+X).
// Rest pose: standing straight, arms hanging, sword pointing forward (+Z) from the right fist.

export const HERO_GLOW = ['default', 'visor', 'core', 'blade', 'accent', 'ult'];
const G = Object.fromEntries(HERO_GLOW.map((n, i) => [n, i]));
const AXIS = 0.5;
const SEGMENTS = 8;
const SEG_LEN = 2; // blocks per blade segment

// Joints: [name, parent, pivot (model grid units)] — pivots sit at the real joints.
function heroJoints() {
  const j = [
    ['root', null, [0.5, 0, 0.5]],
    ['pelvis', 'root', [0.5, 10, 0.5]],
    ['spine', 'pelvis', [0.5, 11, 0.5]],
    ['chest', 'spine', [0.5, 13, 0.5]],
    ['head', 'chest', [0.5, 16.5, 0.5]],
    ['sashFront', 'pelvis', [0.5, 10, 2]],
    ['sashBack', 'pelvis', [0.5, 10, -1]],
    ['sashR', 'pelvis', [-2.5, 10.5, 0.5]],
    ['sashL', 'pelvis', [3.5, 10.5, 0.5]],
    ['thighR', 'pelvis', [-1, 10, 0]],
    ['shinR', 'thighR', [-1, 5.5, 0]],
    ['footR', 'shinR', [-1, 1.5, 0]],
    ['thighL', 'pelvis', [2, 10, 0]],
    ['shinL', 'thighL', [2, 5.5, 0]],
    ['footL', 'shinL', [2, 1.5, 0]],
    // Right arm (sword)
    ['shoulderR', 'chest', [-2, 15, 0]],
    ['pauldronR', 'shoulderR', [-3.5, 15.5, 0.5]],
    ['upperArmR', 'shoulderR', [-3, 14, 0]],
    ['forearmR', 'upperArmR', [-3, 10.5, 0]],
    ['handR', 'forearmR', [-3, 7, 0]],
    ['weapon', 'handR', [-3, 6, 0]],
    ['bladeRoot', 'weapon', [-3, 6, 3]],
    // Left arm (claw gauntlet)
    ['shoulderL', 'chest', [3, 15, 0]],
    ['pauldronL', 'shoulderL', [4.5, 15.5, 0.5]],
    ['upperArmL', 'shoulderL', [4, 14, 0]],
    ['forearmL', 'upperArmL', [4, 10.5, 0]],
    ['chainAnchor', 'forearmL', [4.5, 7, 0.5]],
    ['clawHand', 'forearmL', [4.5, 7, 0.5]],
    ['clawFinger_0', 'clawHand', [3.5, 5, 1.5]],
    ['clawFinger_1', 'clawHand', [5.5, 5, 1.5]],
    ['clawFinger_2', 'clawHand', [4.5, 5, -0.5]], // thumb (back)
  ];
  for (let i = 0; i < SEGMENTS; i++) j.push([`bladeSeg_${i}`, 'bladeRoot', [-3, 6, 3 + SEG_LEN * i]]);
  for (let i = 0; i < SEGMENTS; i++) j.push([`bladeUlt_${i}`, `bladeSeg_${i}`, [-3, 6, 3 + SEG_LEN * i]]);
  return j;
}

// Right-side leg boxes (x columns −2..−1 plus outer trims); mirrored for the left leg.
function legBoxes() {
  return {
    foot: [
      { p: [-3, 0, -1], s: [3, 1, 4], c: 'navyDark' }, // sole
      { p: [-3, 0, 3], s: [3, 1, 1], c: 'gold' }, // toe cap
      { p: [-3, 1, 0], s: [3, 1, 2], c: 'navy' }, // instep
      { p: [-2, 1, 2], s: [2, 1, 1], c: 'gold' },
      { p: [-2, 1, -1], s: [2, 1, 1], c: 'goldDark' }, // heel
      { p: [-3, 1, -1], s: [1, 1, 1], c: 'crimson' }, // ankle accent
    ],
    shin: [
      { p: [-2, 2, -1], s: [2, 4, 2], c: 'navy' },
      { p: [-2, 2, -1], s: [2, 1, 2], c: 'crimson' }, // red ankle band
      { p: [-2, 3, 1], s: [2, 2, 1], c: 'navyLight' }, // shin guard
      { p: [-3, 3, -1], s: [1, 2, 2], c: 'goldDark' }, // outer greave
      { p: [-3, 3, 1], s: [1, 2, 1], c: 'cyan', e: 1.6 }, // shin light (accent)
      { p: [-2, 3, -2], s: [2, 2, 1], c: 'navyDark' }, // calf
      { p: [-2, 5, -1], s: [2, 1, 2], c: 'navyDark' }, // knee joint
      { p: [-2, 5, 1], s: [2, 2, 1], c: 'gold' }, // knee guard
      { p: [-3, 5, 0], s: [1, 1, 2], c: 'gold' },
    ],
    thigh: [
      { p: [-2, 6, -1], s: [2, 4, 2], c: 'navy' },
      { p: [-2, 7, 1], s: [2, 2, 1], c: 'navyLight' }, // thigh plate
      { p: [-2, 9, 1], s: [2, 1, 1], c: 'gold' },
      { p: [-3, 7, -1], s: [1, 3, 2], c: 'navyDark' }, // outer plate
      { p: [-3, 7, 1], s: [1, 1, 1], c: 'cyan', e: 1.4 }, // thigh light (accent)
    ],
  };
}

// Big layered pauldron (right; mirrored for the left): wing-like plates stepping out and down,
// gold edges and tips, a gold emblem on the front and an upswept gold spike.
function pauldronBoxes() {
  return [
    { p: [-6, 14, -2], s: [3, 3, 5], c: 'navy' }, // shell
    { p: [-7, 16, -2], s: [4, 1, 5], c: 'navyLight' }, // top layer
    { p: [-6, 17, -1], s: [2, 1, 3], c: 'navy' }, // raised cap
    { p: [-7, 12, -2], s: [2, 2, 5], c: 'navy' }, // lower skirt plate
    { p: [-7, 12, -2], s: [2, 1, 5], c: 'gold' }, // gold hem
    { p: [-8, 15, -2], s: [1, 3, 4], c: 'navy' }, // feather plate 1 (rises outward)
    { p: [-8, 18, -1], s: [1, 1, 2], c: 'gold' },
    { p: [-9, 14, -1], s: [1, 3, 3], c: 'navyLight' }, // feather plate 2
    { p: [-9, 17, 0], s: [1, 1, 1], c: 'gold' },
    { p: [-8, 13, -1], s: [1, 2, 3], c: 'navyDark' },
    { p: [-7, 17, -2], s: [1, 1, 1], c: 'gold' }, // rim corners
    { p: [-7, 17, 2], s: [1, 1, 1], c: 'gold' },
    { p: [-6, 15, 3], s: [2, 2, 1], c: 'gold' }, // round-ish emblem
    { p: [-6, 15, 3], s: [1, 1, 1], c: 'goldDark' },
  ];
}

function upperArmBoxes() {
  return [
    { p: [-4, 14, -1], s: [2, 1, 2], c: 'navyDark' }, // shoulder cap
    { p: [-4, 11, -1], s: [2, 3, 2], c: 'navy' },
    { p: [-4, 11, 1], s: [2, 1, 1], c: 'gold' }, // band
  ];
}

export function heroDefinition() {
  const parts = [];
  // A part's `glow` group applies to its emissive boxes; mixed boxes stay in one part so overlaps
  // resolve last-box-wins (no coplanar faces across parts).
  const add = (name, joint, boxes, extra = {}) => parts.push({ name, joint, boxes, ...extra });
  const addSplit = (name, joint, boxes, glow) => add(name, joint, boxes, { glow });

  // Legs
  const leg = legBoxes();
  for (const side of ['R', 'L']) {
    const m = side === 'L' ? (b) => mirrorX(b, AXIS) : (b) => b;
    add(`foot${side}`, `foot${side}`, m(leg.foot));
    addSplit(`shin${side}`, `shin${side}`, m(leg.shin), G.accent);
    addSplit(`thigh${side}`, `thigh${side}`, m(leg.thigh), G.accent);
  }

  // Pelvis, sash panels (own joints for lag)
  add('pelvis', 'pelvis', [
    { p: [-2, 10, -1], s: [5, 1, 3], c: 'navyDark' }, // belt
    { p: [-2, 10, 2], s: [5, 1, 1], c: 'crimson' }, // red sash knot band
    { p: [0, 10, 2], s: [1, 1, 1], c: 'gold' }, // buckle
    { p: [0, 8, -1], s: [1, 2, 2], c: 'navyDark' }, // crotch
  ]);
  add('sashFront', 'sashFront', [
    { p: [0, 3, 2], s: [1, 7, 1], c: 'crimson' }, // long red sash
    { p: [0, 3, 2], s: [1, 1, 1], c: 'crimsonDark' },
    { p: [-1, 7, 3], s: [3, 3, 1], c: 'navy' }, // navy front panel
    { p: [-1, 9, 3], s: [3, 1, 1], c: 'gold' },
    { p: [-1, 8, 3], s: [1, 1, 1], c: 'gold' }, // gold V
    { p: [1, 8, 3], s: [1, 1, 1], c: 'gold' },
    { p: [0, 7, 3], s: [1, 1, 1], c: 'gold' },
  ]);
  add('sashBack', 'sashBack', [
    { p: [-1, 5, -2], s: [3, 5, 1], c: 'crimson' },
    { p: [0, 3, -2], s: [1, 2, 1], c: 'crimson' },
    { p: [-1, 5, -2], s: [3, 1, 1], c: 'crimsonDark' },
  ]);
  const tasset = [
    { p: [-4, 8, -1], s: [1, 2, 3], c: 'navy' },
    { p: [-4, 8, -1], s: [1, 1, 3], c: 'gold' }, // gold hem
    { p: [-4, 9, 2], s: [1, 1, 1], c: 'goldDark' },
  ];
  add('sashR', 'sashR', tasset);
  add('sashL', 'sashL', mirrorX(tasset, AXIS));

  // Torso
  add('spine', 'spine', [
    { p: [-1, 11, -1], s: [3, 2, 3], c: 'navyDark' },
    { p: [-1, 12, 1], s: [3, 1, 1], c: 'navyLight' },
  ]);
  const pec = { p: [-2, 14, 2], s: [2, 2, 1], c: 'navyLight' };
  add('chest', 'chest', [
    { p: [-2, 13, -1], s: [5, 3, 3], c: 'navy' },
    pec,
    ...mirrorX([pec], AXIS),
    { p: [-3, 15, -1], s: [7, 1, 3], c: 'navy' }, // broad shoulder yoke
    { p: [-2, 16, 1], s: [5, 1, 1], c: 'gold' }, // gold collar trim
    { p: [-1, 16, -1], s: [3, 1, 2], c: 'navyDark' }, // collar
    { p: [-1, 16, 2], s: [3, 1, 1], c: 'navyDark' }, // gorget under the chin
    { p: [-3, 16, 0], s: [1, 1, 1], c: 'crimson' }, // red cords at the collar sides
    { p: [3, 16, 0], s: [1, 1, 1], c: 'crimson' },
    { p: [-2, 13, -2], s: [5, 3, 1], c: 'navyDark' }, // back plate
    { p: [-1, 12, -3], s: [3, 4, 1], c: 'navy' }, // backpack
    { p: [0, 13, -4], s: [1, 2, 1], c: 'cyan', e: 1.6 }, // back vent light
    { p: [-2, 13, 2], s: [5, 1, 1], c: 'navyDark' }, // lower chest
    // V-shaped chest core (glow group 'core')
    { p: [-1, 15, 2], s: [1, 1, 1], c: 'cyan', e: 2.2 },
    { p: [1, 15, 2], s: [1, 1, 1], c: 'cyan', e: 2.2 },
    { p: [0, 14, 2], s: [1, 1, 1], c: 'cyan', e: 3 },
  ], { glow: G.core });
  // Back fins: two tall slabs rising above the head with glowing inner edges and tips.
  const fin = [
    { p: [-3, 15, -3], s: [1, 6, 1], c: 'navyLight' },
    { p: [-3, 15, -4], s: [1, 5, 1], c: 'navy' },
    { p: [-2, 17, -3], s: [1, 4, 1], c: 'cyan', e: 1.6 },
    { p: [-3, 21, -3], s: [1, 1, 1], c: 'cyan', e: 2.2 },
  ];
  add('finTips', 'chest', [...fin, ...mirrorX(fin, AXIS)], { glow: G.accent });

  // Head: navy kabuto, gold crescent horns (kuwagata), gold side flaps, cyan eyes, center crest.
  const horn = [
    { p: [-1, 20, 1], s: [1, 1, 2], c: 'goldDark' }, // root on the brow
    { p: [-2, 20, 1], s: [1, 2, 1], c: 'gold' },
    { p: [-3, 21, 1], s: [1, 2, 1], c: 'gold' },
    { p: [-4, 22, 1], s: [1, 2, 1], c: 'gold' },
    { p: [-4, 24, 2], s: [1, 1, 1], c: 'gold' }, // tip curls forward
  ];
  const flap = [
    { p: [-2, 18, -1], s: [1, 2, 3], c: 'gold' },
    { p: [-3, 19, 0], s: [1, 1, 2], c: 'gold' },
  ];
  add('head', 'head', [
    { p: [-1, 17, -1], s: [3, 3, 3], c: 'navy' },
    { p: [-1, 17, 2], s: [3, 1, 1], c: 'navyDark' }, // jaw mask
    { p: [-1, 19, 2], s: [3, 1, 1], c: 'navyLight' }, // brow
    { p: [-1, 20, -1], s: [3, 1, 3], c: 'navyDark' }, // helmet bowl
    { p: [0, 20, 1], s: [1, 2, 1], c: 'navyDark' }, // center crest
    ...flap,
    ...mirrorX(flap, AXIS),
    ...horn,
    ...mirrorX(horn, AXIS),
    { p: [-2, 17, -2], s: [5, 1, 1], c: 'navyDark' }, // neck guard (stepped)
    { p: [-1, 18, -2], s: [3, 1, 1], c: 'navy' },
  ]);
  add('visor', 'head', [
    { p: [-1, 18, 2], s: [1, 1, 1], c: 'cyan', e: 3.2 }, // eyes
    { p: [1, 18, 2], s: [1, 1, 1], c: 'cyan', e: 3.2 },
    { p: [0, 21, 2], s: [1, 1, 1], c: 'cyan', e: 2.2 }, // crest jewel
  ], { glow: G.visor });

  // Shoulders: pauldrons on their own joints (lag), right sword arm, left claw gauntlet.
  addSplit('pauldronR', 'pauldronR', pauldronBoxes(), G.accent);
  addSplit('pauldronL', 'pauldronL', mirrorX(pauldronBoxes(), AXIS), G.accent);
  add('upperArmR', 'upperArmR', upperArmBoxes());
  add('upperArmL', 'upperArmL', mirrorX(upperArmBoxes(), AXIS));
  addSplit('forearmR', 'forearmR', [
    { p: [-4, 10, -1], s: [2, 1, 2], c: 'navyDark' }, // elbow
    { p: [-4, 7, -1], s: [2, 3, 2], c: 'navy' },
    { p: [-4, 8, 1], s: [2, 2, 1], c: 'gold' }, // bracer
    { p: [-5, 8, -1], s: [1, 2, 2], c: 'navyDark' },
    { p: [-5, 8, 1], s: [1, 1, 1], c: 'cyan', e: 1.6 },
  ], G.accent);
  add('handR', 'handR', [
    { p: [-4, 5, -1], s: [2, 2, 2], c: 'navyDark' },
    { p: [-4, 6, 1], s: [2, 1, 1], c: 'gold' }, // knuckles
  ]);
  addSplit('forearmL', 'forearmL', [
    { p: [3, 10, -1], s: [2, 1, 2], c: 'navyDark' }, // elbow
    { p: [3, 8, -1], s: [3, 2, 3], c: 'claw' }, // oversized gauntlet (~1.5× the right forearm)
    { p: [3, 8, 2], s: [3, 2, 1], c: 'navyLight' },
    { p: [3, 9, -2], s: [3, 1, 1], c: 'navy' },
    { p: [6, 8, -1], s: [1, 2, 3], c: 'clawDark' }, // outer plate
    { p: [6, 8, 1], s: [1, 2, 1], c: 'cyan', e: 1.8 },
    { p: [3, 9, 2], s: [3, 1, 1], c: 'gold' },
    { p: [3, 7, -1], s: [3, 1, 3], c: 'clawDark' }, // wrist chain housing (stays on the arm)
  ], G.accent);
  add('clawHand', 'clawHand', [
    { p: [3, 5, -1], s: [3, 2, 3], c: 'claw' }, // palm
    { p: [3, 6, 2], s: [3, 1, 1], c: 'clawDark' }, // knuckle plate
    { p: [6, 5, 0], s: [1, 2, 1], c: 'clawDark' },
  ]);
  const finger = (x, z) => [
    { p: [x, 3, z], s: [1, 2, 1], c: 'claw' },
    { p: [x, 3, z + (z > 0 ? 1 : -1)], s: [1, 1, 1], c: 'clawDark' }, // hooked claw tip
  ];
  add('clawFinger_0', 'clawFinger_0', finger(3, 1));
  add('clawFinger_1', 'clawFinger_1', finger(5, 1));
  add('clawFinger_2', 'clawFinger_2', finger(4, -1));

  // Nodachi, authored in the weapon's local grid (column centered on the grip, +Z = blade).
  const LOCAL = [-0.5, -0.5, 0];
  add('weapon', 'weapon', [
    { p: [0, 0, -4], s: [1, 1, 1], c: 'gold' }, // pommel
    { p: [0, 0, -3], s: [1, 1, 5], c: 'crimson' }, // hilt through the fist
    { p: [0, 0, -2], s: [1, 1, 1], c: 'navyDark' }, // wrap
    { p: [0, 0, 0], s: [1, 1, 1], c: 'navyDark' },
    { p: [-1, -1, 2], s: [3, 3, 1], c: 'gold' }, // square guard
    { p: [0, 0, 2], s: [1, 1, 1], c: 'goldDark' },
  ], { local: LOCAL });
  for (let i = 0; i < SEGMENTS; i++) {
    const last = i === SEGMENTS - 1;
    add(`bladeSeg_${i}`, `bladeSeg_${i}`, [{ p: [0, 0, 0], s: [1, 1, SEG_LEN], c: i % 2 ? 'worn' : 'steelDark' }], { local: LOCAL });
    add(`bladeEdge_${i}`, `bladeSeg_${i}`, [{ p: [0, -1, 0], s: [1, 1, last ? 1 : SEG_LEN], c: 'cyan', e: 2.4 }], {
      local: LOCAL,
      glow: G.blade,
    });
    // Demontime plates (hidden until the ult): thicker sides, raised spine, crimson core glow.
    add(`bladeUlt_${i}`, `bladeUlt_${i}`, [
      { p: [-1, -1, 0], s: [1, 2, SEG_LEN], c: 'navy' },
      { p: [1, -1, 0], s: [1, 2, SEG_LEN], c: 'navy' },
    ], { local: LOCAL });
    add(`bladeUltCore_${i}`, `bladeUlt_${i}`, [{ p: [0, 1, 0], s: [1, 1, SEG_LEN], c: 'crimson', e: 2.0 }], {
      local: LOCAL,
      glow: G.ult,
    });
  }

  return { joints: heroJoints(), parts, glowGroups: HERO_GLOW };
}

export const HERO_BLADE_SEGMENTS = SEGMENTS;

export function buildHeroRig() {
  const rig = new Rig(heroDefinition(), { voxelSize: VOXEL, palette: HERO_PALETTE, seed: 7, name: 'hero' });
  for (let i = 0; i < SEGMENTS; i++) rig.setBoneVisible(`bladeUlt_${i}`, false);
  return rig;
}
