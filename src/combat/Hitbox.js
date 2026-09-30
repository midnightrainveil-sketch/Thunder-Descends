// 2D hitboxes on the floor plane (XZ). Targets are circles { position, radius }.
// Angles are yaws: atan2(x, z) (0 = +Z, +π/2 = +X).

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function yawOf(dx, dz) {
  return Math.atan2(dx, dz);
}

// Circle (center x/z, radius) vs target circle.
export function hitCircle(cx, cz, radius, target) {
  const dx = target.position.x - cx;
  const dz = target.position.z - cz;
  const r = radius + target.radius;
  return dx * dx + dz * dz <= r * r;
}

// Sector: origin, facing yaw, reach, full arc (radians). The target counts if any part of its
// circle is inside (angular slack from its radius).
export function hitSector(ox, oz, yaw, reach, arc, target) {
  const dx = target.position.x - ox;
  const dz = target.position.z - oz;
  const d = Math.hypot(dx, dz);
  if (d > reach + target.radius) return false;
  if (d <= target.radius) return true;
  const slack = Math.asin(Math.min(1, target.radius / d));
  return Math.abs(wrap(yawOf(dx, dz) - yaw)) <= arc / 2 + slack;
}

// Oriented rectangle starting at origin, extending `length` along yaw, `width` across.
export function hitRect(ox, oz, yaw, length, width, target) {
  const dx = target.position.x - ox;
  const dz = target.position.z - oz;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const along = dx * fx + dz * fz;
  const side = dx * fz - dz * fx;
  const r = target.radius;
  return along >= -r && along <= length + r && Math.abs(side) <= width / 2 + r;
}

// Signed angle of a target relative to a facing yaw (radians, + = toward +X side of the facing).
export function relativeYaw(ox, oz, yaw, target) {
  return wrap(yawOf(target.position.x - ox, target.position.z - oz) - yaw);
}

// One attack instance: remembers who it already hit so each target is hit once.
export class AttackInstance {
  constructor() {
    this.hit = new Set();
    this.active = false;
  }

  reset() {
    this.hit.clear();
    this.active = true;
  }

  once(target) {
    if (this.hit.has(target)) return false;
    this.hit.add(target);
    return true;
  }
}

export { wrap as wrapAngle };
