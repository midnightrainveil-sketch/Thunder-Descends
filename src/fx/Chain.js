import * as THREE from 'three';
import { CONFIG } from '../config.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _d = new THREE.Vector3();
const _z = new THREE.Vector3(0, 0, 1);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Thunderclaw chain: block links (one InstancedMesh) laid along a sagging curve between two
 * points, alternating 90° around the chain axis like real links. Dark steel with a faint cyan
 * glow core so it reads against the floor. `set(a, b, sag)` each frame; `hide()` when retracted.
 */
export class Chain {
  constructor(scene) {
    const C = CONFIG.skills.thunderclaw;
    this.max = C.chainLinks;
    const [w, h, l] = C.linkSize;
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(w, h, l),
      new THREE.MeshStandardMaterial({ color: '#4a5060', roughness: 0.5, metalness: 0.6, emissive: new THREE.Color('#35e0ff'), emissiveIntensity: 0.85, flatShading: true }),
      this.max,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.name = 'fx:chain';
    scene.add(this.mesh);
    this.count = 0;
    this.points = []; // sample points along the chain (for lightning)
    for (let i = 0; i < 12; i++) this.points.push(new THREE.Vector3());
    this.hide();
  }

  // Point on the chain at u ∈ [0, 1] (quadratic sag, strongest at the middle).
  _at(a, b, sag, u, out) {
    out.lerpVectors(a, b, u);
    out.y -= sag * 4 * u * (1 - u);
    return out;
  }

  set(a, b, sagPerMeter = CONFIG.skills.thunderclaw.sag) {
    const C = CONFIG.skills.thunderclaw;
    const len = a.distanceTo(b);
    const sag = len * sagPerMeter;
    const n = Math.min(this.max, Math.floor(len / C.linkSpacing));
    for (let i = 0; i < this.max; i++) {
      if (i >= n) {
        if (i < this.count) this.mesh.setMatrixAt(i, ZERO);
        continue;
      }
      const u = (i + 0.5) / Math.max(n, 1);
      this._at(a, b, sag, u, _p);
      this._at(a, b, sag, Math.min(1, u + 0.01), _d).sub(_p).normalize();
      _q.setFromUnitVectors(_z, _d);
      if (i % 2) _q.multiply(_q2.setFromAxisAngle(_z, Math.PI / 2)); // alternate link orientation
      _m.compose(_p, _q, _s.set(1, 1, 1));
      this.mesh.setMatrixAt(i, _m);
    }
    this.count = n;
    for (let k = 0; k < this.points.length; k++) this._at(a, b, sag, k / (this.points.length - 1), this.points[k]);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = n > 0;
  }

  hide() {
    for (let i = 0; i < this.max; i++) this.mesh.setMatrixAt(i, ZERO);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = false;
    this.count = 0;
  }
}
