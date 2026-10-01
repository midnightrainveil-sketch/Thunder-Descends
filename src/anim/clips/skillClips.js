import { CONFIG } from '../../config.js';
import { merge } from './poseUtils.js';
import { HERO_GUARD } from './heroClips.js';

// Hero skill clips (Stage 4). Arm / weapon angles were solved offline against the rig like the
// attacks (grip position + blade direction, plus the claw hand for two-handed poses).
// Full-body clips play on the base layer (the skill owns the base while it runs); claw poses play
// on the upper layer so the legs keep their locomotion.

const STANCE_LEGS = {
  'pelvis@': [0, -0.04, 0],
  thighR: [-12, 4, -5],
  shinR: [22, 0, 0],
  footR: [-8, -4, 5],
  thighL: [-4, -6, 5],
  shinL: [14, 0, 0],
  footL: [-8, 6, -5],
};
const LUNGE_LEGS = {
  'pelvis@': [0, -0.16, 0.12],
  thighR: [18, 0, -6],
  shinR: [30, 0, 0],
  footR: [-20, 0, 6],
  thighL: [-52, 0, 6],
  shinL: [58, 0, 0],
  footL: [-6, 0, -6],
};
const WIDE_LEGS = {
  'pelvis@': [0, -0.12, 0],
  thighR: [-22, 10, -14],
  shinR: [38, 0, 0],
  footR: [-12, -10, 14],
  thighL: [-18, -10, 14],
  shinL: [34, 0, 0],
  footL: [-12, 10, -14],
};
// Right knee down, left foot forward.
const KNEEL_LEGS = {
  'pelvis@': [0, -0.58, 0.02],
  thighR: [-6, 0, -4],
  shinR: [96, 0, 0],
  footR: [-52, 0, 0],
  thighL: [-78, 0, 6],
  shinL: [80, 0, 0],
  footL: [-4, 0, -6],
};
const TWO_HAND_FINGERS = { clawFinger_0: [34, 0, 0], clawFinger_1: [34, 0, 0], clawFinger_2: [-34, 0, 0] };

// Built lazily: heroClips.js ↔ skillClips.js import each other (HERO_GUARD).
const makePoses = () => ({
  guard: merge(STANCE_LEGS, HERO_GUARD, { spine: [6, 0, 0], chest: [3, 0, 0], head: [-8, 0, 0] }),
  clawThrow: { spine: [6, -12, 0], chest: [2, -12, 0], head: [-6, 22, 0], upperArmL: [-86, 4, 4], forearmL: [-4, 0, 0], upperArmR: [4, 0, -14], forearmR: [-30, 0, 0], handR: [0, 0, 8], weapon: [70, -30, 0], clawFinger_0: [-40, 0, 0], clawFinger_1: [-40, 0, 0], clawFinger_2: [40, 0, 0] },
  dash: merge(LUNGE_LEGS, { spine: [30, 0, 0], chest: [12, 0, 0], head: [-30, 0, 0], upperArmR: [30, 0, -18], forearmR: [-24, 0, 0], handR: [0, 0, 6], weapon: [110, -20, 0], upperArmL: [36, 0, 16], forearmL: [-30, 0, 0] }),
  clawDash: { 'pelvis@': [0, -0.1, 0], spine: [26, -8, 0], chest: [10, -8, 0], head: [-26, 14, 0], thighR: [34, 0, -4], shinR: [70, 0, 0], thighL: [-46, 0, 4], shinL: [40, 0, 0], upperArmL: [-96, 0, 4], forearmL: [0, 0, 0], upperArmR: [30, 0, -18], forearmR: [-24, 0, 0], weapon: [110, -20, 0] },
  shatterWindup: merge(STANCE_LEGS, { spine: [4, -25, 0], chest: [0, -15, 0], head: [-6, 34, 0], upperArmR: [54, -7, -42], forearmR: [-134, 0, 0], handR: [0, 0, 0], weapon: [62, 24, 0], upperArmL: [-40, 0, 26], forearmL: [-30, 0, 0] }),
  shatterThrust: merge(LUNGE_LEGS, { spine: [12, 22, 0], chest: [6, 12, 0], head: [-14, -30, 0], upperArmR: [-68, -44, 28], forearmR: [-30, 0, 0], handR: [0, 0, 0], weapon: [106, 121, 0], upperArmL: [30, 0, 30], forearmL: [-20, 0, 0] }),
  odA: merge(WIDE_LEGS, TWO_HAND_FINGERS, { spine: [10, 26, 0], chest: [6, 14, 0], head: [-12, -34, 0], upperArmR: [-59, -2, 5], forearmR: [-16, 0, 0], handR: [0, 0, 0], weapon: [70, 7, 0], upperArmL: [-66, -52, 0], forearmL: [0, 0, 0] }),
  odB: merge(WIDE_LEGS, TWO_HAND_FINGERS, { spine: [8, -26, 0], chest: [4, -14, 0], head: [-10, 34, 0], upperArmR: [-66, -18, 41], forearmR: [-7, 0, 0], handR: [0, 0, 0], weapon: [51, -41, 0], upperArmL: [-66, -34, 0], forearmL: [-5, 0, 0] }),
  plant: merge(KNEEL_LEGS, TWO_HAND_FINGERS, { spine: [12, 0, 0], chest: [4, 0, 0], head: [6, 0, 0], upperArmR: [-51, -1, 49], forearmR: [-93, 0, 0], handR: [0, 0, 0], weapon: [28, -134, 0], upperArmL: [-75, -50, -1], forearmL: [-74, 0, 0] }),
  rise: merge(STANCE_LEGS, { spine: [-6, 0, 0], chest: [-4, 0, 0], head: [-14, 0, 0], upperArmR: [-97, -60, 66], forearmR: [-72, 0, 0], handR: [0, 0, 0], weapon: [105, 35, 0], upperArmL: [-20, 0, 40], forearmL: [-40, 0, 0] }),
});

