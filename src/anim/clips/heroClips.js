import { CONFIG } from '../../config.js';
import { mirrorPose, merge, pick, LEG_JOINTS } from './poseUtils.js';

// Hero clips (spec §5). Weighty and controlled: small anticipation, fast strike, longer settle.
// Timings (durations, hit windows) come from CONFIG.hero.anim so gameplay can tune them.

// Ready stance arms: sword low and out to the right (IMG-00), claw loosely curled.
export const HERO_GUARD = {
  upperArmR: [-16, 0, -12],
  forearmR: [-28, 0, 0],
  handR: [0, 0, 8],
  weapon: [62, -38, 0],
  upperArmL: [-10, 0, 10],
  forearmL: [-26, 0, 0],
  clawFinger_0: [22, 0, 0],
  clawFinger_1: [22, 0, 0],
  clawFinger_2: [-22, 0, 0],
};

const STANCE = {
  'pelvis@': [0, -0.03, 0],
  thighR: [-12, 4, -5],
  shinR: [20, 0, 0],
  footR: [-8, -4, 5],
  thighL: [-4, -6, 5],
  shinL: [12, 0, 0],
  footL: [-8, 6, -5],
  spine: [6, 0, 0],
  chest: [3, 0, 0],
  head: [-8, 0, 0],
};

function idle() {
  const a = merge(STANCE, HERO_GUARD);
  const b = merge(a, { spine: [7, 1, 0], chest: [4.5, 0, 0], head: [-9, 1, 0], 'pelvis@': [0.004, -0.035, 0], upperArmR: [-18, 0, -13], weapon: [63, -37, 0] });
  return {
    name: 'idle',
    duration: CONFIG.hero.anim.idleDuration,
    loop: true,
    keys: [
      { t: 0, pose: a },
      { t: 0.5, ease: 'inOut', pose: b },
    ],
  };
}

// Run: two steps per cycle, sword trailing low behind, claw arm swinging opposite the legs.
function run() {
  const contactR = {
    'pelvis@': [0, -0.05, 0],
    pelvis: [0, 8, 0],
    thighR: [-38, 0, 0],
    shinR: [12, 0, 0],
    footR: [16, 0, 0],
    thighL: [30, 0, 0],
    shinL: [58, 0, 0],
    footL: [22, 0, 0],
  };
  const passR = {
    'pelvis@': [0, -0.012, 0],
    pelvis: [0, 0, 0],
    thighR: [-4, 0, 0],
    shinR: [24, 0, 0],
    footR: [-14, 0, 0],
    thighL: [-32, 0, 0],
    shinL: [96, 0, 0],
    footL: [8, 0, 0],
  };
  const upper = (phase) => ({
    spine: [14, 0, 0],
    chest: [2, phase * -9, 0],
    head: [-14, phase * 4, 0],
    upperArmR: [26 + phase * 6, 0, -14],
    forearmR: [-34, 0, 0],
    handR: [0, 0, 6],
    weapon: [150, -22, 0],
    upperArmL: [phase * -30, 0, 10],
    forearmL: [-42, 0, 0],
    clawFinger_0: [26, 0, 0],
    clawFinger_1: [26, 0, 0],
    clawFinger_2: [-26, 0, 0],
  });
  const k0 = merge(contactR, upper(1));
  const k1 = merge(passR, upper(0));
  const k2 = merge(mirrorPose(pick(contactR, [...LEG_JOINTS])), { 'pelvis@': [0, -0.05, 0], pelvis: [0, -8, 0] }, upper(-1));
  const k3 = merge(mirrorPose(pick(passR, [...LEG_JOINTS])), { 'pelvis@': [0, -0.012, 0], pelvis: [0, 0, 0] }, upper(0));
  return {
    name: 'run',
    duration: CONFIG.hero.anim.runDuration,
    loop: true,
    keys: [
      { t: 0, pose: k0 },
      { t: 0.25, ease: 'smooth', pose: k1 },
      { t: 0.5, ease: 'smooth', pose: k2 },
      { t: 0.75, ease: 'smooth', pose: k3 },
    ],
  };
}

