import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Floor telegraph decals (pooled): circle, sector or rectangle outlines that fill up over the
// windup, flash when they resolve, then fade. World clock. Local shader coords:
//  circle / sector: p in [-1, 1]² (units of radius), sector opens along +Z;
//  rect: x across [-0.5, 0.5], y along [0, 1] (starts at the origin, extends along +Z).
const SHAPES = { circle: 0, sector: 1, rect: 2 };

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform int uShape;
  uniform float uFill, uFade, uHalfArc, uEdge, uFlash, uAspect;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float inside, edge, fillCoord;
    if (uShape == 2) {
      vec2 q = vec2(vUv.x - 0.5, vUv.y);
      float ex = 0.5 - abs(q.x);                      // long sides only (thin line reads cleanly)
      edge = (1.0 - smoothstep(0.0, uEdge, ex)) * 0.7 + smoothstep(0.35, 0.0, abs(q.x)) * 0.25;
      inside = 1.0;
      fillCoord = q.y;
    } else {
      vec2 p = vUv * 2.0 - 1.0;
      float d = length(p);
      if (d > 1.0) discard;
      float e = 1.0 - d;
      if (uShape == 1) {
        float ang = abs(atan(p.x, p.y));
        if (ang > uHalfArc) discard;
        float side = (uHalfArc - ang) * d;
        e = min(e, side);
      }
      edge = 1.0 - smoothstep(0.0, uEdge, e);
      inside = 1.0;
      fillCoord = d;
    }
    float filled = step(fillCoord, uFill);
    float front = smoothstep(0.06, 0.0, abs(fillCoord - uFill)) * step(uFill, 0.999);
    float a = (0.12 + filled * 0.3 + edge * 0.75 + front * 0.6 + uFlash) * inside * uFade;
    vec3 c = mix(uColor, vec3(1.0, 0.85, 0.6), clamp(uFlash + front * 0.3, 0.0, 1.0));
    float gain = uShape == 2 ? 0.75 : 1.35;
    gl_FragColor = vec4(c * a * gain, a);
  }
`;

export class Decals {
  constructor(scene) {
    const F = CONFIG.fx;
    const centered = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    // Map the plane so +Z (far end) is uv.y = 1 after rotation.
    const flipV = (g) => {
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
      return g;
    };
    flipV(centered);
    const rect = flipV(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5));
    this.geos = { centered, rect };
    this.pool = [];
    for (let i = 0; i < F.decals; i++) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uShape: { value: 0 }, uFill: { value: 0 }, uFade: { value: 1 }, uHalfArc: { value: 1 }, uEdge: { value: 0.04 },
          uFlash: { value: 0 }, uAspect: { value: 1 }, uColor: { value: new THREE.Color(F.decalColor) },
        },
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      });
      const mesh = new THREE.Mesh(centered, mat);
      mesh.visible = false;
      mesh.renderOrder = 9; // telegraphs draw above other floor / air effects
      mesh.frustumCulled = false;
      mesh.name = 'fx:decal';
      scene.add(mesh);
      this.pool.push({ mesh, active: false, t: 0, duration: 1, resolved: false, rt: 0 });
    }
    this.next = 0;
  }

  /**
   * shape 'circle' { radius }, 'sector' { radius, arcDeg }, 'rect' { length, width };
   * x, z, yaw; duration = fill time. Returns a handle { cancel(), setTransform(x, z, yaw) }.
   */
  show(shape, { x, z, yaw = 0, radius = 1, arcDeg = 90, length = 4, width = 0.5, duration = 0.5, color = CONFIG.fx.decalColor }) {
    const d = this._take();
    const m = d.mesh;
    const u = m.material.uniforms;
    u.uShape.value = SHAPES[shape];
    u.uFill.value = 0;
    u.uFade.value = 1;
    u.uFlash.value = 0;
    u.uColor.value.set(color);
    if (shape === 'rect') {
      m.geometry = this.geos.rect;
      m.scale.set(width, 1, length);
      u.uAspect.value = length / width;
      u.uEdge.value = 0.18;
    } else {
      m.geometry = this.geos.centered;
      m.scale.set(radius * 2, 1, radius * 2);
      u.uHalfArc.value = (arcDeg * Math.PI) / 360;
      u.uEdge.value = 0.05 / Math.max(radius, 0.5) * 2;
    }
    m.position.set(x, CONFIG.fx.decalY, z);
    m.rotation.set(0, yaw, 0);
    m.visible = true;
    Object.assign(d, { active: true, t: 0, duration, resolved: false, rt: 0 });
    d.cancel = () => this._fadeOut(d);
    d.setTransform = (nx, nz, nyaw) => {
      m.position.x = nx;
      m.position.z = nz;
      m.rotation.y = nyaw;
    };
    return d;
  }

  _take() {
    for (let k = 0; k < this.pool.length; k++) {
      const d = this.pool[(this.next + k) % this.pool.length];
      if (!d.active) {
        this.next = (this.next + k + 1) % this.pool.length;
        return d;
      }
    }
    const d = this.pool[this.next];
    this.next = (this.next + 1) % this.pool.length;
    return d;
  }

  _fadeOut(d) {
    if (!d.active) return;
    d.resolved = true;
    d.rt = 0;
    d.cancelled = true;
  }

  update(worldDt) {
    for (const d of this.pool) {
      if (!d.active) continue;
      const u = d.mesh.material.uniforms;
      if (!d.resolved) {
        d.t += worldDt;
        const k = Math.min(1, d.t / d.duration);
        u.uFill.value = k;
        u.uFade.value = 0.75 + 0.25 * Math.sin(d.t * 30) * k * k; // urgent pulse near the end
        if (k >= 1) {
          d.resolved = true;
          d.cancelled = false;
          d.rt = 0;
        }
      } else {
        d.rt += worldDt;
        const hold = d.cancelled ? 0 : 0.06;
        u.uFlash.value = d.cancelled ? 0 : Math.max(0, 0.9 - d.rt * 8);
        u.uFade.value = Math.max(0, 1 - Math.max(0, d.rt - hold) / 0.14);
        if (u.uFade.value <= 0) {
          d.active = false;
          d.mesh.visible = false;
        }
      }
    }
  }

  clear() {
    for (const d of this.pool) {
      d.active = false;
      d.mesh.visible = false;
    }
  }
}
