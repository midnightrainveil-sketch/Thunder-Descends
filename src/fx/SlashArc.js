import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Crescent slash arcs (pooled). A ring sector built in the shader from (u = along the arc,
// v = across) so every arc can have its own radius, thickness and span. The arc reveals along the
// sweep direction with a bright head, then fades. Local space: arc centered on +Z in the XZ plane;
// the mesh transform places it (yaw) and tilts it around the facing axis (diagonal / vertical cuts).

const VERT = /* glsl */ `
  uniform float uArc, uR, uThick;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    float ang = (uv.x - 0.5) * uArc;
    float prof = pow(sin(3.14159 * uv.x), 0.8);
    float r = uR - uThick * prof * uv.y;
    vec3 p = vec3(sin(ang) * r, 0.0, cos(ang) * r);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uHead, uFade, uDir, uIntensity;
  varying vec2 vUv;
  void main() {
    float s = uDir > 0.0 ? vUv.x : 1.0 - vUv.x;
    if (s > uHead) discard;
    float tail = exp(-(uHead - s) * 3.5);
    float edge = pow(1.0 - vUv.y, 1.6);              // bright outer (cutting) edge
    float head = smoothstep(0.12, 0.0, uHead - s) * 0.8; // hot leading edge
    float a = (tail * 0.85 + head) * edge * uFade;
    vec3 c = mix(uColor, vec3(1.0), clamp(head + edge * 0.35, 0.0, 1.0));
    gl_FragColor = vec4(c * uIntensity * a, a);
  }
`;

export class SlashArcs {
  constructor(scene) {
    const geo = new THREE.PlaneGeometry(1, 1, 40, 2);
    this.pool = [];
    for (let i = 0; i < CONFIG.fx.slashArcs; i++) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uArc: { value: 2 }, uR: { value: 2 }, uThick: { value: 0.6 }, uColor: { value: new THREE.Color() },
          uHead: { value: 0 }, uFade: { value: 1 }, uDir: { value: 1 }, uIntensity: { value: 2.5 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.visible = false;
      mesh.renderOrder = 7;
      mesh.name = 'fx:slashArc';
      scene.add(mesh);
      this.pool.push({ mesh, t: 0, sweep: 0.1, hold: 0.04, fade: 0.14, active: false, hero: true });
    }
    this.next = 0;
    this._e = new THREE.Euler(0, 0, 0, 'YXZ');
  }

  get meshes() {
    return this.pool.map((p) => p.mesh);
  }

  /**
   * pos: center (world), yaw: facing, tiltDeg: roll around the facing (0 = flat, 90 = vertical),
   * radius, thickness, arcDeg, dir: +1 sweeps from −X side to +X side of the facing, −1 the reverse.
   */
  spawn({ pos, yaw, tiltDeg = 0, pitchDeg = 0, radius = 2.2, thickness = 0.7, arcDeg = 120, dir = 1, color = CONFIG.fx.slashColor, intensity = 2.6, sweep = 0.09, hold = 0.03, fade = 0.16, clock = 'hero' }) {
    const s = this.pool[this.next];
    this.next = (this.next + 1) % this.pool.length;
    const u = s.mesh.material.uniforms;
    u.uArc.value = arcDeg * THREE.MathUtils.DEG2RAD;
    u.uR.value = radius;
    u.uThick.value = thickness;
    u.uColor.value.set(color);
    u.uIntensity.value = intensity;
    u.uDir.value = dir;
    u.uHead.value = 0;
    u.uFade.value = 1;
    s.mesh.position.copy(pos);
    s.mesh.rotation.copy(this._e.set(pitchDeg * THREE.MathUtils.DEG2RAD, yaw, tiltDeg * THREE.MathUtils.DEG2RAD, 'YXZ'));
    s.mesh.visible = true;
    Object.assign(s, { t: 0, sweep, hold, fade, active: true, hero: clock === 'hero' });
    return s;
  }

  update(worldDt, heroDt) {
    for (const s of this.pool) {
      if (!s.active) continue;
      s.t += s.hero ? heroDt : worldDt;
      const u = s.mesh.material.uniforms;
      u.uHead.value = Math.min(1.25, s.t / s.sweep);
      const tf = s.t - s.sweep - s.hold;
      u.uFade.value = tf > 0 ? Math.max(0, 1 - tf / s.fade) : 1;
      if (tf > s.fade) {
        s.active = false;
        s.mesh.visible = false;
      }
    }
  }

  clear() {
    for (const s of this.pool) {
      s.active = false;
      s.mesh.visible = false;
    }
  }
}
