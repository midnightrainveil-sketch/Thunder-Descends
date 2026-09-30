import { VOXEL } from '../../config.js';
import { mirrorX } from '../VoxelBuilder.js';
import { ENEMY_PALETTE } from '../palettes.js';
import { Rig } from '../../anim/Rig.js';

// Enemy robots (spec §8): rust / black / bronze armor, orange emissive eyes and seams, the same
// 0.12 m block scale and adult proportions as the hero. Model grid as the hero: center column
// x ∈ [0, 1] (mirror axis 0.5), faces +Z, feet at y = 0, character's right = −X (weapon hand).
// Glow groups: eyes flare for telegraphs, seams pulse, weapon glow.

export const ENEMY_GLOW = ['default', 'eyes', 'seams', 'weapon'];
const G = Object.fromEntries(ENEMY_GLOW.map((n, i) => [n, i]));
const AXIS = 0.5;
const LOCAL = [-0.5, -0.5, 0]; // weapon grid: column centered on the grip, +Z forward

// Shared humanoid joints (same names as the hero so clip authoring stays consistent).
function humanoid(d) {
  const L = (x) => 2 * AXIS - x; // mirror an x pivot to the left side
  return [
    ['root', null, [0.5, 0, 0.5]],
    ['pelvis', 'root', [0.5, d.hip, d.z]],
    ['spine', 'pelvis', [0.5, d.hip + 1, d.z]],
    ['chest', 'spine', [0.5, d.chest, d.z]],
    ['head', 'chest', [0.5, d.neck, d.z]],
    ['sashFront', 'pelvis', [0.5, d.hip, d.sashZ[1]]],
    ['sashBack', 'pelvis', [0.5, d.hip, d.sashZ[0]]],
    ['thighR', 'pelvis', [d.legX, d.hip, d.legZ]],
    ['shinR', 'thighR', [d.legX, d.knee, d.legZ]],
    ['footR', 'shinR', [d.legX, 1.5, d.legZ]],
    ['thighL', 'pelvis', [L(d.legX), d.hip, d.legZ]],
    ['shinL', 'thighL', [L(d.legX), d.knee, d.legZ]],
    ['footL', 'shinL', [L(d.legX), 1.5, d.legZ]],
    ['shoulderR', 'chest', [d.clavX, d.shoulder + 0.5, d.legZ]],
    ['upperArmR', 'shoulderR', [d.armX, d.shoulder, d.legZ]],
    ['forearmR', 'upperArmR', [d.armX, d.elbow, d.legZ]],
    ['handR', 'forearmR', [d.armX, d.wrist, d.legZ]],
    ['weapon', 'handR', [d.armX, d.grip, d.legZ]],
    ['shoulderL', 'chest', [L(d.clavX), d.shoulder + 0.5, d.legZ]],
    ['upperArmL', 'shoulderL', [L(d.armX), d.shoulder, d.legZ]],
    ['forearmL', 'upperArmL', [L(d.armX), d.elbow, d.legZ]],
    ['handL', 'forearmL', [L(d.armX), d.wrist, d.legZ]],
  ];
}

const both = (boxes) => [...boxes, ...mirrorX(boxes, AXIS)];

