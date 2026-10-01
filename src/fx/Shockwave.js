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

// Spear burst: a horizontal streak from the blade tip along +Z (length along uv.y): hot core line,
// tapered point, reveals base → tip fast, then fades.
const SPEAR_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uHead, uFade, uIntensity;
  varying vec2 vUv;
  void main() {
    float y = vUv.y;
    if (y > uHead) discard;
    float hw = 0.5 * (1.0 - pow(y, 3.0));           // tapers to a point
    float x = abs(vUv.x - 0.5);
    if (x > hw) discard;
    float core = exp(-x * x / max(hw * hw, 1e-4) * 12.0);
    float streaks = 0.6 + 0.4 * step(0.5, fract(vUv.x * 9.0 + y * 2.0));
    float head = smoothstep(0.15, 0.0, uHead - y);
    float a = (core * 0.9 + 0.25 * streaks * (1.0 - x / hw)) * (0.35 + 0.65 * y + head) * uFade;
    vec3 c = mix(uColor, vec3(1.0), core * 0.6 + head * 0.4);
    gl_FragColor = vec4(c * uIntensity * a, a);
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

    const spearGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
    const uv = spearGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); // uv.y = 1 at the far (+Z) end
    this.spears = [];
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(
        spearGeo,
        new THREE.ShaderMaterial({
          vertexShader: VERT,
          fragmentShader: SPEAR_FRAG,
          uniforms: { uColor: { value: new THREE.Color('#5fe8ff') }, uHead: { value: 0 }, uFade: { value: 1 }, uIntensity: { value: 3 } },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      );
      mesh.visible = false;
      mesh.renderOrder = 7;
      mesh.frustumCulled = false;
      mesh.name = 'fx:spear';
      scene.add(mesh);
      this.spears.push({ mesh, active: false, t: 0, reveal: 0.06, fade: 0.2, hero: true });
    }
    this.nextSpear = 0;
    this.spearMeshes = this.spears.map((s) => s.mesh);
  }

  // Spear-like burst from pos along yaw (hero clock by default).
  spear(pos, yaw, { length = 3.5, width = 1.0, reveal = 0.06, fade = 0.22, color = '#5fe8ff', intensity = 3, clock = 'hero' } = {}) {
    const s = this.spears[this.nextSpear];
    this.nextSpear = (this.nextSpear + 1) % this.spears.length;
    s.mesh.position.copy(pos);
    s.mesh.rotation.set(0, yaw, 0);
    s.mesh.scale.set(width, 1, length);
    const u = s.mesh.material.uniforms;
    u.uColor.value.set(color);
    u.uIntensity.value = intensity;
    u.uHead.value = 0;
    u.uFade.value = 1;
    Object.assign(s, { active: true, t: 0, reveal, fade, hero: clock === 'hero' });
    s.mesh.visible = true;
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
    for (const s of this.spears) {
      if (!s.active) continue;
      s.t += s.hero ? heroDt : worldDt;
      const u = s.mesh.material.uniforms;
      u.uHead.value = Math.min(1.2, s.t / s.reveal);
      u.uFade.value = Math.max(0, 1 - Math.max(0, s.t - s.reveal) / s.fade);
      if (s.t > s.reveal + s.fade) {
        s.active = false;
        s.mesh.visible = false;
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
    for (const s of this.spears) (s.active = false), (s.mesh.visible = false);
  }
}
