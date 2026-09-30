// Pose helpers for clip authoring.
// Rotations are [rx, ry, rz] in degrees, local to each joint, relative to the rest pose (YXZ order).
// Rest pose: standing straight, arms hanging, weapon pointing forward (+Z). Axis conventions:
//   +X on a limb hanging down swings it BACK (−X swings it forward / raises it in front).
//   +X on the spine/chest leans forward; +X on the head nods down; +X on a shin bends the knee.
//   +Y turns toward the character's LEFT (+X side).
//   +Z on the right arm moves the hand inward (toward +X); on the left arm it moves the hand outward.

// Mirror a pose left↔right: swap R/L joint names, negate Y and Z rotations (and X offsets).
export function mirrorPose(pose) {
  const out = {};
  for (const k in pose) {
    const v = pose[k];
    let name = k;
    if (/R(@?)$/.test(k)) name = k.replace(/R(@?)$/, 'L$1');
    else if (/L(@?)$/.test(k)) name = k.replace(/L(@?)$/, 'R$1');
    out[name] = k.endsWith('@') ? [-v[0], v[1], v[2]] : [v[0], -v[1], -v[2]];
  }
  return out;
}

// Merge poses left → right (later wins).
export const merge = (...poses) => Object.assign({}, ...poses);

// Pick only the joints listed (e.g. legs from a full pose).
export function pick(pose, names) {
  const out = {};
  for (const k in pose) if (names.some((n) => k === n || k === `${n}@`)) out[k] = pose[k];
  return out;
}

export const LEG_JOINTS = ['thighR', 'shinR', 'footR', 'thighL', 'shinL', 'footL'];