export function skillClips() {
  const POSES = makePoses();
  const S = CONFIG.skills;
  const Sh = S.shatter;
  const D = S.demontime;
  const clip = (name, duration, keys, loop = false) => ({ name, duration, loop, keys });
  return [
    clip('clawThrow', 0.14, [{ t: 0, pose: POSES.guard }, { t: 1, ease: 'snap', pose: POSES.clawThrow }]),
    clip('dash', 0.07, [{ t: 0, pose: POSES.guard }, { t: 1, ease: 'out', pose: POSES.dash }]),
    clip('clawDash', 0.12, [{ t: 0, pose: merge(POSES.guard, POSES.clawThrow) }, { t: 1, ease: 'out', pose: POSES.clawDash }]),
    clip('shatterWindup', Sh.windup, [{ t: 0, pose: POSES.guard }, { t: 1, ease: 'out', pose: POSES.shatterWindup }]),
    clip('shatterThrust', Sh.thrust, [
      { t: 0, pose: POSES.shatterWindup },
      { t: 0.22, ease: 'snap', pose: POSES.shatterThrust },
      { t: 0.7, ease: 'linear', pose: merge(POSES.shatterThrust, { spine: [14, 24, 0] }) },
      { t: 1, ease: 'inOut', pose: POSES.guard },
    ]),
    // Overdrive: alternating two-handed cuts every slash (0.08 s → 0.16 s loop).
    clip('overdrive', 2 * Sh.slashEvery, [{ t: 0, pose: POSES.odA }, { t: 0.5, ease: 'snap', pose: POSES.odB }], true),
    clip('overdriveFinal', 0.3, [
      { t: 0, pose: POSES.odB },
      { t: 0.25, ease: 'out', pose: merge(POSES.odB, { spine: [2, -40, 0], chest: [0, -22, 0] }) },
      { t: 0.55, ease: 'snap', pose: merge(POSES.odA, { spine: [16, 40, 0], chest: [8, 20, 0] }) },
      { t: 1, ease: 'inOut', pose: POSES.guard },
    ]),
    clip('demonKneel', D.freezeAt, [{ t: 0, pose: POSES.guard }, { t: 0.7, ease: 'snap', pose: POSES.plant }, { t: 1, ease: 'out', pose: merge(POSES.plant, { spine: [14, 0, 0] }) }]),
    clip('demonRise', D.cast - D.restoreAt, [{ t: 0, pose: POSES.plant }, { t: 0.6, ease: 'snap', pose: POSES.rise }, { t: 1, ease: 'out', pose: POSES.rise }]),
  ];
}