// ── Ronin Drone: lean ashigaru armor, wide conical hat, one eye, short katana.
function roninDef() {
  const d = { hip: 9, knee: 5.5, chest: 12, neck: 15, z: 0.5, legX: -1, legZ: 0, sashZ: [-1, 2], clavX: -2, armX: -3, shoulder: 13.5, elbow: 10.5, wrist: 7, grip: 6 };
  const joints = humanoid(d);
  const x = -2;
  const parts = [];
  const add = (name, joint, boxes, extra = {}) => parts.push({ name, joint, boxes, ...extra });
  for (const side of ['R', 'L']) {
    const m = side === 'L' ? (b) => mirrorX(b, AXIS) : (b) => b;
    add(`foot${side}`, `foot${side}`, m([
      { p: [x, 0, -1], s: [2, 1, 3], c: 'black' },
      { p: [x, 0, 2], s: [2, 1, 1], c: 'bronze' },
      { p: [x, 1, -1], s: [2, 1, 2], c: 'black' },
    ]));
    add(`shin${side}`, `shin${side}`, m([
      { p: [x, 2, -1], s: [2, 3, 2], c: 'black' },
      { p: [x, 2, 1], s: [2, 3, 1], c: 'rust' },
      { p: [x, 5, -1], s: [2, 1, 2], c: 'bronze' },
    ]));
    add(`thigh${side}`, `thigh${side}`, m([{ p: [x, 6, -1], s: [2, 3, 2], c: 'black' }]));
  }
  add('pelvis', 'pelvis', [
    { p: [-2, 9, -1], s: [5, 1, 3], c: 'bronze' },
    { p: [0, 7, -1], s: [1, 2, 2], c: 'black' },
    ...both([{ p: [-3, 6, -1], s: [1, 3, 3], c: 'rust' }]), // side kusazuri
  ]);
  add('sashFront', 'sashFront', [
    { p: [-2, 6, 2], s: [5, 3, 1], c: 'rust' },
    { p: [-2, 6, 2], s: [5, 1, 1], c: 'rustDark' },
  ]);
  add('sashBack', 'sashBack', [
    { p: [-2, 6, -2], s: [5, 3, 1], c: 'rust' },
    { p: [-2, 6, -2], s: [5, 1, 1], c: 'rustDark' },
  ]);
  add('spine', 'spine', [{ p: [-1, 10, -1], s: [3, 2, 3], c: 'black' }]);
  add('chest', 'chest', [
    { p: [-2, 12, -1], s: [5, 3, 3], c: 'rust' },
    { p: [0, 12, 1], s: [1, 3, 1], c: 'black' },
    ...both([{ p: [-2, 13, 1], s: [1, 1, 1], c: 'ember', e: 1.6 }]), // chest seams
    { p: [-1, 15, -1], s: [3, 1, 2], c: 'bronze' }, // collar
    { p: [-1, 12, -2], s: [3, 3, 1], c: 'black' },
  ], { glow: G.seams });
  add('head', 'head', [
    { p: [-1, 16, -1], s: [3, 2, 3], c: 'black' },
    { p: [-1, 16, 2], s: [3, 2, 1], c: 'steel' },
    { p: [-3, 18, -3], s: [7, 1, 7], c: 'rust' }, // conical jingasa hat
    { p: [-3, 18, 3], s: [7, 1, 1], c: 'rustDark' },
    { p: [-2, 19, -2], s: [5, 1, 5], c: 'rust' },
    { p: [-1, 20, -1], s: [3, 1, 3], c: 'rustDark' },
    { p: [0, 21, 0], s: [1, 1, 1], c: 'bronze' },
    { p: [0, 17, 2], s: [1, 1, 1], c: 'ember', e: 3.0 }, // single eye (glow group 'eyes')
  ], { glow: G.eyes });
  const arm = {
    upper: [
      { p: [-4, 11, -1], s: [2, 3, 2], c: 'black' },
      { p: [-4, 14, -1], s: [2, 1, 2], c: 'rust' },
    ],
    fore: [
      { p: [-4, 10, -1], s: [2, 1, 2], c: 'bronze' },
      { p: [-4, 7, -1], s: [2, 3, 2], c: 'rust' },
    ],
    hand: [{ p: [-4, 5, -1], s: [2, 2, 2], c: 'black' }],
  };
  add('upperArmR', 'upperArmR', arm.upper);
  add('forearmR', 'forearmR', arm.fore);
  add('handR', 'handR', arm.hand);
  add('upperArmL', 'upperArmL', mirrorX(arm.upper, AXIS));
  add('forearmL', 'forearmL', mirrorX(arm.fore, AXIS));
  add('handL', 'handL', mirrorX(arm.hand, AXIS));
  add('weapon', 'weapon', [
    { p: [0, 0, -3], s: [1, 1, 1], c: 'bronze' },
    { p: [0, 0, -2], s: [1, 1, 4], c: 'black' },
    { p: [0, -1, 2], s: [1, 3, 1], c: 'bronze' }, // guard
    { p: [0, 0, 3], s: [1, 1, 7], c: 'steel' },
    { p: [0, -1, 3], s: [1, 1, 5], c: 'black' },
    { p: [0, -1, 8], s: [1, 1, 2], c: 'ember', e: 2.4 }, // glowing edge near the tip
  ], { local: LOCAL, glow: G.weapon });
  return { joints, parts, glowGroups: ENEMY_GLOW };
}

