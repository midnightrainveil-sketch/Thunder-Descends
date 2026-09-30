import { merge } from './poseUtils.js';

// Boss clips (Stage 5). Boss logic drives attack timing with its own timers, so clips are simple
// pose sequences (tells): weighty for the Juggernaut, snappy for the Kitsune. Same joint names and
// axis conventions as the hero (see poseUtils.js).

const clip = (name, duration, keys, loop = false) => ({ name, duration, loop, keys });

function juggernaut() {
  const stance = { 'pelvis@': [0, -0.08, 0], thighR: [-10, 4, -6], shinR: [18, 0, 0], footR: [-8, 0, 6], thighL: [-6, -4, 6], shinL: [14, 0, 0], footL: [-8, 0, -6], spine: [8, 0, 0], chest: [4, 0, 0], head: [-10, 0, 0] };
  // Club dragged low in front (head on the floor), left fist balled.
  const guard = { upperArmR: [-14, 0, -16], forearmR: [-36, 0, 0], weapon: [38, 0, 0], upperArmL: [-8, 0, 14], forearmL: [-30, 0, 0] };
  const idleA = merge(stance, guard);
  const idleB = merge(idleA, { spine: [10, 0, 0], chest: [6, 0, 0], 'pelvis@': [0, -0.1, 0] });
  const contact = { 'pelvis@': [0, -0.14, 0], pelvis: [0, 6, 0], thighR: [-26, 0, -4], shinR: [12, 0, 0], footR: [12, 0, 0], thighL: [18, 0, 4], shinL: [30, 0, 0], footL: [8, 0, 0] };
  const pass = { 'pelvis@': [0, -0.06, 0], pelvis: [0, 0, 0], thighR: [0, 0, -4], shinR: [10, 0, 0], footR: [-8, 0, 0], thighL: [-20, 0, 4], shinL: [56, 0, 0], footL: [0, 0, 0] };
  const mirror = (p) => ({ ...p, pelvis: [0, -p.pelvis[1], 0], thighR: p.thighL, shinR: p.shinL, footR: p.footL, thighL: p.thighR, shinL: p.shinR, footL: p.footR });
  const up = merge(stance, { spine: [-10, 0, 0], chest: [-8, 0, 0], head: [4, 0, 0], upperArmR: [-172, 0, -8], forearmR: [-30, 0, 0], weapon: [-45, 0, 0], upperArmL: [-150, 0, 10], forearmL: [-40, 0, 0] });
  const down = merge(stance, { 'pelvis@': [0, -0.35, 0.1], thighR: [-34, 0, -6], shinR: [50, 0, 0], thighL: [-12, 0, 6], shinL: [36, 0, 0], spine: [34, 0, 0], chest: [14, 0, 0], head: [-24, 0, 0], upperArmR: [-62, 0, 8], forearmR: [-8, 0, 0], weapon: [44, 0, 0], upperArmL: [-58, 0, -8], forearmL: [-12, 0, 0] });
  const charge = merge({ 'pelvis@': [0, -0.2, 0], thighR: [-40, 0, -6], shinR: [30, 0, 0], thighL: [20, 0, 6], shinL: [50, 0, 0] }, { spine: [30, 0, 0], chest: [14, 0, 0], head: [-26, 0, 0], upperArmR: [20, 0, -20], forearmR: [-30, 0, 0], weapon: [100, 0, 0], upperArmL: [-60, 0, 10], forearmL: [-60, 0, 0] });
  const chargeB = merge(charge, mirror({ pelvis: [0, 5, 0], thighR: charge.thighR, shinR: charge.shinR, footR: [0, 0, 0], thighL: charge.thighL, shinL: charge.shinL, footL: [0, 0, 0] }));
  const stomp = merge(stance, { 'pelvis@': [0, 0.05, 0], thighR: [-80, 0, -8], shinR: [70, 0, 0], footR: [0, 0, 0], spine: [-6, 0, 0], upperArmR: [-40, 0, -30], forearmR: [-60, 0, 0], upperArmL: [-40, 0, 30], forearmL: [-60, 0, 0] });
  const stompDown = merge(stance, { 'pelvis@': [0, -0.3, 0], thighR: [-22, 0, -10], shinR: [36, 0, 0], thighL: [-14, 0, 10], shinL: [30, 0, 0], spine: [22, 0, 0], chest: [10, 0, 0], upperArmR: [-30, 0, -40], upperArmL: [-30, 0, 40] });
  const slump = merge(stance, { 'pelvis@': [0, -0.4, 0], spine: [34, 6, 6], chest: [14, 0, 0], head: [36, 10, 10], upperArmR: [6, 0, -10], forearmR: [-10, 0, 0], weapon: [20, 0, 0], upperArmL: [6, 0, 10], forearmL: [-10, 0, 0], thighR: [-30, 0, -6], shinR: [50, 0, 0], thighL: [-20, 0, 6], shinL: [40, 0, 0] });
  return [
    clip('idle', 2.8, [{ t: 0, pose: idleA }, { t: 0.5, ease: 'inOut', pose: idleB }], true),
    clip('walk', 1.3, [
      { t: 0, pose: merge(idleA, contact) },
      { t: 0.25, pose: merge(idleA, pass) },
      { t: 0.5, pose: merge(idleA, mirror(contact)) },
      { t: 0.75, pose: merge(idleA, mirror(pass)) },
    ], true),
    clip('slamUp', 0.35, [{ t: 0, pose: idleA }, { t: 1, ease: 'out', pose: up }]),
    clip('slamDown', 0.2, [{ t: 0, pose: up }, { t: 1, ease: 'snap', pose: down }]),
    clip('chargeWindup', 0.9, [{ t: 0, pose: idleA }, { t: 0.5, ease: 'out', pose: merge(charge, { 'pelvis@': [0, -0.35, -0.2] }) }, { t: 1, ease: 'inOut', pose: merge(charge, { 'pelvis@': [0, -0.4, -0.25], spine: [36, 0, 0] }) }]),
    clip('charge', 0.5, [{ t: 0, pose: charge }, { t: 0.5, ease: 'smooth', pose: chargeB }], true),
    clip('stompUp', 0.8, [{ t: 0, pose: idleA }, { t: 0.8, ease: 'out', pose: stomp }, { t: 1, pose: stomp }]),
    clip('stompDown', 0.15, [{ t: 0, pose: stomp }, { t: 1, ease: 'snap', pose: stompDown }]),
    clip('stunned', 1.4, [{ t: 0, pose: slump }, { t: 0.5, ease: 'inOut', pose: merge(slump, { spine: [36, -6, -6], head: [38, -10, -10] }) }], true),
  ];
}

