import { CONFIG } from '../../config.js';
import { mirrorPose, merge, pick, LEG_JOINTS } from './poseUtils.js';

// Enemy clips (spec §8): idle, walk, attackWindup, attackStrike, hurt, stunned for all types,
// plus aim/fire (Teppo) and block/slam (Tate). Same joint names as the hero. Telegraph and hit
// timings are events: 'telegraph' (eyes flare), 'hitStart'/'hitEnd', 'fire'.

const STANCE = {
  'pelvis@': [0, -0.02, 0],
  thighR: [-8, 0, -3],
  shinR: [14, 0, 0],
  footR: [-6, 0, 3],
  thighL: [-4, 0, 3],
  shinL: [10, 0, 0],
  footL: [-6, 0, -3],
  spine: [5, 0, 0],
  head: [-5, 0, 0],
};

// Weight shift onto the front leg during a strike.
const LUNGE = { 'pelvis@': [0, -0.06, 0.06], thighR: [-24, 0, -4], shinR: [30, 0, 0], footR: [-6, 0, 4], thighL: [14, 0, 4], shinL: [16, 0, 0], footL: [-10, 0, -4] };

// Per-type arm poses.
const ARMS = {
  ronin: {
    guard: { upperArmR: [-24, 0, -8], forearmR: [-44, 0, 0], weapon: [70, -20, 0], upperArmL: [-8, 0, 8], forearmL: [-20, 0, 0] },
    // Diagonal slash, high right → low left (arm/weapon angles solved offline for grip + blade direction).
    windup: { spine: [0, -30, 0], chest: [-6, -14, 0], head: [-4, 34, 0], upperArmR: [-49, 0, 25], forearmR: [-122, 0, 0], weapon: [48, -31, 0], upperArmL: [-40, 0, 20], forearmL: [-40, 0, 0] },
    mid: { spine: [8, 0, 0], chest: [3, 0, 0], head: [-6, 0, 0], upperArmR: [-17, 17, 18], forearmR: [-107, 0, 0], weapon: [82, -151, 0], upperArmL: [-10, 0, 16], forearmL: [-30, 0, 0] },
    strike: { spine: [16, 32, 0], chest: [8, 12, 0], head: [-12, -34, 0], upperArmR: [-45, 9, 0], forearmR: [-30, 0, 0], weapon: [71, -52, 0], upperArmL: [14, 0, 14], forearmL: [-20, 0, 0] },
  },
  teppo: {
    guard: { upperArmR: [-14, 0, -2], forearmR: [-52, 0, 0], weapon: [60, 28, 0], upperArmL: [-44, 0, -24], forearmL: [-46, 0, 0], handL: [0, 0, 0] },
    // Rifle-butt bash for close range.
    windup: { spine: [0, -24, 0], chest: [-6, -12, 0], upperArmR: [10, 0, -10], forearmR: [-70, 0, 0], weapon: [40, 40, 0], upperArmL: [-30, 0, -10], forearmL: [-60, 0, 0] },
    strike: { spine: [16, 24, 0], chest: [8, 10, 0], upperArmR: [-70, 0, 20], forearmR: [-40, 0, 0], weapon: [120, 20, 0], upperArmL: [-60, 0, -30], forearmL: [-30, 0, 0] },
    // Rifle shouldered, barrel level toward the target, scope up, left hand on the barrel clamp;
    // left shoulder turned forward (solved offline).
    aim: { spine: [4, -20, 0], chest: [0, -14, 0], head: [4, 30, 0], upperArmR: [-3, 18, 70], forearmR: [-90, 0, 0], weapon: [74, 156, 86], upperArmL: [-69, 44, -45], forearmL: [-11, 0, 0] },
  },
  tate: {
    // Hammer carried on the right shoulder (solved offline so the head clears the pauldron).
    guard: { upperArmR: [15, -12, -10], forearmR: [-130, 0, 0], weapon: [-36, -13, 0], upperArmL: [-16, 0, -6], forearmL: [-34, 0, 0] },
    windup: { spine: [-2, -30, 0], chest: [-4, -16, 0], upperArmR: [-120, 0, -50], forearmR: [-40, 0, 0], weapon: [10, 30, 0], upperArmL: [-30, 0, -10], forearmL: [-50, 0, 0] },
    strike: { spine: [14, 30, 0], chest: [6, 12, 0], upperArmR: [-70, 0, 40], forearmR: [-10, 0, 0], weapon: [50, 60, 0], upperArmL: [-10, 0, -6], forearmL: [-30, 0, 0] },
    block: { 'pelvis@': [0, -0.1, 0], thighR: [-22, 0, -6], shinR: [40, 0, 0], footR: [-18, 0, 6], thighL: [-30, 0, 6], shinL: [36, 0, 0], footL: [-6, 0, -6], spine: [14, 0, 0], head: [-10, 0, 0], upperArmL: [-52, 0, -26], forearmL: [-50, 0, 0], upperArmR: [15, -12, -10], forearmR: [-130, 0, 0], weapon: [-36, -13, 0] },
    slamWindup: { spine: [-12, 0, 0], chest: [-8, 0, 0], head: [6, 0, 0], upperArmR: [-176, 0, -6], forearmR: [-30, 0, 0], weapon: [-40, 0, 0], upperArmL: [-40, 0, -20], forearmL: [-40, 0, 0], 'pelvis@': [0, 0.02, 0] },
    // Impact: hammer head lands on the floor ~1.2 m in front (solved offline).
    slam: { spine: [34, 0, 0], chest: [12, 0, 0], head: [-26, 0, 0], upperArmR: [-68, -8, 28], forearmR: [-13, 0, 0], weapon: [59, -14, 0], upperArmL: [-20, 0, -10], forearmL: [-30, 0, 0], 'pelvis@': [0, -0.14, 0], thighR: [-30, 0, -4], shinR: [44, 0, 0], thighL: [-6, 0, 4], shinL: [30, 0, 0] },
    // Stunned: the hammer head rests on the floor instead of sinking through it.
    stunned: { weapon: [6, 0, 0] },
  },
};

