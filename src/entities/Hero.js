import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clampToArena } from '../world/ArenaBounds.js';
import { buildPlaceholderHero } from '../voxel/models/PlaceholderHero.js';

const DEG = Math.PI / 180;

// Stage 0 hero: placeholder model + screen-relative WASD movement with smooth
// acceleration, smooth turning toward the mouse ground point, arena clamping.
// Runs on the hero clock.
export class Hero {
  constructor() {
    const H = CONFIG.hero;
    this.group = new THREE.Group();
    this.group.name = 'hero';
    this.lean = new THREE.Group(); // lean pivot at the feet
    this.group.add(this.lean);

    this.model = buildPlaceholderHero();
    this.lean.add(this.model.root);

    this.position = this.group.position;
    this.position.set(H.spawn.x, 0, H.spawn.z);
    this.velocity = new THREE.Vector3();
    this.yaw = Math.PI; // start facing the back of the arena (away from camera)
    this.group.rotation.y = this.yaw;
    this.aim = new THREE.Vector3(0, 0, -1);
    this._leanAmount = 0;

    this._wish = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
  }

  // dt = hero clock delta.
  update(dt, input, rig) {
    if (dt <= 0) return;
    const H = CONFIG.hero;

    // Screen-relative input: W = away from camera.
    let ix = 0;
    let iz = 0;
    if (input.isDown('KeyW')) iz += 1;
    if (input.isDown('KeyS')) iz -= 1;
    if (input.isDown('KeyD')) ix += 1;
    if (input.isDown('KeyA')) ix -= 1;
    const wish = this._wish.set(0, 0, 0);
    if (ix !== 0 || iz !== 0) {
      wish.addScaledVector(rig.groundForward, iz).addScaledVector(rig.groundRight, ix).normalize();
      wish.multiplyScalar(H.moveSpeed);
    }

    // Accelerate toward the wished velocity; decelerate harder when there is no input.
    const rate = wish.lengthSq() > 0 ? H.accel : H.decel;
    const dv = this._tmp.subVectors(wish, this.velocity);
    const maxStep = rate * dt;
    const len = dv.length();
    if (len > maxStep) dv.multiplyScalar(maxStep / len);
    this.velocity.add(dv);

    this.position.addScaledVector(this.velocity, dt);
    if (clampToArena(this.position, H.radius)) {
      // Remove the outward velocity component so we slide along the rim.
      const nx = this.position.x;
      const nz = this.position.z;
      const nl = Math.hypot(nx, nz) || 1;
      const out = (this.velocity.x * nx + this.velocity.z * nz) / nl;
      if (out > 0) {
        this.velocity.x -= (out * nx) / nl;
        this.velocity.z -= (out * nz) / nl;
      }
    }

    // Face the mouse ground point.
    if (input.groundValid) {
      const dx = input.groundPoint.x - this.position.x;
      const dz = input.groundPoint.z - this.position.z;
      if (dx * dx + dz * dz > 0.01) {
        const target = Math.atan2(dx, dz);
        let diff = target - this.yaw;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.yaw += diff * (1 - Math.exp(-H.turnRate * dt));
        this.aim.set(dx, 0, dz).normalize();
      }
    }
    this.group.rotation.y = this.yaw;

    // Subtle lean into the movement direction (placeholder until the Stage 2 animation system).
    const speed = this.velocity.length();
    const fwd = speed > 1e-3 ? (this.velocity.x * Math.sin(this.yaw) + this.velocity.z * Math.cos(this.yaw)) / H.moveSpeed : 0;
    this._leanAmount += (fwd - this._leanAmount) * (1 - Math.exp(-H.leanRate * dt));
    this.lean.rotation.x = this._leanAmount * H.leanDeg * DEG;
  }
}
