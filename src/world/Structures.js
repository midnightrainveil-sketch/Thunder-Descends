import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG, ENV_BIG_VOXEL } from '../config.js';
import { buildPart, getOpaqueMaterial, getEmissiveMaterial } from '../voxel/VoxelBuilder.js';
import { MAP_PALETTE } from '../voxel/palettes.js';
import { toriiBoxes, stepsBoxes, shrineHallBoxes, pagodaBoxes } from '../voxel/models/ShrineProps.js';

// Merge several built parts (already positioned via their origin) into one opaque + one emissive mesh.
export function mergeParts(parts, name, { castShadow = true, receiveShadow = true } = {}) {
  const group = new THREE.Group();
  group.name = name;
  const og = parts.map((p) => p.opaqueMesh?.geometry).filter(Boolean);
  const eg = parts.map((p) => p.emissiveMesh?.geometry).filter(Boolean);
  let opaque = null;
  let emissive = null;
  if (og.length) {
    opaque = new THREE.Mesh(mergeGeometries(og), getOpaqueMaterial());
    opaque.name = `${name}:opaque`;
    opaque.castShadow = castShadow;
    opaque.receiveShadow = receiveShadow;
    group.add(opaque);
  }
  if (eg.length) {
    emissive = new THREE.Mesh(mergeGeometries(eg), getEmissiveMaterial());
    emissive.name = `${name}:emissive`;
    group.add(emissive);
  }
  for (const p of parts) {
    p.opaqueMesh?.geometry.dispose();
    p.emissiveMesh?.geometry.dispose();
  }
  return { group, opaque, emissive };
}

// Back composition (spec §4): vermilion torii just beyond the back edge, stone steps descending
// behind it, a small shrine hall further back, and a distant five-tier pagoda on a far ridge.
export class Structures {
  constructor(rig) {
    const M = CONFIG.map;
    const V = ENV_BIG_VOXEL;
    this.group = new THREE.Group();
    this.group.name = 'structures';

    // Positions → origins in voxel units (whole-block snapping keeps each prop on its grid).
    const originAt = (x, y, z, size) => [Math.round(x / size), Math.round(y / size), Math.round(z / size)];

    const torii = buildPart(toriiBoxes(M.torii.worn, 101), MAP_PALETTE, {
      voxelSize: V,
      origin: originAt(M.torii.x, 0, M.torii.z, V),
      seed: 103,
      name: 'torii',
    });
    const steps = buildPart(stepsBoxes(M.steps, Math.round(M.steps.cutDepth / V)), MAP_PALETTE, {
      voxelSize: V,
      origin: originAt(M.torii.x, 0, M.torii.z - M.steps.offset, V),
      seed: 107,
      split: true,
      name: 'steps',
    });
    const shrine = buildPart(shrineHallBoxes(), MAP_PALETTE, {
      voxelSize: V,
      origin: originAt(M.shrine.x, M.shrine.y, M.shrine.z, V),
      seed: 109,
      name: 'shrine',
    });
    this.near = mergeParts([torii, steps, shrine], 'shrineNear');
    this.group.add(this.near.group);

    // Pagoda on a far peak, placed at a screen position in the fixed camera (like the moon) so it
    // stays in frame: the view ray through P.screen is intersected with the plane y = P.y.
    const P = M.pagoda;
    const cam = rig.pickCamera;
    cam.updateMatrixWorld(true);
    const ray = new THREE.Vector3(P.screen.x, P.screen.y, 0.5).unproject(cam).sub(cam.position).normalize();
    const t = (P.y - cam.position.y) / ray.y;
    const px = cam.position.x + ray.x * t;
    const pz = cam.position.z + ray.z * t;
    this.pagodaSite = { x: px, z: pz, y: P.y };
    const pagoda = buildPart(pagodaBoxes(), MAP_PALETTE, {
      voxelSize: P.block,
      origin: [Math.round(px / P.block) - 0.5, Math.round(P.y / P.block), Math.round(pz / P.block) - 0.5],
      seed: 113,
      castShadow: false,
      receiveShadow: false,
      name: 'pagoda',
    });
    this.pagoda = pagoda;
    this.group.add(pagoda.group);
  }
}
