import * as THREE from 'three';
import { ARENA_RADIUS, CONFIG } from '../config.js';

// Arena bounds helpers (spec §2). The play area is a true circle of ARENA_RADIUS on XZ.
// These stay when the placeholder arena is replaced in Stage 1.

// Clamp pos (Vector3, XZ used) in place so a body of `radius` stays inside. Returns true if clamped.
export function clampToArena(pos, radius = 0) {
  const max = Math.max(ARENA_RADIUS - radius, 0);
  const d2 = pos.x * pos.x + pos.z * pos.z;
  if (d2 <= max * max) return false;
  const k = max / Math.sqrt(d2);
  pos.x *= k;
  pos.z *= k;
  return true;
}

// True if a body of `radius` at pos is fully inside the play circle.
export function isInsideArena(pos, radius = 0) {
  const max = ARENA_RADIUS - radius;
  return max > 0 && pos.x * pos.x + pos.z * pos.z <= max * max;
}

// Random point just inside the rim, at least minDist from minDistFrom (Vector3 or null).
// Falls back to the farthest candidate if no attempt satisfies the distance.
export function randomRimPoint(minDistFrom = null, minDist = 0, out = new THREE.Vector3(), rng = Math.random) {
  const A = CONFIG.arena;
  const r = ARENA_RADIUS - A.rimInset;
  let bestD2 = -1;
  let bx = 0;
  let bz = r;
  for (let i = 0; i < A.rimTries; i++) {
    const a = rng() * Math.PI * 2;
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    if (!minDistFrom) return out.set(x, 0, z);
    const dx = x - minDistFrom.x;
    const dz = z - minDistFrom.z;
    const d2 = dx * dx + dz * dz;
    if (d2 >= minDist * minDist) return out.set(x, 0, z);
    if (d2 > bestD2) {
      bestD2 = d2;
      bx = x;
      bz = z;
    }
  }
  return out.set(bx, 0, bz);
}
