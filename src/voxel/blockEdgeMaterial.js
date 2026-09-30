import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Voxel material variant that darkens a thin band along block boundaries (procedural, no
// textures). Used where large coplanar blocks (floor, walls) would otherwise merge visually,
// so the platform reads as big chunky blocks while staying perfectly flat.
const cache = new Map();

export function getBlockEdgeMaterial(blockSize, width = CONFIG.arena.edgeWidth, darken = CONFIG.arena.edgeDarken) {
  const key = `${blockSize}:${width}:${darken}`;
  let mat = cache.get(key);
  if (mat) return mat;

  mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: CONFIG.voxel.roughness,
    metalness: CONFIG.voxel.metalness,
  });
  mat.name = 'voxelBlockEdge';
  const uniforms = {
    uBlockSize: { value: blockSize },
    uEdgeWidth: { value: width },
    uEdgeDarken: { value: darken },
  };
  mat.userData.edgeUniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vEdgeWorldPos;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvEdgeWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vEdgeWorldPos;
        uniform float uBlockSize;
        uniform float uEdgeWidth;
        uniform float uEdgeDarken;
        float edgeLine(float c) {
          float d = abs(fract(c / uBlockSize) - 0.5) * uBlockSize; // 0.5*size at a boundary
          float aa = fwidth(c) * 1.5;
          return smoothstep(0.5 * uBlockSize - uEdgeWidth - aa, 0.5 * uBlockSize - uEdgeWidth * 0.25, d);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec3 n = abs(normalize(cross(dFdx(vEdgeWorldPos), dFdy(vEdgeWorldPos))));
          vec3 p = vEdgeWorldPos; // block boundaries sit on multiples of uBlockSize
          float e;
          if (n.y > 0.5) e = max(edgeLine(p.x), edgeLine(p.z));
          else if (n.x > 0.5) e = max(edgeLine(p.y), edgeLine(p.z));
          else e = max(edgeLine(p.x), edgeLine(p.y));
          diffuseColor.rgb *= 1.0 - uEdgeDarken * e;
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'voxelBlockEdge';
  cache.set(key, mat);
  return mat;
}
