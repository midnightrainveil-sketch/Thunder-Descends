import { VOXEL } from '../../config.js';
import { mirrorX } from '../VoxelBuilder.js';
import { HERO_PALETTE } from '../palettes.js';
import { Rig } from '../../anim/Rig.js';

// KUROGANE — mecha samurai (spec §5). ~20 blocks tall at VOXEL = 0.12 m, ~7 heads tall.
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

// Right-side leg boxes (x columns −2..0); mirrored for the left leg.
function legBoxes() {
  const x = -2;
  return {
    foot: [
      { p: [x, 0, -1], s: [2, 1, 3], c: 'darkSteel' },
      { p: [x, 0, 2], s: [2, 1, 1], c: 'ivory' }, // toe cap
      { p: [x, 1, -1], s: [2, 1, 2], c: 'gunmetal' }, // ankle
    ],
    shin: [
      { p: [x, 2, -1], s: [2, 3, 2], c: 'gunmetal' },
      { p: [x, 2, 1], s: [2, 3, 1], c: 'ivory' }, // shin guard
      { p: [x, 3, 1], s: [1, 1, 1], c: 'cyan', e: 2.2 }, // outer shin light (emissive part below)
      { p: [x, 3, -2], s: [2, 2, 1], c: 'darkSteel' }, // calf
      { p: [x, 5, -1], s: [2, 1, 2], c: 'darkSteel' }, // knee joint
      { p: [x, 5, 1], s: [2, 2, 1], c: 'ivory' }, // knee guard
    ],
    thigh: [
      { p: [x, 6, -1], s: [2, 4, 2], c: 'gunmetal' },
      { p: [x, 8, 1], s: [2, 2, 1], c: 'darkSteel' }, // thigh plate
    ],
  };
}

function pauldronBoxes() {
  return [
    { p: [-5, 15, -2], s: [3, 1, 5], c: 'gunmetal' }, // top slab
    { p: [-5, 16, -1], s: [2, 1, 3], c: 'ivory' }, // stepped cap
    { p: [-5, 12, -2], s: [1, 3, 5], c: 'gunmetal' }, // hanging outer plate
    { p: [-5, 12, -2], s: [1, 1, 5], c: 'ivory' }, // hem
    { p: [-5, 14, 2], s: [1, 1, 1], c: 'cyan', e: 2.2 },
  ];
}