function idle(t, A) {
  const a = merge(STANCE, A.guard);
  const b = merge(a, { spine: [6, 1, 0], chest: [1.5, 0, 0], head: [-6, 1, 0], 'pelvis@': [0, -0.028, 0] });
  return { name: 'idle', duration: 2.6, loop: true, keys: [{ t: 0, pose: a }, { t: 0.5, ease: 'inOut', pose: b }] };
}

function walk(t, A) {
  const contact = { 'pelvis@': [0, -0.035, 0], pelvis: [0, 5, 0], thighR: [-26, 0, 0], shinR: [8, 0, 0], footR: [12, 0, 0], thighL: [20, 0, 0], shinL: [24, 0, 0], footL: [8, 0, 0] };
  const pass = { 'pelvis@': [0, -0.008, 0], pelvis: [0, 0, 0], thighR: [0, 0, 0], shinR: [10, 0, 0], footR: [-8, 0, 0], thighL: [-20, 0, 0], shinL: [52, 0, 0], footL: [0, 0, 0] };
  const upper = (ph) => merge(A.guard, { spine: [8, 0, 0], chest: [0, ph * -5, 0], head: [-8, ph * 3, 0], upperArmL: [(A.guard.upperArmL?.[0] ?? 0) + ph * -10, A.guard.upperArmL?.[1] ?? 0, A.guard.upperArmL?.[2] ?? 0] });
  const legsB = mirrorPose(pick(contact, LEG_JOINTS));
  const legsD = mirrorPose(pick(pass, LEG_JOINTS));
  return {
    name: 'walk',
    duration: CONFIG.enemies.walkDuration,
    loop: true,
    keys: [
      { t: 0, pose: merge(contact, upper(1)) },
      { t: 0.25, pose: merge(pass, upper(0)) },
      { t: 0.5, pose: merge(legsB, { 'pelvis@': [0, -0.035, 0], pelvis: [0, -5, 0] }, upper(-1)) },
      { t: 0.75, pose: merge(legsD, { 'pelvis@': [0, -0.008, 0], pelvis: [0, 0, 0] }, upper(0)) },
    ],
  };
}

function attackWindup(t, A) {
  const E = CONFIG.enemies.anim;
  return {
    name: 'attackWindup',
    duration: E.windupDuration,
    loop: false,
    events: [{ t: 0, name: 'telegraph' }],
    keys: [
      { t: 0, pose: merge(STANCE, A.guard) },
      { t: 0.75, ease: 'out', pose: merge(STANCE, A.windup) },
      { t: 1, ease: 'inOut', pose: merge(STANCE, A.windup, { spine: [(A.windup.spine?.[0] ?? 0) - 2, (A.windup.spine?.[1] ?? 0) * 1.08, 0] }) },
    ],
  };
}

function attackStrike(t, A) {
  const E = CONFIG.enemies.anim;
  return {
    name: 'attackStrike',
    duration: E.strikeDuration,
    loop: false,
    events: [{ t: 0.08, name: 'hitStart' }, { t: 0.3, name: 'hitEnd' }],
    keys: [
      { t: 0, pose: merge(STANCE, A.windup) },
      ...(A.mid ? [{ t: 0.17, ease: 'in', pose: merge(STANCE, A.mid) }] : []),
      { t: 0.3, ease: A.mid ? 'out' : 'snap', pose: merge(STANCE, LUNGE, A.strike) },
      { t: 0.55, ease: 'out', pose: merge(STANCE, LUNGE, A.strike, { spine: [(A.strike.spine?.[0] ?? 0) - 4, (A.strike.spine?.[1] ?? 0) * 0.85, 0] }) },
      { t: 1, ease: 'inOut', pose: merge(STANCE, A.guard) },
    ],
  };
}

