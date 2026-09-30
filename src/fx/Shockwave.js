import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Expanding shockwave rings on the floor (pooled, additive). Ring profile is computed in the
// shader from the plane's uv so the thickness stays constant while it grows.
const RING_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uFade, uThick, uIntensity;
  varying vec2 vUv;
  void main() {
    float d = length(vUv * 2.0 - 1.0);
    if (d > 1.0) discard;
    float band = smoothstep(1.0 - uThick, 1.0 - uThick * 0.35, d) * smoothstep(1.0, 0.97, d);
    float inner = smoothstep(0.0, 1.0, d) * 0.12;
    float a = (band + inner) * uFade;
    gl_FragColor = vec4(uColor * uIntensity * a, a);
  }
`;
const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// Vertical spawn beam: open cylinder, bright core fading upward, flickering.
const BEAM_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uFade, uTime;
  varying vec2 vUv;
  void main() {
    float up = 1.0 - vUv.y;
    float fl = 0.8 + 0.2 * sin(uTime * 55.0 + vUv.y * 20.0);
    float a = pow(up, 1.6) * uFade * fl;
    gl_FragColor = vec4(uColor * 3.0 * a, a);
  }
`;

export class Shockwaves {
  constructor(scene) {
    const F = CONFIG.fx;
    const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.rings = [];
    for (let i = 0; i < F.rings; i++) {
      const mesh = new THREE.Mesh(
        plane,
        new THREE.ShaderMaterial({
          vertexShader: VERT,
          fragmentShader: RING_FRAG,
          uniforms: { uColor: { value: new THREE.Color() }, uFade: { value: 1 }, uThick: { value: 0.2 }, uIntensity: { value: 2.5 } },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        }),
      );
      mesh.visible = false;
      mesh.renderOrder = 4;
      mesh.frustumCulled = false;
      mesh.name = 'fx:ring';
      scene.add(mesh);
      this.rings.push({ mesh, active: false, t: 0, duration: 0.4, r0: 0.2, r1: 2, hero: false });
    }
    const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true).translate(0, 0.5, 0);
    this.beams = [];
    for (let i = 0; i < F.beams; i++) {
      const mesh = new THREE.Mesh(
        beamGeo,
        new THREE.ShaderMaterial({
          vertexShader: VERT,
          fragmentShader: BEAM_FRAG,
          uniforms: { uColor: { value: new THREE.Color(CONFIG.fx.emberColor) }, uFade: { value: 1 }, uTime: { value: 0 } },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      );
      mesh.visible = false;
      mesh.renderOrder = 4;
      mesh.frustumCulled = false;
      mesh.name = 'fx:beam';
      scene.add(mesh);
      this.beams.push({ mesh, active: false, t: 0, duration: 1 });
    }
    this.nextRing = 0;
    this.nextBeam = 0;
  }

  // Floor ring growing from r0 to r1 over duration.
  ring(pos, { r0 = 0.3, r1 = 2.5, duration = 0.35, color = '#ffffff', intensity = 2.5, thickness = 0.22, y = CONFIG.fx.decalY + 0.005, clock = 'world' } = {}) {
    const r = this.rings[this.nextRing];
    this.nextRing = (this.nextRing + 1) % this.rings.length;
    const u = r.mesh.material.uniforms;
    u.uColor.value.set(color);
    u.uIntensity.value = intensity;
    u.uThick.value = thickness;
    u.uFade.value = 1;
    r.mesh.position.set(pos.x, y, pos.z);
    Object.assign(r, { active: true, t: 0, duration, r0, r1, hero: clock === 'hero' });
    r.mesh.visible = true;
    this._scaleRing(r, 0);
    return r;
  }

  _scaleRing(r, k) {
    const e = 1 - Math.pow(1 - k, 3);
    const rad = r.r0 + (r.r1 - r.r0) * e;
    r.mesh.scale.set(rad * 2, 1, rad * 2);
  }

  // Spawn telegraph beam (world clock).
  beam(pos, { duration = CONFIG.enemies.spawnBeam, radius = 0.45, height = 7 } = {}) {
    const b = this.beams[this.nextBeam];
    this.nextBeam = (this.nextBeam + 1) % this.beams.length;
    b.mesh.position.set(pos.x, 0, pos.z);
    b.radius = radius;
    b.height = height;
    Object.assign(b, { active: true, t: 0, duration });
    b.mesh.visible = true;
    return b;
  }

  update(worldDt, heroDt) {
    for (const r of this.rings) {
      if (!r.active) continue;
      r.t += r.hero ? heroDt : worldDt;
      const k = Math.min(1, r.t / r.duration);
      this._scaleRing(r, k);
      r.mesh.material.uniforms.uFade.value = 1 - k * k;
      if (k >= 1) {
        r.active = false;
        r.mesh.visible = false;
      }
    }
    for (const b of this.beams) {
      if (!b.active) continue;
      b.t += worldDt;
      const k = Math.min(1, b.t / b.duration);
      const u = b.mesh.material.uniforms;
      u.uTime.value += worldDt;
      // Narrow → wide pulse, bright flash at the end.
      const w = b.radius * (0.35 + 0.65 * k) * (k > 0.85 ? 1.6 : 1);
      b.mesh.scale.set(w, b.height * (0.4 + 0.6 * Math.min(1, k * 3)), w);
      u.uFade.value = k > 0.9 ? (1 - k) * 10 * 1.5 : 0.35 + 0.65 * k;
      if (k >= 1) {
        b.active = false;
        b.mesh.visible = false;
      }
    }
  }

  clear() {
    for (const r of this.rings) (r.active = false), (r.mesh.visible = false);
    for (const b of this.beams) (b.active = false), (b.mesh.visible = false);
  }
}
