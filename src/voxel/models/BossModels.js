import { VOXEL, BOSS_VOXEL, CONFIG } from '../../config.js';
import { mirrorX } from '../VoxelBuilder.js';
import { JUGGERNAUT_PALETTE, KITSUNE_PALETTE, RAIJU_PALETTE } from '../palettes.js';
import { Rig } from '../../anim/Rig.js';

// Bosses (spec §9). Same conventions as EnemyModels: center column x ∈ [0, 1] (mirror axis 0.5),
// faces +Z, feet at y = 0, character's right = −X. The Juggernaut and the Raiju use BOSS_VOXEL
// (0.18 m) so they stay as chunky as the hero; the Kitsune uses VOXEL.
// Glow groups: eyes (telegraph flare), seams, weapon, core (Juggernaut furnace / enrage).

export const BOSS_GLOW = ['default', 'eyes', 'seams', 'weapon', 'core'];
const G = Object.fromEntries(BOSS_GLOW.map((n, i) => [n, i]));
const AXIS = 0.5;
const LOCAL = [-0.5, -0.5, 0]; // weapon grid centered on the grip, +Z forward

// A box split into horizontal courses of alternating colors → readable block rows.
function courses(p, s, c1, c2, h = 2, extra = {}) {
  const out = [];
  for (let y = 0, k = 0; y < s[1]; y += h, k++) out.push({ p: [p[0], p[1] + y, p[2]], s: [s[0], Math.min(h, s[1] - y), s[2]], c: k % 2 ? c2 : c1, ...extra });
  return out;
}