// ── Teppo Gunner: long rifle (muzzle node), back ammo drum, scope helmet.
function teppoDef() {
  const d = { hip: 9, knee: 5.5, chest: 12, neck: 15, z: 0.5, legX: -1, legZ: 0, sashZ: [-1, 2], clavX: -2, armX: -3, shoulder: 13.5, elbow: 10.5, wrist: 7, grip: 6 };
  const joints = humanoid(d);
  joints.push(['muzzle', 'weapon', [d.armX, d.grip, 14]]);
  const x = -2;
  const parts = [];
  const add = (name, joint, boxes, extra = {}) => parts.push({ name, joint, boxes, ...extra });
  for (const side of ['R', 'L']) {
    const m = side === 'L' ? (b) => mirrorX(b, AXIS) : (b) => b;
    add(`foot${side}`, `foot${side}`, m([
      { p: [x, 0, -1], s: [2, 1, 3], c: 'black' },
      { p: [x, 0, 2], s: [2, 1, 1], c: 'rust' },
      { p: [x, 1, -1], s: [2, 1, 2], c: 'bronze' },
    ]));
    add(`shin${side}`, `shin${side}`, m([
      { p: [x, 2, -1], s: [2, 3, 2], c: 'black' },
      { p: [x, 2, 1], s: [2, 2, 1], c: 'rust' },
      { p: [x, 5, -1], s: [2, 1, 2], c: 'black' },
      { p: [x, 5, 1], s: [2, 1, 1], c: 'bronze' },
    ]));
    add(`thigh${side}`, `thigh${side}`, m([
      { p: [x, 6, -1], s: [2, 3, 2], c: 'rustDark' },
      { p: [x, 7, 1], s: [2, 2, 1], c: 'rust' },
    ]));
  }
  add('pelvis', 'pelvis', [
    { p: [-2, 9, -1], s: [5, 1, 3], c: 'black' },
    { p: [0, 7, -1], s: [1, 2, 2], c: 'black' },
    ...both([{ p: [-3, 8, 0], s: [1, 2, 2], c: 'bronze' }]), // ammo pouches
  ]);
  add('sashFront', 'sashFront', [{ p: [-1, 7, 2], s: [3, 2, 1], c: 'rust' }]);
  add('sashBack', 'sashBack', [{ p: [-1, 7, -2], s: [3, 2, 1], c: 'rust' }]);
  add('spine', 'spine', [{ p: [-1, 10, -1], s: [3, 2, 3], c: 'black' }]);
  add('chest', 'chest', [
    { p: [-2, 12, -1], s: [5, 3, 3], c: 'rust' },
    { p: [-2, 14, 1], s: [1, 1, 1], c: 'bronze' }, // bandolier
    { p: [-1, 13, 1], s: [1, 1, 1], c: 'bronze' },
    { p: [0, 12, 1], s: [1, 1, 1], c: 'bronze' },
    { p: [-1, 15, -1], s: [3, 1, 2], c: 'black' },
    { p: [-2, 12, -2], s: [5, 3, 1], c: 'black' },
    // Ammo drum on the back with a glowing feed ring.
    { p: [-1, 11, -4], s: [3, 4, 2], c: 'bronze' },
    { p: [-1, 11, -4], s: [3, 1, 2], c: 'rustDark' },
    { p: [0, 12, -5], s: [1, 2, 1], c: 'ember', e: 2.0 },
    { p: [2, 12, -3], s: [1, 1, 1], c: 'black' }, // feed tube
  ], { glow: G.seams });
  add('head', 'head', [
    { p: [-1, 16, -1], s: [3, 3, 3], c: 'black' }, // tall scope helmet
    { p: [-1, 16, 2], s: [3, 2, 1], c: 'steel' },
    { p: [-1, 17, 2], s: [1, 1, 1], c: 'bronze' }, // scope housing (right eye)
    { p: [-1, 19, -1], s: [3, 1, 3], c: 'rust' },
    { p: [0, 20, 0], s: [1, 2, 1], c: 'rust' }, // crest spike
    { p: [0, 22, 0], s: [1, 1, 1], c: 'bronze' },
    { p: [-1, 17, 3], s: [1, 1, 1], c: 'ember', e: 3.0 }, // scope lens = eye (glow group 'eyes')
  ], { glow: G.eyes });
  const arm = {
    upper: [
      { p: [-4, 11, -1], s: [2, 3, 2], c: 'black' },
      { p: [-4, 14, -1], s: [2, 1, 2], c: 'rust' },
    ],
    fore: [
      { p: [-4, 10, -1], s: [2, 1, 2], c: 'bronze' },
      { p: [-4, 7, -1], s: [2, 3, 2], c: 'black' },
    ],
    hand: [{ p: [-4, 5, -1], s: [2, 2, 2], c: 'black' }],
  };
  add('upperArmR', 'upperArmR', arm.upper);
  add('forearmR', 'forearmR', arm.fore);
  add('handR', 'handR', arm.hand);
  add('upperArmL', 'upperArmL', mirrorX(arm.upper, AXIS));
  add('forearmL', 'forearmL', mirrorX(arm.fore, AXIS));
  add('handL', 'handL', mirrorX(arm.hand, AXIS));
  add('weapon', 'weapon', [
    { p: [0, -1, -5], s: [1, 2, 4], c: 'bronze' }, // stock
    { p: [0, 0, -1], s: [1, 1, 6], c: 'black' }, // receiver
    { p: [0, -2, 1], s: [1, 2, 1], c: 'bronze' }, // magazine
    { p: [0, 1, 0], s: [1, 1, 3], c: 'black' }, // scope
    { p: [0, 0, 5], s: [1, 1, 8], c: 'steel' }, // long barrel
    { p: [0, -1, 5], s: [1, 1, 2], c: 'bronze' }, // barrel clamp
    { p: [0, 0, 13], s: [1, 1, 1], c: 'ember', e: 2.2 }, // muzzle glow
  ], { local: LOCAL, glow: G.weapon });
  return { joints, parts, glowGroups: ENEMY_GLOW };
}

