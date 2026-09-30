import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Color grade in linear HDR, after bloom and before OutputPass (tone mapping + sRGB).
// Uniforms (spec §12): saturation, tint (color + strength), vignette, chromatic aberration,
// additive flash, and the Demontime time-stop ring (ringCenter in screen UV, ringRadius in
// screen-height units, ringActive 0..1). Inside the ring pixels go grayscale except where the
// hero mask is set; the ring edge is a bright cyan line.
const GradeShader = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse: { value: null },
    tMask: { value: null },
    aspect: { value: 1 },
    saturation: { value: 1 },
    tintColor: { value: new THREE.Color(1, 1, 1) },
    tintStrength: { value: 0 },
    vignette: { value: 0 },
    vignetteSoftness: { value: 0.5 },
    chromaticAberration: { value: 0 },
    flash: { value: 0 },
    flashColor: { value: new THREE.Color(1, 1, 1) },
    ringCenter: { value: new THREE.Vector2(0.5, 0.5) },
    ringRadius: { value: 0 },
    ringActive: { value: 0 },
    ringLineWidth: { value: 0.01 },
    ringLineColor: { value: new THREE.Color(0.2, 0.9, 1) },
    ringLineIntensity: { value: 3 },
    ringDistort: { value: 0.005 },
    useMask: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tMask;
    uniform float aspect;
    uniform float saturation;
    uniform vec3 tintColor;
    uniform float tintStrength;
    uniform float vignette;
    uniform float vignetteSoftness;
    uniform float chromaticAberration;
    uniform float flash;
    uniform vec3 flashColor;
    uniform vec2 ringCenter;
    uniform float ringRadius;
    uniform float ringActive;
    uniform float ringLineWidth;
    uniform vec3 ringLineColor;
    uniform float ringLineIntensity;
    uniform float ringDistort;
    uniform float useMask;
    varying vec2 vUv;

    float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

    void main() {
      vec2 uv = vUv;

      // Time-stop ring: distance in screen-height units (aspect corrected).
      vec2 rd = (uv - ringCenter) * vec2(aspect, 1.0);
      float dist = length(rd);
      float edge = dist - ringRadius;
      float lineMask = 0.0;
      if (ringActive > 0.0) {
        lineMask = 1.0 - smoothstep(0.0, ringLineWidth, abs(edge));
        // Slight refraction right at the shockwave front.
        vec2 dir = dist > 1e-5 ? rd / dist : vec2(0.0);
        uv -= dir * vec2(1.0 / aspect, 1.0) * ringDistort * lineMask * ringActive;
      }

      // Chromatic aberration: radial RGB split, stronger toward the edges.
      vec3 col;
      if (chromaticAberration > 0.0) {
        vec2 off = (uv - 0.5) * chromaticAberration * 0.012;
        col.r = texture2D(tDiffuse, uv + off).r;
        col.g = texture2D(tDiffuse, uv).g;
        col.b = texture2D(tDiffuse, uv - off).b;
      } else {
        col = texture2D(tDiffuse, uv).rgb;
      }

      float l = luma(col);

      // Saturation
      col = mix(vec3(l), col, saturation);

      // Tint (cold slow-mo look): pull toward luma-weighted tint color.
      vec3 tinted = (col * 0.55 + vec3(l) * 0.45) * tintColor;
      col = mix(col, tinted, tintStrength);

      // Time-stop grayscale inside the ring; masked objects keep their color.
      if (ringActive > 0.0) {
        float inside = (1.0 - smoothstep(-ringLineWidth * 0.5, 0.0, edge)) * ringActive;
        float keep = useMask > 0.5 ? texture2D(tMask, vUv).r : 0.0;
        float g = luma(col);
        col = mix(col, vec3(g), inside * (1.0 - keep));
        col += ringLineColor * ringLineIntensity * lineMask * ringActive;
      }

      // Vignette
      if (vignette > 0.0) {
        vec2 vd = (vUv - 0.5) * vec2(aspect, 1.0);
        float v = smoothstep(0.35 + (1.0 - vignetteSoftness) * 0.4, 0.35 + 0.55 + vignetteSoftness * 0.2, length(vd));
        col *= 1.0 - v * vignette;
      }

      // Additive flash
      col += flashColor * flash;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class GradePass extends ShaderPass {
  constructor() {
    super(GradeShader);
  }
}