// Shared humanoid joints (same names as the hero / enemies).
function humanoid(d) {
  const L = (x) => 2 * AXIS - x;
  return [
    ['root', null, [0.5, 0, 0.5]],
    ['pelvis', 'root', [0.5, d.hip, d.z]],
    ['spine', 'pelvis', [0.5, d.hip + 1, d.z]],
    ['chest', 'spine', [0.5, d.chest, d.z]],
    ['head', 'chest', [0.5, d.neck, d.z]],
    ['thighR', 'pelvis', [d.legX, d.hip, d.legZ]],
    ['shinR', 'thighR', [d.legX, d.knee, d.legZ]],
    ['footR', 'shinR', [d.legX, d.ankle ?? 1.5, d.legZ]],
    ['thighL', 'pelvis', [L(d.legX), d.hip, d.legZ]],
    ['shinL', 'thighL', [L(d.legX), d.knee, d.legZ]],
    ['footL', 'shinL', [L(d.legX), d.ankle ?? 1.5, d.legZ]],
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

// ── Oni Juggernaut: ~2.2× hero height at 0.18 m blocks, horns, furnace chest, spiked club.
function juggernautDef() {
  const d = { hip: 12, knee: 6.5, ankle: 2, chest: 17, neck: 24, z: 0.5, legX: -2.5, legZ: 0.5, clavX: -5, armX: -8.5, shoulder: 22, elbow: 16.5, wrist: 11.5, grip: 10.5 };
  const joints = humanoid(d);
  const parts = [];
  const add = (name, joint, boxes, extra = {}) => parts.push({ name, joint, boxes, ...extra });
  for (const side of ['R', 'L']) {
    const m = side === 'L' ? (b) => mirrorX(b, AXIS) : (b) => b;
    add(`foot${side}`, `foot${side}`, m([
      { p: [-5, 0, -2], s: [5, 2, 6], c: 'black' },
      { p: [-5, 0, 4], s: [5, 1, 1], c: 'iron' },
      { p: [-5, 0, 5], s: [1, 1, 1], c: 'spike' },
      { p: [-1, 0, 5], s: [1, 1, 1], c: 'spike' },
    ]));
    add(`shin${side}`, `shin${side}`, m([
      ...courses([-5, 2, -2], [5, 5, 5], 'rust', 'rustDark'),
      { p: [-5, 5, 3], s: [5, 2, 1], c: 'iron' },
      { p: [-3, 6, 4], s: [1, 1, 1], c: 'spike' },
    ]));
    add(`thigh${side}`, `thigh${side}`, m([
      { p: [-5, 7, -2], s: [5, 5, 5], c: 'black' },
      ...courses([-5, 7, 3], [5, 5, 1], 'rust', 'rustDark'),
      { p: [-6, 8, -1], s: [1, 3, 3], c: 'iron' },
    ]));
  }
  add('pelvis', 'pelvis', [
    { p: [-6, 11, -3], s: [13, 2, 7], c: 'iron' },
    { p: [-1, 11, 4], s: [3, 2, 1], c: 'bronze' },
    { p: [-5, 9, 4], s: [11, 2, 1], c: 'rustDark' }, // loin plate
    { p: [-5, 9, -4], s: [11, 3, 1], c: 'rustDark' },
  ]);
  add('spine', 'spine', [{ p: [-5, 13, -2], s: [11, 4, 5], c: 'black' }, { p: [-4, 14, 3], s: [9, 2, 1], c: 'iron' }]);
  const grill = [];
  for (let x = -3; x <= 3; x += 2) grill.push({ p: [x, 18, 5], s: [1, 4, 1], c: 'ember', e: 2.4 });
  add('chest', 'chest', [
    ...courses([-7, 17, -3], [15, 6, 7], 'rust', 'rustDark'),
    { p: [-4, 17, 4], s: [9, 1, 2], c: 'black' },
    { p: [-4, 22, 4], s: [9, 1, 2], c: 'black' },
    { p: [-4, 18, 4], s: [1, 4, 1], c: 'black' },
    { p: [4, 18, 4], s: [1, 4, 1], c: 'black' },
    ...grill, // furnace grill (glow 'core')
    { p: [-2, 18, 4], s: [5, 4, 1], c: 'ember', e: 1.3 }, // fire behind the grill
    { p: [-6, 20, -4], s: [13, 3, 1], c: 'black' }, // back hump
    { p: [-5, 23, -2], s: [11, 1, 5], c: 'iron' }, // gorget
  ], { glow: G.core });
  add('head', 'head', [
    { p: [-2, 24, -1], s: [5, 4, 5], c: 'rust' },
    { p: [-2, 24, 4], s: [5, 1, 1], c: 'black' }, // jaw
    { p: [-2, 24, 4], s: [1, 1, 1], c: 'bone' }, // tusks
    { p: [2, 24, 4], s: [1, 1, 1], c: 'bone' },
    { p: [-2, 27, 4], s: [5, 1, 1], c: 'rustDark' }, // brow
    { p: [-2, 26, 4], s: [2, 1, 1], c: 'ember', e: 3 }, // eyes
    { p: [1, 26, 4], s: [2, 1, 1], c: 'ember', e: 3 },
    { p: [-3, 27, 0], s: [1, 2, 2], c: 'bone' }, // horns
    { p: [3, 27, 0], s: [1, 2, 2], c: 'bone' },
    { p: [-4, 29, 0], s: [1, 2, 1], c: 'bone' },
    { p: [4, 29, 0], s: [1, 2, 1], c: 'bone' },
    { p: [-4, 31, 1], s: [1, 1, 1], c: 'bone' },
    { p: [4, 31, 1], s: [1, 1, 1], c: 'bone' },
  ], { glow: G.eyes });
  const pauldron = [
    ...courses([-12, 21, -3], [6, 4, 7], 'rust', 'rustDark'),
    { p: [-12, 25, -2], s: [6, 1, 5], c: 'iron' },
    { p: [-11, 26, -1], s: [1, 2, 1], c: 'spike' },
    { p: [-9, 26, 1], s: [1, 2, 1], c: 'spike' },
    { p: [-11, 26, 2], s: [1, 1, 1], c: 'spike' },
  ];
  joints.push(['pauldronR', 'shoulderR', [-9, 23, 0.5]], ['pauldronL', 'shoulderL', [10, 23, 0.5]]);
  add('pauldronR', 'pauldronR', pauldron);
  add('pauldronL', 'pauldronL', mirrorX(pauldron, AXIS));
  const arm = {
    upper: [{ p: [-11, 17, -2], s: [5, 5, 5], c: 'black' }, { p: [-12, 18, -1], s: [1, 3, 3], c: 'iron' }],
    fore: [...courses([-11, 12, -2], [5, 5, 5], 'rust', 'rustDark'), { p: [-11, 14, 3], s: [5, 1, 1], c: 'iron' }, { p: [-12, 13, 0], s: [1, 1, 1], c: 'spike' }],
    hand: [{ p: [-11, 9, -2], s: [5, 3, 5], c: 'black' }, { p: [-11, 9, 3], s: [5, 1, 1], c: 'iron' }],
  };
  for (const side of ['R', 'L']) {
    const m = side === 'L' ? (b) => mirrorX(b, AXIS) : (b) => b;
    add(`upperArm${side}`, `upperArm${side}`, m(arm.upper));
    add(`forearm${side}`, `forearm${side}`, m(arm.fore));
    add(`hand${side}`, `hand${side}`, m(arm.hand));
  }
  const club = [{ p: [0, 0, -3], s: [1, 1, 1], c: 'bronze' }, { p: [0, 0, -2], s: [1, 1, 8], c: 'iron' }];
  club.push(...courses([-1, -1, 6], [3, 3, 9], 'black', 'iron', 3).map((b) => b)); // head (3 rings)
  for (const [x, y, z] of [[-2, 0, 7], [2, 0, 8], [0, 2, 7], [0, -2, 9], [-2, 0, 11], [2, 0, 12], [0, 2, 12], [0, -2, 13], [-2, 1, 14], [2, -1, 14], [0, 0, 15]]) club.push({ p: [x, y, z], s: [1, 1, 1], c: 'spike' });
  club.push({ p: [0, 2, 9], s: [1, 1, 2], c: 'ember', e: 2 });
  add('weapon', 'weapon', club, { local: LOCAL, glow: G.weapon });
  return { joints, parts, glowGroups: BOSS_GLOW };
}

// ── Kage Kitsune: tall agile ninja mech, fox mask, 3 segmented tails, twin blades.
export const KITSUNE_TAILS = 3;
export const KITSUNE_TAIL_LINKS = 6;
function kitsuneDef() {
  const d = { hip: 11, knee: 6, chest: 14.5, neck: 19, z: 0.5, legX: -1, legZ: 0, clavX: -2, armX: -3, shoulder: 17, elbow: 13, wrist: 9, grip: 8 };
  const joints = humanoid(d);
  joints.push(['weaponL', 'handL', [4, d.grip, d.legZ]]);
  const parts = [];
  const add = (name, joint, boxes, extra = {}) => parts.push({ name, joint, boxes, ...extra });
  for (const side of ['R', 'L']) {
    const m = side === 'L' ? (b) => mirrorX(b, AXIS) : (b) => b;
    add(`foot${side}`, `foot${side}`, m([{ p: [-2, 0, -1], s: [2, 1, 4], c: 'black' }, { p: [-2, 1, -1], s: [2, 1, 2], c: 'violet' }, { p: [-2, 0, 3], s: [2, 1, 1], c: 'steel' }]));
    add(`shin${side}`, `shin${side}`, m([{ p: [-2, 2, -1], s: [2, 4, 2], c: 'violetDark' }, { p: [-2, 2, 1], s: [2, 3, 1], c: 'violet' }, { p: [-2, 5, 1], s: [2, 1, 1], c: 'magenta', e: 1.8 }]));
    add(`thigh${side}`, `thigh${side}`, m([{ p: [-2, 6, -1], s: [2, 5, 2], c: 'black' }, { p: [-2, 7, 1], s: [2, 3, 1], c: 'violet' }, { p: [-3, 8, -1], s: [1, 2, 2], c: 'violetDark' }]));
  }
  add('pelvis', 'pelvis', [
    { p: [-2, 10, -1], s: [5, 2, 3], c: 'violetDark' },
    ...courses([-2, 6, 2], [5, 4, 1], 'violet', 'black', 1), // front sash
    ...courses([-3, 7, -2], [1, 3, 3], 'violet', 'black', 1), // hip guards
    ...courses([3, 7, -2], [1, 3, 3], 'violet', 'black', 1),
    { p: [0, 10, 2], s: [1, 1, 1], c: 'magenta', e: 2 },
  ]);
  add('spine', 'spine', [{ p: [-1, 12, -1], s: [3, 2, 2], c: 'black' }]);
  add('chest', 'chest', [
    ...courses([-3, 14, -1], [7, 4, 3], 'violet', 'violetDark', 1),
    { p: [-3, 16, 2], s: [1, 2, 1], c: 'steel' },
    { p: [3, 16, 2], s: [1, 2, 1], c: 'steel' },
    { p: [-2, 14, 2], s: [5, 3, 1], c: 'violetDark' },
    { p: [0, 15, 2], s: [1, 2, 1], c: 'magenta', e: 2.2 },
    { p: [-3, 18, -1], s: [7, 1, 3], c: 'black' },
    { p: [-4, 17, -1], s: [1, 2, 3], c: 'violetDark' }, // shoulder guards
    { p: [4, 17, -1], s: [1, 2, 3], c: 'violetDark' },
    { p: [-2, 14, -2], s: [5, 4, 1], c: 'black' },
  ], { glow: G.seams });
  add('head', 'head', [
    { p: [-1, 19, -1], s: [3, 3, 3], c: 'black' },
    { p: [-1, 19, 2], s: [3, 2, 1], c: 'mask' }, // fox mask
    { p: [0, 19, 3], s: [1, 1, 1], c: 'mask' }, // muzzle
    { p: [-1, 21, 2], s: [1, 1, 1], c: 'magenta', e: 3 }, // eyes
    { p: [1, 21, 2], s: [1, 1, 1], c: 'magenta', e: 3 },
    { p: [-1, 22, 0], s: [1, 2, 1], c: 'mask' }, // ears
    { p: [1, 22, 0], s: [1, 2, 1], c: 'mask' },
    { p: [-1, 24, 0], s: [1, 1, 1], c: 'magenta', e: 2 },
    { p: [1, 24, 0], s: [1, 1, 1], c: 'magenta', e: 2 },
  ], { glow: G.eyes });
  const arm = {
    upper: [{ p: [-4, 14, -1], s: [2, 3, 2], c: 'black' }],
    fore: [{ p: [-4, 10, -1], s: [2, 3, 2], c: 'violet' }, { p: [-5, 11, -1], s: [1, 2, 2], c: 'magenta', e: 1.6 }],
    hand: [{ p: [-4, 8, -1], s: [2, 1, 2], c: 'black' }],
  };
  for (const side of ['R', 'L']) {
    const m = side === 'L' ? (b) => mirrorX(b, AXIS) : (b) => b;
    add(`upperArm${side}`, `upperArm${side}`, m(arm.upper));
    add(`forearm${side}`, `forearm${side}`, m(arm.fore), { glow: G.seams });
    add(`hand${side}`, `hand${side}`, m(arm.hand));
  }
  const blade = [{ p: [0, 0, -1], s: [1, 1, 2], c: 'black' }, { p: [0, -1, 1], s: [1, 2, 1], c: 'steel' }, { p: [0, 0, 2], s: [1, 1, 8], c: 'blade', e: 2.2 }];
  add('weapon', 'weapon', blade, { local: LOCAL, glow: G.weapon });
  add('weaponL', 'weaponL', blade, { local: LOCAL, glow: G.weapon });
  // Tails: 3 chains of block links from the lower back, spreading out.
  for (let t = 0; t < KITSUNE_TAILS; t++) {
    const x = [-1.5, 0.5, 2.5][t];
    let parent = 'pelvis';
    for (let k = 0; k < KITSUNE_TAIL_LINKS; k++) {
      const name = `tail${t}_${k}`;
      const pz = -2 - k * 2;
      const py = 10 + k * 1.2;
      joints.push([name, parent, [x, py, pz + 1]]);
      const last = k === KITSUNE_TAIL_LINKS - 1;
      const w = last ? 2 : 2;
      const bx = Math.floor(x);
      const by = Math.floor(py) - 1;
      const link = [{ p: [bx, by, pz - 1], s: [w, 2, 2], c: last ? 'magenta' : k % 2 ? 'violet' : 'black', ...(last ? { e: 2.6 } : {}) }];
      if (!last) link.push({ p: [bx, by + 2, pz], s: [w, 1, 1], c: k % 2 ? 'violetDark' : 'steel' }); // dorsal fin
      if (k === 0) link.push({ p: [bx, by - 1, pz], s: [w, 1, 1], c: 'violetDark' });
      add(name, name, link, last ? { glow: G.seams } : {});
      parent = name;
    }
  }
  return { joints, parts, glowGroups: BOSS_GLOW };
}

// ── Raiju Serpent: head + jaw + N body segments, all driven in world space (no hierarchy).
function raijuDef() {
  const R = CONFIG.bosses.raiju;
  const joints = [['root', null, [0.5, 0, 0.5]], ['head', 'root', [0.5, 16, 0.5]], ['jaw', 'head', [0.5, 13, 1]]];
  const parts = [];
  const add = (name, joint, boxes, extra = {}) => parts.push({ name, joint, boxes, ...extra });
  add('head', 'head', [
    ...courses([-3, 13, -1], [7, 5, 6], 'black', 'goldDark'),
    { p: [-3, 18, -1], s: [7, 1, 6], c: 'gold' },
    { p: [-2, 14, 5], s: [5, 3, 4], c: 'black' }, // snout
    { p: [-2, 17, 5], s: [5, 1, 4], c: 'gold' },
    { p: [-2, 16, 9], s: [1, 1, 1], c: 'fang' },
    { p: [2, 16, 9], s: [1, 1, 1], c: 'fang' },
    { p: [-3, 16, 3], s: [1, 1, 2], c: 'yellow', e: 3 }, // eyes
    { p: [3, 16, 3], s: [1, 1, 2], c: 'yellow', e: 3 },
    { p: [-3, 19, 0], s: [1, 3, 1], c: 'horn' }, // horns
    { p: [3, 19, 0], s: [1, 3, 1], c: 'horn' },
    { p: [-4, 21, -1], s: [1, 3, 1], c: 'horn' },
    { p: [4, 21, -1], s: [1, 3, 1], c: 'horn' },
    { p: [-4, 23, -2], s: [1, 2, 1], c: 'horn' },
    { p: [4, 23, -2], s: [1, 2, 1], c: 'horn' },
    { p: [-4, 14, -1], s: [1, 4, 3], c: 'gold' }, // mane
    { p: [4, 14, -1], s: [1, 4, 3], c: 'gold' },
    { p: [-5, 15, -2], s: [1, 2, 2], c: 'goldDark' },
    { p: [5, 15, -2], s: [1, 2, 2], c: 'goldDark' },
    { p: [-3, 13, 8], s: [1, 1, 3], c: 'horn' }, // whiskers
    { p: [3, 13, 8], s: [1, 1, 3], c: 'horn' },
  ], { glow: G.eyes });
  add('jaw', 'jaw', [
    { p: [-2, 11, 1], s: [5, 2, 8], c: 'black' },
    { p: [-2, 13, 8], s: [1, 1, 1], c: 'fang' },
    { p: [2, 13, 8], s: [1, 1, 1], c: 'fang' },
    { p: [-1, 13, 3], s: [3, 1, 4], c: 'yellow', e: 2.6 }, // throat glow
  ], { glow: G.core });
  for (let i = 0; i < R.segments; i++) {
    const name = `seg_${i}`;
    const pz = -4 - i * 5;
    joints.push([name, 'root', [0.5, 16, pz + 0.5]]);
    const big = i < R.segments - 5;
    const w = big ? 5 : 3;
    const x0 = big ? -2 : -1;
    const boxes = [
      { p: [x0, 14, pz - 2], s: [w, 4, 5], c: 'black' },
      { p: [x0, 18, pz - 2], s: [w, 1, 5], c: i % 2 ? 'gold' : 'goldDark' },
      { p: [x0 - 1, 15, pz - 1], s: [1, 2, 3], c: 'gold' },
      { p: [x0 + w, 15, pz - 1], s: [1, 2, 3], c: 'gold' },
      { p: [0, 13, pz - 1], s: [1, 1, 3], c: 'yellow', e: 2 }, // belly glow
    ];
    if (i % 2 === 0) boxes.push({ p: [0, 19, pz], s: [1, 2, 1], c: 'horn' }); // dorsal spine
    if (i === R.segments - 1) boxes.push({ p: [-1, 15, pz - 5], s: [3, 2, 3], c: 'gold' }, { p: [0, 16, pz - 7], s: [1, 1, 2], c: 'yellow', e: 2.5 });
    add(name, name, boxes, { glow: G.seams });
  }
  return { joints, parts, glowGroups: BOSS_GLOW };
}

export const BOSS_DEFS = {
  juggernaut: { def: juggernautDef, voxel: BOSS_VOXEL, palette: JUGGERNAUT_PALETTE, seed: 31 },
  kitsune: { def: kitsuneDef, voxel: VOXEL, palette: KITSUNE_PALETTE, seed: 37 },
  raiju: { def: raijuDef, voxel: BOSS_VOXEL, palette: RAIJU_PALETTE, seed: 41 },
};

export function buildBossRig(type) {
  const B = BOSS_DEFS[type];
  return new Rig(B.def(), { voxelSize: B.voxel, palette: B.palette, seed: B.seed, name: type });
}
