import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Shared map uniforms, updated once per frame by ArenaMap from the world clock and wind.
// Everything animated here reads uWorldTime so it freezes during the Demontime time-stop.
export const mapUniforms = {
  uWorldTime: { value: 0 },
  uWindDir: { value: new THREE.Vector2(0, 1) },
  uGust: { value: 0 },
  uWindStrength: { value: 1 },
  uSwayAmp: { value: 0.07 },
  uSwaySpeed: { value: 1 },
  uSeamRest: { value: 1 },
  uSeamPulse: { value: 2 },
  uSeamPeriod: { value: 8 },
  uSeamSpeed: { value: 6 },
  uSeamWidth: { value: 1.4 },
};

export function syncMapUniforms(worldTime, wind) {
  const T = CONFIG.map.trees;
  const S = CONFIG.map.seams;
  mapUniforms.uWorldTime.value = worldTime;
  mapUniforms.uWindDir.value.copy(wind.dir);
  mapUniforms.uGust.value = wind.gust;
  mapUniforms.uWindStrength.value = CONFIG.map.wind.strength;
  mapUniforms.uSwayAmp.value = T.swayAmp;
  mapUniforms.uSwaySpeed.value = T.swaySpeed;
  mapUniforms.uSeamRest.value = S.rest;
  mapUniforms.uSeamPulse.value = S.pulse;
  mapUniforms.uSeamPeriod.value = S.pulsePeriod;
  mapUniforms.uSeamSpeed.value = S.pulseSpeed;
  mapUniforms.uSeamWidth.value = S.pulseWidth;
}

// ── Floor: darkens each tile's border using a per-vertex tile UV (x, y in meters, z = tile size).
export function makeTileEdgeMaterial() {
  const F = CONFIG.map.floor;
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: CONFIG.voxel.roughness,
    metalness: CONFIG.voxel.metalness,
  });
  mat.name = 'floorTileEdge';
  const uniforms = { uEdgeWidth: { value: F.edgeWidth }, uEdgeDarken: { value: F.edgeDarken } };
  mat.userData.edgeUniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 tileUv;\nvarying vec3 vTileUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTileUv = tileUv;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vTileUv;\nuniform float uEdgeWidth;\nuniform float uEdgeDarken;',
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        if (vTileUv.z > 0.0) {
          vec2 d2 = min(vTileUv.xy, vec2(vTileUv.z) - vTileUv.xy);
          float d = min(d2.x, d2.y);
          float aa = fwidth(d) * 1.5;
          float e = 1.0 - smoothstep(uEdgeWidth * 0.25, uEdgeWidth + aa, d);
          diffuseColor.rgb *= 1.0 - uEdgeDarken * e;
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'floorTileEdge';
  return mat;
}

// ── Seams: emissive vertex colors × (rest + pulse travelling outward every period).
export function makeSeamMaterial() {
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  mat.name = 'arenaSeams';
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mapUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSeamWorld;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvSeamWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vSeamWorld;
        uniform float uWorldTime;
        uniform float uSeamRest;
        uniform float uSeamPulse;
        uniform float uSeamPeriod;
        uniform float uSeamSpeed;
        uniform float uSeamWidth;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float r = length(vSeamWorld.xz);
          float front = mod(uWorldTime, uSeamPeriod) * uSeamSpeed;
          float d = (r - front) / uSeamWidth;
          float fade = 1.0 - smoothstep(6.0, 13.0, front);
          float pulse = exp(-d * d) * fade;
          diffuseColor.rgb *= uSeamRest + uSeamPulse * pulse;
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'arenaSeams';
  return mat;
}

// ── Wind sway (trees). Geometry carries aSway = (pivot.xyz world, weight). Each block moves
// rigidly with its pivot, so cubes never shear. Phase varies with world position.
const SWAY_VERTEX_PARS = `
attribute vec4 aSway;
uniform float uWorldTime;
uniform vec2 uWindDir;
uniform float uGust;
uniform float uSwayAmp;
uniform float uSwaySpeed;
vec3 swayOffset() {
  vec3 pv = aSway.xyz;
  float ph = dot(pv.xz, vec2(0.37, 0.23)) + pv.y * 0.21;
  float t = uWorldTime * uSwaySpeed;
  float s = sin(t + ph) * 0.65 + sin(t * 2.31 + ph * 1.7) * 0.25 + sin(t * 4.7 + ph * 2.9) * 0.1;
  float lean = 0.35 + uGust * 0.9; // steady bend with the wind, stronger in gusts
  float amp = uSwayAmp * aSway.w * (1.0 + uGust * 0.8);
  vec3 off;
  off.xz = uWindDir * amp * (s + lean);
  off.xz += vec2(-uWindDir.y, uWindDir.x) * amp * 0.35 * sin(t * 1.37 + ph * 2.3);
  off.y = amp * 0.18 * sin(t * 1.9 + ph);
  return off;
}
`;

function injectSway(shader) {
  Object.assign(shader.uniforms, mapUniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${SWAY_VERTEX_PARS}`)
    .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += swayOffset();');
}

// Trees dither out near the camera (the follow camera can sit under a canopy at the rim).
const camFadeUniforms = {
  uCamFadeNear: { value: CONFIG.map.trees.camFade.near },
  uCamFadeFar: { value: CONFIG.map.trees.camFade.far },
};
export function applyTreeCamFade() {
  camFadeUniforms.uCamFadeNear.value = CONFIG.map.trees.camFade.near;
  camFadeUniforms.uCamFadeFar.value = CONFIG.map.trees.camFade.far;
}

// Fragments closer to the camera than camFade.far are dithered away (all gone at camFade.near).
function injectCamFade(shader) {
  Object.assign(shader.uniforms, camFadeUniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vFadeWorld;')
    .replace('#include <project_vertex>', '#include <project_vertex>\nvFadeWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uCamFadeNear;\nuniform float uCamFadeFar;\nvarying vec3 vFadeWorld;')
    .replace(
      'void main() {',
      `void main() {
        {
          float k = smoothstep(uCamFadeNear, uCamFadeFar, distance(vFadeWorld, cameraPosition));
          float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
          if (ign > k) discard;
        }`,
    );
}

// Plain voxel material (like VoxelBuilder's opaque one) that dithers out near the camera: the
// shrine props behind the back rim, which the follow camera can pass close to.
export function makeCamFadeMaterial(name) {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: CONFIG.voxel.roughness,
    metalness: CONFIG.voxel.metalness,
  });
  mat.name = name;
  mat.onBeforeCompile = injectCamFade;
  mat.customProgramCacheKey = () => `camFade:${name}`;
  return mat;
}

// Standard voxel material with sway; `lift` adds a tiny self-light from the vertex color.
// Fragments closer to the camera than camFade.far are dithered away (all gone at camFade.near).
export function makeSwayMaterial(name, lift = 0) {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.9,
    metalness: 0.0,
  });
  mat.name = name;
  const uniforms = { uLift: { value: lift } };
  mat.userData.liftUniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    injectSway(shader);
    Object.assign(shader.uniforms, uniforms);
    injectCamFade(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uLift;')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance += vColor.rgb * uLift;\n#endif',
      );
  };
  mat.customProgramCacheKey = () => `sway:${name}`;
  return mat;
}

// Matching depth material so shadows sway with the geometry.
export function makeSwayDepthMaterial() {
  const mat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  mat.onBeforeCompile = injectSway;
  mat.customProgramCacheKey = () => 'swayDepth';
  return mat;
}