function kitsune() {
  const stance = { 'pelvis@': [0, -0.05, 0], thighR: [-20, 8, -8], shinR: [30, 0, 0], footR: [-10, -8, 8], thighL: [-4, -8, 8], shinL: [22, 0, 0], footL: [-14, 8, -8], spine: [10, 0, 0], chest: [4, 0, 0], head: [-10, 0, 0] };
  // Twin blades held low and back (reverse-grip look), arms loose.
  const guard = { upperArmR: [-10, 0, -20], forearmR: [-40, 0, 0], weapon: [120, 0, 0], upperArmL: [-10, 0, 20], forearmL: [-40, 0, 0], weaponL: [120, 0, 0] };
  const idleA = merge(stance, guard);
  const idleB = merge(idleA, { spine: [12, 3, 0], head: [-12, -4, 0], 'pelvis@': [0, -0.07, 0] });
  const run = { 'pelvis@': [0, -0.1, 0], spine: [30, 0, 0], chest: [8, 0, 0], head: [-30, 0, 0], upperArmR: [50, 0, -20], forearmR: [-20, 0, 0], weapon: [150, 0, 0], upperArmL: [50, 0, 20], forearmL: [-20, 0, 0], weaponL: [150, 0, 0] };
  const runA = merge(run, { thighR: [-50, 0, 0], shinR: [20, 0, 0], thighL: [30, 0, 0], shinL: [70, 0, 0] });
  const runB = merge(run, { thighR: [30, 0, 0], shinR: [70, 0, 0], thighL: [-50, 0, 0], shinL: [20, 0, 0] });
  const cross = merge(stance, { spine: [-4, 0, 0], upperArmR: [-150, 0, 30], forearmR: [-30, 0, 0], weapon: [-20, 30, 0], upperArmL: [-150, 0, -30], forearmL: [-30, 0, 0], weaponL: [-20, -30, 0] });
  const slash = merge(stance, { 'pelvis@': [0, -0.2, 0.1], thighR: [-40, 0, -8], shinR: [50, 0, 0], spine: [26, 0, 0], chest: [10, 0, 0], head: [-22, 0, 0], upperArmR: [-60, 0, -70], forearmR: [0, 0, 0], weapon: [80, -40, 0], upperArmL: [-60, 0, 70], forearmL: [0, 0, 0], weaponL: [80, 40, 0] });
  const dash = merge(runA, { spine: [40, 0, 0], upperArmR: [-70, 0, -40], forearmR: [0, 0, 0], weapon: [90, -60, 0], upperArmL: [60, 0, 30], weaponL: [150, 0, 0] });
  const fan = merge(stance, { spine: [-14, 0, 0], chest: [-8, 0, 0], head: [6, 0, 0], upperArmR: [-40, 0, -60], forearmR: [-20, 0, 0], upperArmL: [-40, 0, 60], forearmL: [-20, 0, 0] });
  const slump = merge(stance, { spine: [30, 0, 8], head: [30, 0, 10], upperArmR: [0, 0, -10], upperArmL: [0, 0, 10], 'pelvis@': [0, -0.15, 0] });
  return [
    clip('idle', 2.2, [{ t: 0, pose: idleA }, { t: 0.5, ease: 'inOut', pose: idleB }], true),
    clip('walk', 0.55, [{ t: 0, pose: runA }, { t: 0.5, ease: 'smooth', pose: runB }], true),
    clip('crossUp', 0.3, [{ t: 0, pose: idleA }, { t: 1, ease: 'out', pose: cross }]),
    clip('slash', 0.3, [{ t: 0, pose: cross }, { t: 0.3, ease: 'snap', pose: slash }, { t: 1, ease: 'inOut', pose: merge(slash, { spine: [18, 0, 0] }) }]),
    clip('dash', 0.2, [{ t: 0, pose: dash }, { t: 1, pose: dash }], true),
    clip('fanUp', 0.4, [{ t: 0, pose: idleA }, { t: 1, ease: 'out', pose: fan }]),
    clip('stunned', 1.2, [{ t: 0, pose: slump }, { t: 0.5, ease: 'inOut', pose: merge(slump, { spine: [32, 0, -8], head: [32, 0, -10] }) }], true),
  ];
}

function raiju() {
  return [
    clip('idle', 1, [{ t: 0, pose: { jaw: [0, 0, 0] } }, { t: 0.5, ease: 'inOut', pose: { jaw: [8, 0, 0] } }], true),
    clip('walk', 1, [{ t: 0, pose: { jaw: [0, 0, 0] } }], true),
    clip('stunned', 1, [{ t: 0, pose: { jaw: [20, 0, 0] } }], true),
  ];
}

export function bossClips(type) {
  return { juggernaut, kitsune, raiju }[type]();
}