function upperArmBoxes() {
  return [
    { p: [-4, 14, -1], s: [2, 1, 2], c: 'darkSteel' }, // shoulder cap
    { p: [-4, 11, -1], s: [2, 3, 2], c: 'gunmetal' },
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
    add(`thigh${side}`, `thigh${side}`, m(leg.thigh));
  }

  // Pelvis, sash panels (own joints for lag)
  add('pelvis', 'pelvis', [
    { p: [-2, 10, -1], s: [5, 1, 3], c: 'crimson' }, // belt band
    { p: [0, 10, 2], s: [1, 1, 1], c: 'ivory' }, // buckle
    { p: [0, 8, -1], s: [1, 2, 2], c: 'darkSteel' }, // crotch
  ]);
  add('sashFront', 'sashFront', [
    { p: [-1, 5, 2], s: [3, 5, 1], c: 'crimson' },
    { p: [-1, 5, 2], s: [3, 1, 1], c: 'crimsonDark' },
    { p: [0, 8, 2], s: [1, 1, 1], c: 'ivory' },
  ]);
  add('sashBack', 'sashBack', [
    { p: [-1, 6, -2], s: [3, 4, 1], c: 'crimson' },
    { p: [-1, 6, -2], s: [3, 1, 1], c: 'crimsonDark' },
  ]);
  const tasset = [
    { p: [-3, 7, -1], s: [1, 3, 3], c: 'gunmetal' },
    { p: [-3, 7, -1], s: [1, 1, 3], c: 'ivory' },
  ];
  add('sashR', 'sashR', tasset);
  add('sashL', 'sashL', mirrorX(tasset, AXIS));

  // Torso
  add('spine', 'spine', [
    { p: [-1, 11, -1], s: [3, 2, 3], c: 'darkSteel' },
    { p: [-1, 12, 1], s: [3, 1, 1], c: 'gunmetal' },
  ]);
  const fins = [
    { p: [-2, 15, -2], s: [1, 1, 1], c: 'gunmetal' },
    { p: [-3, 16, -2], s: [1, 1, 1], c: 'gunmetal' },
    { p: [-4, 17, -2], s: [1, 1, 1], c: 'ivory' },
  ];
  add('chest', 'chest', [
    { p: [-2, 13, -1], s: [5, 3, 3], c: 'gunmetal' },
    { p: [-2, 14, 1], s: [2, 2, 1], c: 'ivory' }, // pec plates
    ...mirrorX([{ p: [-2, 14, 1], s: [2, 2, 1], c: 'ivory' }], AXIS),
    { p: [0, 15, 1], s: [1, 1, 1], c: 'ivory' },
    { p: [0, 13, 1], s: [1, 1, 1], c: 'crimson' },
    { p: [-1, 16, -1], s: [3, 1, 2], c: 'darkSteel' }, // collar
    { p: [-1, 13, -2], s: [3, 3, 1], c: 'darkSteel' }, // back plate
    ...fins,
    ...mirrorX(fins, AXIS),
    { p: [0, 14, 1], s: [1, 1, 1], c: 'cyan', e: 3.2 }, // chest core (glow group 'core')
  ], { glow: G.core });
  const finTips = [{ p: [-5, 18, -2], s: [1, 1, 1], c: 'cyan', e: 2.4 }];
  add('finTips', 'chest', [...finTips, ...mirrorX(finTips, AXIS)], { glow: G.accent });

  // Head: squared kabuto, thick jaw mask, one visor row, forward-swept fin crest, stepped neck flap.
  add('head', 'head', [
    { p: [-1, 17, -1], s: [3, 3, 3], c: 'gunmetal' },
    { p: [-1, 17, 2], s: [3, 1, 1], c: 'darkSteel' }, // jaw mask
    { p: [-1, 19, 2], s: [3, 1, 1], c: 'gunmetal' }, // brow
    { p: [-2, 18, 0], s: [1, 2, 2], c: 'ivory' }, // side flaps
    ...mirrorX([{ p: [-2, 18, 0], s: [1, 2, 2], c: 'ivory' }], AXIS),
    { p: [-2, 17, -2], s: [5, 1, 1], c: 'darkSteel' }, // neck flap (stepped)
    { p: [-1, 18, -2], s: [3, 1, 1], c: 'gunmetal' },
    { p: [0, 20, 0], s: [1, 1, 2], c: 'gunmetal' }, // crest base
    { p: [0, 21, 1], s: [1, 1, 1], c: 'ivory' },
    { p: [0, 22, 2], s: [1, 1, 1], c: 'ivory' },
  ]);
  add('visor', 'head', [{ p: [-1, 18, 2], s: [3, 1, 1], c: 'cyan', e: 3.0 }], { glow: G.visor });

  // Shoulders: pauldrons on their own joints (lag), right sword arm, left claw gauntlet.
  addSplit('pauldronR', 'pauldronR', pauldronBoxes(), G.accent);
  addSplit('pauldronL', 'pauldronL', mirrorX(pauldronBoxes(), AXIS), G.accent);
  add('upperArmR', 'upperArmR', upperArmBoxes());
  add('upperArmL', 'upperArmL', mirrorX(upperArmBoxes(), AXIS));
  add('forearmR', 'forearmR', [
    { p: [-4, 10, -1], s: [2, 1, 2], c: 'darkSteel' }, // elbow
    { p: [-4, 7, -1], s: [2, 3, 2], c: 'gunmetal' },
    { p: [-4, 8, 1], s: [2, 2, 1], c: 'ivory' }, // bracer
  ]);
  add('handR', 'handR', [{ p: [-4, 5, -1], s: [2, 2, 2], c: 'darkSteel' }]);
  addSplit('forearmL', 'forearmL', [
    { p: [3, 10, -1], s: [2, 1, 2], c: 'darkSteel' }, // elbow
    { p: [3, 8, -1], s: [3, 2, 3], c: 'gunmetal' }, // oversized gauntlet (~1.5× the right forearm)
    { p: [3, 8, 2], s: [3, 2, 1], c: 'ivory' },
    { p: [5, 9, 2], s: [1, 1, 1], c: 'cyan', e: 2.4 },
    { p: [3, 7, -1], s: [3, 1, 3], c: 'darkSteel' }, // wrist chain housing (stays on the arm)
  ], G.accent);
  add('clawHand', 'clawHand', [
    { p: [3, 5, -1], s: [3, 2, 3], c: 'darkSteel' }, // palm
    { p: [3, 6, 2], s: [3, 1, 1], c: 'ivory' }, // knuckle plate
  ]);
  const finger = (x, z) => [
    { p: [x, 3, z], s: [1, 2, 1], c: 'gunmetal' },
    { p: [x, 3, z], s: [1, 1, 1], c: 'ivory' }, // claw tip
  ];
  add('clawFinger_0', 'clawFinger_0', finger(3, 1));
  add('clawFinger_1', 'clawFinger_1', finger(5, 1));
  add('clawFinger_2', 'clawFinger_2', finger(4, -1));

  // Nodachi, authored in the weapon's local grid (column centered on the grip, +Z = blade).
  const LOCAL = [-0.5, -0.5, 0];
  add('weapon', 'weapon', [
    { p: [0, 0, -4], s: [1, 1, 1], c: 'darkSteel' }, // pommel
    { p: [0, 0, -3], s: [1, 1, 5], c: 'crimson' }, // hilt through the fist
    { p: [-1, -1, 2], s: [3, 3, 1], c: 'darkSteel' }, // square guard
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
      { p: [-1, -1, 0], s: [1, 2, SEG_LEN], c: 'gunmetal' },
      { p: [1, -1, 0], s: [1, 2, SEG_LEN], c: 'gunmetal' },
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