// ── Tate Brute: ~1.05× height, ~1.3× width, tower shield (shield node), hammer.
function tateDef() {
  const d = { hip: 10, knee: 5.5, chest: 13, neck: 17.5, z: 0.5, legX: -1.5, legZ: 0.5, sashZ: [-2, 3], clavX: -3, armX: -4.5, shoulder: 15.5, elbow: 11.5, wrist: 8, grip: 7 };
  const joints = humanoid(d);
  joints.push(['pauldronR', 'shoulderR', [-5, 17, 0.5]]);
  joints.push(['pauldronL', 'shoulderL', [6, 17, 0.5]]);
  joints.push(['shield', 'forearmL', [5.5, 10, 0.5]]);
  const x = -3;
  const parts = [];
  const add = (name, joint, boxes, extra = {}) => parts.push({ name, joint, boxes, ...extra });
  for (const side of ['R', 'L']) {
    const m = side === 'L' ? (b) => mirrorX(b, AXIS) : (b) => b;
    add(`foot${side}`, `foot${side}`, m([
      { p: [x, 0, -1], s: [3, 1, 4], c: 'black' },
      { p: [x, 0, 3], s: [3, 1, 1], c: 'bronze' },
      { p: [x, 1, -1], s: [3, 1, 3], c: 'rust' },
    ]));
    add(`shin${side}`, `shin${side}`, m([
      { p: [x, 2, -1], s: [3, 3, 3], c: 'black' },
      { p: [x, 2, 2], s: [3, 3, 1], c: 'rust' },
      { p: [x, 5, -1], s: [3, 1, 3], c: 'bronze' },
      { p: [x, 5, 2], s: [3, 2, 1], c: 'rust' },
    ]));
    add(`thigh${side}`, `thigh${side}`, m([
      { p: [x, 6, -1], s: [3, 4, 3], c: 'rust' },
      { p: [x, 6, -1], s: [1, 4, 3], c: 'rustDark' },
    ]));
  }
  add('pelvis', 'pelvis', [
    { p: [-3, 10, -1], s: [7, 1, 4], c: 'bronze' },
    { p: [0, 8, -1], s: [1, 2, 3], c: 'black' },
  ]);
  add('sashFront', 'sashFront', [
    { p: [-2, 6, 3], s: [5, 4, 1], c: 'rust' },
    { p: [-2, 6, 3], s: [5, 1, 1], c: 'black' },
  ]);
  add('sashBack', 'sashBack', [{ p: [-2, 7, -2], s: [5, 3, 1], c: 'rust' }]);
  add('spine', 'spine', [{ p: [-2, 11, -1], s: [5, 2, 4], c: 'black' }]);
  add('chest', 'chest', [
    { p: [-3, 13, -1], s: [7, 4, 4], c: 'rust' },
    { p: [-2, 14, 3], s: [5, 2, 1], c: 'rustDark' },
    { p: [0, 13, 3], s: [1, 3, 1], c: 'ember', e: 1.8 }, // chest seam
    { p: [-2, 17, -1], s: [5, 1, 3], c: 'black' }, // gorget
    { p: [-2, 13, -2], s: [5, 4, 1], c: 'black' },
  ], { glow: G.seams });
  add('head', 'head', [
    { p: [-1, 18, -1], s: [3, 3, 3], c: 'black' },
    { p: [-1, 18, 2], s: [3, 2, 1], c: 'rustDark' },
    { p: [0, 21, 0], s: [1, 2, 1], c: 'rust' }, // helmet spike
    { p: [0, 23, 0], s: [1, 1, 1], c: 'rustDark' },
    { p: [0, 19, 3], s: [1, 1, 1], c: 'ember', e: 3.0 }, // eye (glow group 'eyes')
  ], { glow: G.eyes });
  const pauldron = [
    { p: [-7, 16, -2], s: [4, 2, 6], c: 'rust' },
    { p: [-7, 16, -2], s: [4, 1, 6], c: 'bronze' },
    { p: [-7, 17, 1], s: [1, 1, 1], c: 'ember', e: 1.6 },
  ];
  add('pauldronR', 'pauldronR', pauldron, { glow: G.seams });
  add('pauldronL', 'pauldronL', mirrorX(pauldron, AXIS), { glow: G.seams });
  const arm = {
    upper: [{ p: [-6, 12, -1], s: [3, 4, 3], c: 'black' }],
    fore: [
      { p: [-6, 11, -1], s: [3, 1, 3], c: 'bronze' },
      { p: [-6, 8, -1], s: [3, 3, 3], c: 'rust' },
    ],
    hand: [{ p: [-6, 6, -1], s: [3, 2, 3], c: 'black' }],
  };
  add('upperArmR', 'upperArmR', arm.upper);
  add('forearmR', 'forearmR', arm.fore);
  add('handR', 'handR', arm.hand);
  add('upperArmL', 'upperArmL', mirrorX(arm.upper, AXIS));
  add('forearmL', 'forearmL', mirrorX(arm.fore, AXIS));
  add('handL', 'handL', mirrorX(arm.hand, AXIS));
  // Tower shield in front of the left side: black body, bronze frame, rust face, ember seam line.
  add('shield', 'shield', [
    { p: [2, 2, 3], s: [7, 14, 1], c: 'black' },
    { p: [2, 2, 4], s: [7, 14, 1], c: 'rust' },
    { p: [2, 2, 4], s: [7, 1, 1], c: 'bronze' },
    { p: [2, 15, 4], s: [7, 1, 1], c: 'bronze' },
    { p: [2, 2, 4], s: [1, 14, 1], c: 'bronze' },
    { p: [8, 2, 4], s: [1, 14, 1], c: 'bronze' },
    { p: [5, 4, 4], s: [1, 10, 1], c: 'ember', e: 1.8 },
    { p: [5, 8, 4], s: [1, 2, 1], c: 'ember', e: 3.0 },
  ], { glow: G.seams });
  add('weapon', 'weapon', [
    { p: [0, 0, -4], s: [1, 1, 1], c: 'black' },
    { p: [0, 0, -3], s: [1, 1, 12], c: 'bronze' }, // handle
    { p: [-1, -1, 9], s: [3, 3, 4], c: 'black' }, // hammer head
    { p: [-1, -1, 9], s: [3, 3, 1], c: 'bronze' },
    { p: [-1, -1, 12], s: [3, 3, 1], c: 'bronze' },
    { p: [0, 1, 10], s: [1, 1, 2], c: 'ember', e: 2.0 },
  ], { local: LOCAL, glow: G.weapon });
  return { joints, parts, glowGroups: ENEMY_GLOW };
}

export const ENEMY_DEFS = { ronin: roninDef, teppo: teppoDef, tate: tateDef };

export function buildEnemyRig(type) {
  const def = ENEMY_DEFS[type]();
  return new Rig(def, { voxelSize: VOXEL, palette: ENEMY_PALETTE, seed: { ronin: 11, teppo: 13, tate: 17 }[type], name: type });
}
