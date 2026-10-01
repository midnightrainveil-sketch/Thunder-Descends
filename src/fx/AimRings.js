import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Persistent floor rings for skill aiming (real time): a dashed range ring around the hero and a
// target circle with a soft fill and crosshair ticks (Q), and a lane from the hero with bright
// edges and chevrons flowing toward the tip (E). Additive, above the gameplay decals.
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

const LANE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime, uAlpha, uLen, uWid;
  varying vec2 vUv;
  void main() {
    float along = 1.0 - vUv.y;               // 0 at the hero, 1 at the tip
    float ax = abs(vUv.x * 2.0 - 1.0);         // 0 on the center line, 1 at the edges
    float ew = 0.06 / uWid;                     // ~6 cm edge lines
    float edge = smoothstep(1.0 - ew * 2.0, 1.0 - ew * 0.5, ax);
    float tip = smoothstep(1.0 - 0.08 / uLen, 1.0, along);
    float c = fract(along * uLen / 0.9 - ax * 0.35 - uTime * 1.6);
    float chevron = smoothstep(0.0, 0.08, c) * smoothstep(0.24, 0.12, c) * 0.55;
    float fill = 0.1 + 0.1 * along;
    float a = (edge + tip + chevron + fill) * smoothstep(0.0, 0.1, along) * uAlpha;
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
    // Dash-strike target marker (shown on the enemy the next attack will snap to).
    this.marker = make(6, 0.1, 0.08);
    this.marker.material.uniforms.uColor.value.set(CONFIG.hero.dash.strike.markerColor);
    // E lane: unit plane from z = 0 (hero) to z = 1 (tip), scaled to width × length, turned to the aim.
    this.lane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5),
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: LANE_FRAG,
        uniforms: { uColor: { value: new THREE.Color(CONFIG.skills.shatter.laneColor) }, uTime: { value: 0 }, uAlpha: { value: 1 }, uLen: { value: 5 }, uWid: { value: 1.2 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    this.lane.visible = false;
    this.lane.renderOrder = 5;
    this.lane.frustumCulled = false;
    this.lane.name = 'fx:aimLane';
    scene.add(this.lane);
    postFX?.addToMask(this.lane);
  }

  showMarker(pos, r) {
    if (!pos) {
      this.marker.visible = false;
      return;
    }
    this.marker.visible = true;
    this.marker.position.set(pos.x, CONFIG.fx.decalY + 0.014, pos.z);
    this.marker.scale.set(r * 2, 1, r * 2);
  }

  showLane(on) {
    this.lane.visible = on;
  }

  setLane(origin, yaw, length, width) {
    this.lane.position.set(origin.x, CONFIG.fx.decalY + 0.012, origin.z);
    this.lane.rotation.y = yaw;
    this.lane.scale.set(width, 1, length);
    const u = this.lane.material.uniforms;
    u.uLen.value = length;
    u.uWid.value = width;
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
    for (const m of [this.range, this.target, this.lane, this.marker]) m.material.uniforms.uTime.value += realDt;
  }
}
