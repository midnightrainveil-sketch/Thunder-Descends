import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Persistent floor rings for skill aiming (real time): a dashed range ring around the hero and a
// target circle with a soft fill and crosshair ticks. Additive, above the gameplay decals.
const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime, uDashes, uFill, uAlpha, uLine;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float d = length(p);
    if (d > 1.0) discard;
    float ring = smoothstep(1.0 - uLine, 1.0 - uLine * 0.4, d) * smoothstep(1.0, 1.0 - uLine * 0.3, d);
    float ang = atan(p.y, p.x);
    float dash = uDashes > 0.0 ? step(0.35, fract(ang / 6.28318 * uDashes + uTime * 0.25)) : 1.0;
    float fill = uFill * (0.25 + 0.75 * d * d) * (0.8 + 0.2 * sin(uTime * 8.0));
    float cross = uFill > 0.0 ? (step(abs(p.x), 0.012) + step(abs(p.y), 0.012)) * step(0.55, d) * step(d, 0.8) : 0.0;
    float a = (ring * dash + fill + cross * 0.8) * uAlpha;
    gl_FragColor = vec4(uColor * a * 1.8, a);
  }
`;

export class AimRings {
  constructor(scene, postFX) {
    const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const make = (dashes, fill, line) => {
      const mesh = new THREE.Mesh(
        plane,
        new THREE.ShaderMaterial({
          vertexShader: VERT,
          fragmentShader: FRAG,
          uniforms: { uColor: { value: new THREE.Color(CONFIG.skills.thunderclaw.ringColor) }, uTime: { value: 0 }, uDashes: { value: dashes }, uFill: { value: fill }, uAlpha: { value: 1 }, uLine: { value: line } },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        }),
      );
      mesh.visible = false;
      mesh.renderOrder = 5;
      mesh.frustumCulled = false;
      mesh.name = 'fx:aimRing';
      scene.add(mesh);
      postFX?.addToMask(mesh);
      return mesh;
    };
    this.range = make(48, 0, 0.012);
    this.target = make(0, 0.18, 0.05);
  }

  show(on) {
    this.range.visible = this.target.visible = on;
  }

  set(center, rangeR, target, targetR) {
    const y = CONFIG.fx.decalY + 0.01;
    this.range.position.set(center.x, y, center.z);
    this.range.scale.set(rangeR * 2, 1, rangeR * 2);
    this.target.position.set(target.x, y + 0.002, target.z);
    this.target.scale.set(targetR * 2, 1, targetR * 2);
  }

  update(realDt) {
    for (const m of [this.range, this.target]) m.material.uniforms.uTime.value += realDt;
  }
}