// Attack helper: guard → windup (anticipation) → mid (blade crossing, inside the hit window)
// → strike (end of the hit window) → follow-through → settle back to guard.
// Arm/weapon angles were solved offline against the rig (grip position + blade direction per key).
function attack(name, index, { windup, mid, strike, follow }) {
  const A = CONFIG.hero.anim;
  const [hs, he] = A.hitWindows[index];
  const guard = merge(HERO_GUARD, { spine: [6, 0, 0], chest: [3, 0, 0], head: [-8, 0, 0] });
  return {
    name,
    duration: A.attackDurations[index],
    loop: false,
    events: [
      { t: hs, name: 'hitStart' },
      { t: he, name: 'hitEnd' },
    ],
    keys: [
      { t: 0, pose: guard },
      { t: hs - 0.04, ease: 'out', pose: windup }, // decelerate into the coil
      { t: (hs + he) / 2, ease: 'in', pose: mid }, // accelerate through the cut…
      { t: he, ease: 'out', pose: strike }, // …and brake at the end of it
      { t: Math.min(0.95, he + 0.18), ease: 'out', pose: follow },
      { t: 1, ease: 'inOut', pose: guard },
    ],
  };
}

// 1: diagonal cut, high right → low left.
function attack1() {
  return attack('attack1', 0, {
    windup: {
      spine: [2, -28, 0],
      chest: [-4, -18, 0],
      head: [-6, 34, 0],
      upperArmR: [-61, -10, 44],
      forearmR: [-117, 0, 0],
      handR: [0, 0, 0],
      weapon: [48, -22, 0],
      upperArmL: [-30, 0, 20],
      forearmL: [-40, 0, 0],
    },
    mid: {
      spine: [8, 0, 0],
      chest: [3, 0, 0],
      head: [-8, 0, 0],
      upperArmR: [-49, 0, 26],
      forearmR: [-56, 0, 0],
      handR: [0, 0, 0],
      weapon: [87, -83, 0],
      upperArmL: [-10, 0, 18],
      forearmL: [-36, 0, 0],
    },
    strike: {
      spine: [14, 30, 0],
      chest: [8, 16, 0],
      head: [-14, -34, 0],
      upperArmR: [-56, 14, 0],
      forearmR: [-1, 0, 0],
      handR: [0, 0, 0],
      weapon: [55, -41, 0],
      upperArmL: [10, 0, 16],
      forearmL: [-30, 0, 0],
    },
    follow: {
      spine: [12, 24, 0],
      chest: [6, 12, 0],
      head: [-12, -28, 0],
      upperArmR: [-50, 28, 0],
      forearmR: [-4, 0, 0],
      handR: [0, 0, 0],
      weapon: [72, -33, 0],
      upperArmL: [6, 0, 16],
      forearmL: [-30, 0, 0],
    },
  });
}

// 2: backhand horizontal cut, left → right.
function attack2() {
  return attack('attack2', 1, {
    windup: {
      spine: [4, 30, 0],
      chest: [2, 18, 0],
      head: [-8, -34, 0],
      upperArmR: [-21, 33, 2],
      forearmR: [-70, 0, 0],
      handR: [0, 0, 0],
      weapon: [26, 91, 0],
      upperArmL: [-20, 0, 8],
      forearmL: [-50, 0, 0],
    },
    mid: {
      spine: [6, 0, 0],
      chest: [3, 0, 0],
      head: [-8, 0, 0],
      upperArmR: [-46, 54, -27],
      forearmR: [-45, 0, 0],
      handR: [0, 0, 0],
      weapon: [55, -99, 0],
      upperArmL: [0, 0, 12],
      forearmL: [-40, 0, 0],
    },
    strike: {
      spine: [8, -32, 0],
      chest: [4, -18, 0],
      head: [-10, 34, 0],
      upperArmR: [-48, 0, 18],
      forearmR: [-50, 0, 0],
      handR: [0, 0, 0],
      weapon: [20, -77, 0],
      upperArmL: [20, 0, 18],
      forearmL: [-30, 0, 0],
    },
    follow: {
      spine: [8, -26, 0],
      chest: [4, -14, 0],
      head: [-10, 28, 0],
      upperArmR: [0, -31, 49],
      forearmR: [-82, 0, 0],
      handR: [0, 0, 0],
      weapon: [27, -46, 0],
      upperArmL: [16, 0, 16],
      forearmL: [-30, 0, 0],
    },
  });
}