function hurt(t, A) {
  const base = merge(STANCE, A.guard);
  return {
    name: 'hurt',
    duration: CONFIG.enemies.anim.hurtDuration,
    loop: false,
    keys: [
      { t: 0, pose: base },
      { t: 0.2, ease: 'snap', pose: merge(base, { spine: [-16, 8, 0], chest: [-8, 0, 0], head: [14, -12, 0], 'pelvis@': [0, -0.04, -0.06] }) },
      { t: 1, ease: 'inOut', pose: base },
    ],
  };
}

function stunned(t, A) {
  const slack = merge(STANCE, A.guard, {
    'pelvis@': [0, -0.08, 0],
    thighR: [-16, 0, -4],
    shinR: [30, 0, 0],
    thighL: [-10, 0, 4],
    shinL: [24, 0, 0],
    spine: [20, 0, 0],
    chest: [10, 0, 0],
    head: [34, 0, 0],
    upperArmR: [4, 0, -6],
    forearmR: [-14, 0, 0],
    upperArmL: [6, 0, 6],
    forearmL: [-10, 0, 0],
  }, A.stunned || {});
  const swayA = merge(slack, { spine: [20, 6, 6], head: [34, 10, 10] });
  const swayB = merge(slack, { spine: [22, -6, -6], head: [36, -10, -10] });
  return {
    name: 'stunned',
    duration: CONFIG.enemies.anim.stunnedDuration,
    loop: true,
    keys: [{ t: 0, pose: swayA }, { t: 0.5, ease: 'inOut', pose: swayB }],
  };
}

function teppoExtra(A) {
  const E = CONFIG.enemies.anim;
  return [
    {
      name: 'aim',
      duration: E.aimDuration,
      loop: false,
      events: [{ t: 0, name: 'telegraph' }],
      keys: [
        { t: 0, pose: merge(STANCE, A.guard) },
        { t: 0.45, ease: 'out', pose: merge(STANCE, A.aim) },
        { t: 1, ease: 'smooth', pose: merge(STANCE, A.aim, { head: [5, 31, 0] }) },
      ],
    },
    {
      name: 'fire',
      duration: E.fireDuration,
      loop: false,
      events: [{ t: 0.02, name: 'fire' }],
      keys: [
        { t: 0, pose: merge(STANCE, A.aim) },
        { t: 0.15, ease: 'snap', pose: merge(STANCE, A.aim, { spine: [0, -20, 0], chest: [-8, -14, 0], head: [-2, 30, 0], 'pelvis@': [0, -0.02, -0.04] }) },
        { t: 1, ease: 'inOut', pose: merge(STANCE, A.aim) },
      ],
    },
  ];
}

function tateExtra(A) {
  const E = CONFIG.enemies.anim;
  const base = merge(STANCE, A.guard);
  return [
    {
      name: 'block',
      duration: E.blockDuration,
      loop: false,
      keys: [
        { t: 0, pose: base },
        { t: 1, ease: 'out', pose: A.block },
      ],
    },
    {
      name: 'slam',
      duration: E.slamDuration,
      loop: false,
      events: [{ t: 0, name: 'telegraph' }, { t: 0.72, name: 'hitStart' }, { t: 0.8, name: 'hitEnd' }],
      keys: [
        { t: 0, pose: base },
        { t: 0.6, ease: 'out', pose: merge(base, A.slamWindup) },
        { t: 0.69, ease: 'inOut', pose: merge(base, A.slamWindup, { upperArmR: [-180, 0, -6], spine: [-14, 0, 0] }) },
        { t: 0.78, ease: 'snap', pose: merge(base, A.slam) },
        { t: 1, ease: 'inOut', pose: merge(base, A.slam, { spine: [30, 0, 0] }) },
      ],
    },
  ];
}

export function enemyClips(type) {
  const A = ARMS[type];
  const clips = [idle(type, A), walk(type, A), attackWindup(type, A), attackStrike(type, A), hurt(type, A), stunned(type, A)];
  if (type === 'teppo') clips.push(...teppoExtra(A));
  if (type === 'tate') {
    clips.push(...tateExtra(A));
    for (const c of clips) for (const k of c.keys) braceShield(k.pose);
  }
  return clips;
}

// Tate's tower shield hangs off the left forearm; counter-rotate it by part of the arm's pitch so
// it stays near vertical in front of the body instead of tipping flat when the arm rises.
function braceShield(pose) {
  if (!pose.upperArmL && !pose.forearmL) return;
  const pitch = (pose.upperArmL?.[0] ?? 0) + (pose.forearmL?.[0] ?? 0);
  pose.shield = [-pitch * CONFIG.enemies.anim.shieldBrace, 0, 0];
}

// Enemies play actions full-body on the base layer (they plant their feet to attack); hurt plays on
// a full-body overlay layer so it can interrupt anything.
