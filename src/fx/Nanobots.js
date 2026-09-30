import * as THREE from 'three';
import { CONFIG } from '../config.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Vector3();
const _p = new THREE.Vector3();
const _axis = new THREE.Vector3(0.4, 1, 0.3).normalize();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Demontime nanobots: tiny cyan emissive cubes that stream along curved (quadratic Bézier) paths
 * from a start point to a moving target — a point in a bone's local space, re-evaluated every
 * frame so they land on the blade even while it moves. Hero clock (they fly while the world is
 * frozen). One InstancedMesh.
 */
export class Nanobots {
  constructor(scene, postFX) {
    const D = CONFIG.skills.demontime;
    this.max = D.nanobots;
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#7ff0ff').multiplyScalar(2.6), toneMapped: false, fog: false }),
      this.max,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'fx:nanobots';
    this.mesh.renderOrder = 6;
    scene.add(this.mesh);
    postFX?.addToMask(this.mesh);
    this.b = Array.from({ length: this.max }, () => ({ alive: false, p0: new THREE.Vector3(), p1: new THREE.Vector3(), local: new THREE.Vector3(), bone: null, t: 0, d: 0.4, size: 0.04, spin: 0 }));
    for (let i = 0; i < this.max; i++) this.mesh.setMatrixAt(i, ZERO);
    this.next = 0;
    this.live = 0;
    this.onArrive = null; // (worldPos) => void
  }

  // from: world start; bone + local: target; bulge: control point offset (world).
  emit(from, bone, local, bulge, duration) {
    const n = this.b[this.next];
    this.next = (this.next + 1) % this.max;
    if (!n.alive) this.live++;
    n.alive = true;
    n.p0.copy(from);
    n.p1.copy(from).add(bulge);
    n.bone = bone;
    n.local.copy(local);
    n.t = 0;
    n.d = duration;
    n.size = 0.03 + Math.random() * 0.03;
    n.spin = Math.random() * 6;
  }

  update(dt) {
    if (this.live === 0 || dt <= 0) return;
    for (let i = 0; i < this.max; i++) {
      const n = this.b[i];
      if (!n.alive) continue;
      n.t += dt;
      const u = Math.min(1, n.t / n.d);
      n.bone.localToWorld(_e.copy(n.local));
      // Quadratic Bézier p0 → p1 → end, accelerating into the blade.
      const k = u * u * (3 - 2 * u);
      const a = (1 - k) * (1 - k);
      const b = 2 * (1 - k) * k;
      const c = k * k;
      _p.set(n.p0.x * a + n.p1.x * b + _e.x * c, n.p0.y * a + n.p1.y * b + _e.y * c, n.p0.z * a + n.p1.z * b + _e.z * c);
      if (u >= 1) {
        n.alive = false;
        this.live--;
        this.mesh.setMatrixAt(i, ZERO);
        this.onArrive?.(_p);
        continue;
      }
      _m.compose(_p, _q.setFromAxisAngle(_axis, n.spin + n.t * 12), _s.setScalar(n.size * (1 - 0.4 * u)));
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    for (let i = 0; i < this.max; i++) {
      this.b[i].alive = false;
      this.mesh.setMatrixAt(i, ZERO);
    }
    this.live = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