// 3: heavy overhead cleave, claw arm raised with it, finishing low in front.
function attack3() {
  const open = { clawFinger_0: [-20, 0, 0], clawFinger_1: [-20, 0, 0], clawFinger_2: [20, 0, 0] };
  const closed = { clawFinger_0: [30, 0, 0], clawFinger_1: [30, 0, 0], clawFinger_2: [-30, 0, 0] };
  return attack('attack3', 2, {
    windup: {
      spine: [-10, -8, 0],
      chest: [-10, -4, 0],
      head: [2, 10, 0],
      upperArmR: [-125, -25, 35],
      forearmR: [-55, 0, 0],
      handR: [0, 0, 0],
      weapon: [36, -26, 0],
      upperArmL: [-111, -49, 0],
      forearmL: [-55, 0, 0],
      ...open,
    },
    mid: {
      spine: [10, 0, 0],
      chest: [4, 0, 0],
      head: [-10, 0, 0],
      upperArmR: [-91, 37, 0],
      forearmR: [-77, 0, 0],
      handR: [0, 0, 0],
      weapon: [60, -131, 0],
      upperArmL: [-84, -60, 17],
      forearmL: [-74, 0, 0],
      ...open,
    },
    strike: {
      spine: [30, 0, 0],
      chest: [14, 0, 0],
      head: [-26, 0, 0],
      upperArmR: [-66, -40, 60],
      forearmR: [-14, 0, 0],
      handR: [0, 0, 0],
      weapon: [69, -34, 0],
      upperArmL: [-60, 33, -55],
      forearmL: [0, 0, 0],
      ...closed,
    },
    follow: {
      spine: [26, 0, 0],
      chest: [12, 0, 0],
      head: [-22, 0, 0],
      upperArmR: [-73, -21, 40],
      forearmR: [0, 0, 0],
      handR: [0, 0, 0],
      weapon: [68, -41, 0],
      upperArmL: [-63, -25, 0],
      forearmL: [0, 0, 0],
      ...closed,
    },
  });
}

// Hurt: quick flinch back (overlay layer, full body).
function hurt() {
  const base = merge(STANCE, HERO_GUARD);
  const hit = merge(base, { spine: [-14, 6, 0], chest: [-10, 0, 0], head: [10, -10, 0], upperArmL: [-40, 0, 20], upperArmR: [0, 0, -24], 'pelvis@': [0, -0.05, -0.05] });
  return {
    name: 'hurt',
    duration: CONFIG.hero.anim.hurtDuration,
    loop: false,
    keys: [
      { t: 0, pose: base },
      { t: 0.18, ease: 'snap', pose: hit },
      { t: 1, ease: 'inOut', pose: base },
    ],
  };
}

// Death: stagger, drop to the knees on the sword, fall forward (base layer, holds last pose).
function death() {
  const start = merge(STANCE, HERO_GUARD);
  const stagger = merge(start, { spine: [-16, 10, 0], chest: [-8, 0, 0], head: [16, 0, 0], 'pelvis@': [0, -0.08, -0.08] });
  const kneel = {
    'pelvis@': [0, -0.62, 0.05],
    thighR: [-80, 0, -6],
    shinR: [150, 0, 0],
    footR: [20, 0, 0],
    thighL: [-10, 0, 8],
    shinL: [100, 0, 0],
    footL: [-10, 0, 0],
    spine: [30, 0, 0],
    chest: [16, 0, 0],
    head: [30, 0, 0],
    upperArmR: [-40, 0, -10],
    forearmR: [-30, 0, 0],
    weapon: [90, 0, 0],
    upperArmL: [-10, 0, 20],
    forearmL: [-20, 0, 0],
  };
  const down = merge(kneel, {
    'pelvis@': [0, -0.78, 0.3],
    thighR: [-60, 0, -6],
    shinR: [140, 0, 0],
    thighL: [-30, 0, 8],
    shinL: [120, 0, 0],
    spine: [70, 0, 0],
    chest: [20, 0, 0],
    head: [10, 0, 20],
    upperArmR: [-150, 0, -30],
    forearmR: [-10, 0, 0],
    weapon: [40, -30, 0],
    upperArmL: [-120, 0, 40],
  });
  return {
    name: 'death',
    duration: CONFIG.hero.anim.deathDuration,
    loop: false,
    keys: [
      { t: 0, pose: start },
      { t: 0.18, ease: 'snap', pose: stagger },
      { t: 0.5, ease: 'inOut', pose: kneel },
      { t: 1, ease: 'in', pose: down },
    ],
  };
}

export function heroClips() {
  return [idle(), run(), attack1(), attack2(), attack3(), hurt(), death()];
}

// Joints driven by the upper-body layer (attacks) — legs stay on the base layer.
export const HERO_UPPER_MASK = ['spine:0.7', 'chest', 'head', 'shoulderR', 'shoulderL', 'weapon'];
