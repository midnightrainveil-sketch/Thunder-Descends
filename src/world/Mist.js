import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { mapUniforms } from './mapMaterials.js';

// Ground mist (spec §4): a few layered transparent annuli with scrolling fbm noise (world clock)
// around the rim and below the platform edge, plus a far mist sea around the mountains.
// Inner radii keep every layer off the play floor.
export class Mist {
  constructor(wind) {
    this.group = new THREE.Group();
    this.group.name = 'mist';
    this.wind = wind;
    this.layers = [];
    this.build();
  }

  build() {
    for (const l of this.layers) {
      this.group.remove(l.mesh);
      l.mesh.geometry.dispose();
      l.mesh.material.dispose();
    }
    this.layers = [];
    const M = CONFIG.map.mist;
    const count = Math.min(CONFIG.quality.mistLayers, M.layers.length);
    for (let i = 0; i < count; i++) {
      const L = M.layers[i];
      const uniforms = {
        uWorldTime: mapUniforms.uWorldTime,
        uColor: { value: new THREE.Color(M.color) },
        uOpacity: { value: L.opacity * M.density },
        uScale: { value: L.scale },
        uSpeed: { value: L.speed },
        uWind: { value: new THREE.Vector2(0, 1) },
        uInner: { value: L.inner },
        uOuter: { value: L.outer },
        uSeed: { value: i * 17.3 },
      };
      const mat = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
          varying vec3 vWorld;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorld = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uOpacity, uScale, uSpeed, uInner, uOuter, uSeed, uWorldTime;
          uniform vec2 uWind;
          varying vec3 vWorld;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
          float noise(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
          }
          float fbm(vec2 p) {
            float v = 0.0, a = 0.5;
            for (int k = 0; k < 4; k++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
            return v;
          }
          void main() {
            vec2 p = vWorld.xz * uScale;
            vec2 drift = uWind * uWorldTime * uSpeed * uScale * 4.0;
            float n = fbm(p - drift) * 0.7 + fbm(p * 1.9 + drift * 0.6 + 5.0) * 0.3;
            float r = length(vWorld.xz);
            float radial = smoothstep(uInner, uInner + max(2.0, (uOuter - uInner) * 0.12), r) * (1.0 - smoothstep(uOuter * 0.75, uOuter, r));
            float a = smoothstep(0.32, 0.78, n) * radial * uOpacity;
            gl_FragColor = vec4(uColor, a);
          }
        `,
        transparent: true,
        depthWrite: false,
        fog: false,
        side: THREE.DoubleSide,
      });
      const geo = new THREE.RingGeometry(Math.max(0.01, L.inner), L.outer, 96, 1).rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = L.y;
      mesh.name = `mist${i}`;
      mesh.renderOrder = 3 + (M.layers.length - i);
      this.layers.push({ mesh, uniforms, config: L });
      this.group.add(mesh);
    }
  }

  update() {
    const M = CONFIG.map.mist;
    for (const l of this.layers) {
      l.uniforms.uWind.value.copy(this.wind.dir);
      l.uniforms.uOpacity.value = l.config.opacity * M.density;
      l.uniforms.uColor.value.set(M.color);
    }
  }
}
