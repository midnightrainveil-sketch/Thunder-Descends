import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG, ARENA_RADIUS } from '../config.js';

// Subtle segmented cyan ring on the ground under the mouse. Real-time animation (UI-like).
export class MouseReticle {
  constructor() {
    const C = CONFIG.reticle;
    const slot = (Math.PI * 2) / C.segments;
    const len = slot * (1 - C.gapFrac);
    const parts = [];
    for (let i = 0; i < C.segments; i++) {
      parts.push(new THREE.RingGeometry(C.radius - C.width, C.radius, 12, 1, i * slot, len));
    }
    const geo = mergeGeometries(parts);
    parts.forEach((g) => g.dispose());
    const color = new THREE.Color(C.color).multiplyScalar(C.intensity);
    this.material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: C.opacity,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = 'mouseReticle';
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = 2;
    this.visible = true;
  }

  update(realDt, input) {
    const C = CONFIG.reticle;
    // Only over the platform (slightly past the play circle).
    const p = input.groundPoint;
    const onFloor = input.groundValid && p.x * p.x + p.z * p.z < (ARENA_RADIUS + 1) ** 2;
    this.mesh.visible = this.visible && input.mouseInside && onFloor;
    if (!this.mesh.visible) return;
    this.mesh.position.set(p.x, C.height, p.z);
    this.mesh.rotation.z += C.spinSpeed * realDt;
  }
}
