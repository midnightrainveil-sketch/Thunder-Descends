import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';
import { buildPart } from '../voxel/VoxelBuilder.js';

// Voxel character rig.
//
// A model is authored as joints (name, parent, pivot) and parts (voxel boxes attached to a joint).
// Boxes live in one shared model grid (integer voxel units, the rest pose), so blocks line up across
// joints. Pivots may be fractional (a joint sits between blocks). A part can instead be authored in
// joint-local grid units (`local: [ox, oy, oz]` = extra origin offset), e.g. the sword.
//
// Every joint is a THREE.Bone with its pivot at the real joint. All parts are merged into ONE
// rigid-skinned opaque mesh and ONE emissive mesh per character (each vertex follows exactly one
// bone), so a character costs 2 draw calls (+2 in the shadow pass) while every joint stays a real
// node that can be animated, detached (claw), split (blade segments) or hidden (scale 0).
// Part box lists are kept for the Stage 3 death shatter.
//
// Emissive glow groups: each part may set `glow` (group index); the emissive material multiplies
// vertex colors by uGlow[group] so visors/eyes/cores can flare independently.
// The opaque material has uFlash (0..1 mix to white) for hit flashes.

const MAX_GLOW = 8;

export class Rig {
  constructor(def, opts = {}) {
    const { voxelSize, palette, seed = 1, origin = [-0.5, 0, -0.5], name = 'rig', jitter = CONFIG.voxel.jitter } = opts;
    this.name = name;
    this.voxelSize = voxelSize;
    this.group = new THREE.Group();
    this.group.name = name;

    // ── Bones
    this.bones = {};
    this.boneList = [];
    this.index = {};
    const pivotM = (p) => new THREE.Vector3((p[0] + origin[0]) * voxelSize, (p[1] + origin[1]) * voxelSize, (p[2] + origin[2]) * voxelSize);
    this.pivots = {};
    for (const [jname, parent, pivot] of def.joints) {
      const bone = new THREE.Bone();
      bone.name = jname;
      const pm = pivotM(pivot);
      this.pivots[jname] = pm;
      if (parent) {
        const pb = this.bones[parent];
        if (!pb) throw new Error(`[rig] ${name}: parent ${parent} of ${jname} not defined yet`);
        bone.position.copy(pm).sub(this.pivots[parent]);
        pb.add(bone);
      } else {
        bone.position.copy(pm);
        this.root = bone;
      }
      this.index[jname] = this.boneList.length;
      this.bones[jname] = bone;
      this.boneList.push(bone);
    }
    this.group.add(this.root);
    this.rest = this.boneList.map((b) => ({ position: b.position.clone(), quaternion: b.quaternion.clone(), scale: b.scale.clone() }));

    // ── Parts → geometry (model space, rest pose)
    this.parts = {};
    const opaqueGeos = [];
    const emissiveGeos = [];
    def.parts.forEach((part, pi) => {
      const bi = this.index[part.joint];
      if (bi === undefined) throw new Error(`[rig] ${name}: part ${part.name} uses unknown joint ${part.joint}`);
      const glow = part.glow ?? 0;
      let partOrigin = origin;
      if (part.local) {
        const pv = def.joints.find((j) => j[0] === part.joint)[2];
        partOrigin = [pv[0] + origin[0] + part.local[0], pv[1] + origin[1] + part.local[1], pv[2] + origin[2] + part.local[2]];
      }
      const built = buildPart(part.boxes, palette, {
        voxelSize,
        origin: partOrigin,
        seed: seed * 101 + pi,
        jitter: part.jitter ?? jitter,
        split: part.split ?? opts.split ?? false,
        attributes: {
          skinIndex: { size: 4, fn: () => [bi, 0, 0, 0] },
          skinWeight: { size: 4, fn: () => [1, 0, 0, 0] },
          aGlow: { size: 1, fn: () => [glow] },
        },
        name: `${name}:${part.name}`,
      });
      if (built.opaqueMesh) opaqueGeos.push(built.opaqueMesh.geometry);
      if (built.emissiveMesh) emissiveGeos.push(built.emissiveMesh.geometry);
      this.parts[part.name] = { name: part.name, joint: part.joint, glow, boxes: built.boxes, origin: partOrigin };
    });

    // Bone inverses are computed from the current (rest) world matrices.
    this.group.updateMatrixWorld(true);
    this.skeleton = new THREE.Skeleton(this.boneList);
    this.flashUniform = { value: 0 };
    this.flashColor = { value: new THREE.Color(1, 1, 1) };
    this.glowUniform = { value: new Array(MAX_GLOW).fill(1) };

    this.opaqueMesh = opaqueGeos.length ? this._skinned(mergeGeometries(opaqueGeos), this._opaqueMaterial(), 'opaque') : null;
    this.emissiveMesh = emissiveGeos.length ? this._skinned(mergeGeometries(emissiveGeos), this._emissiveMaterial(), 'emissive') : null;
    opaqueGeos.concat(emissiveGeos).forEach((g) => g.dispose());

    this.glowNames = def.glowGroups || ['default'];
    this.triangles = (this.opaqueMesh?.geometry.index.count || 0) / 3 + (this.emissiveMesh?.geometry.index.count || 0) / 3;
    this.boxCount = Object.values(this.parts).reduce((n, p) => n + p.boxes.length, 0);
  }

  _skinned(geo, material, kind) {
    geo.computeBoundingSphere();
    const mesh = new THREE.SkinnedMesh(geo, material);
    mesh.name = `${this.name}:${kind}`;
    mesh.castShadow = true;
    mesh.receiveShadow = kind === 'opaque';
    mesh.frustumCulled = false; // bones may travel far (claw, whip)
    this.group.add(mesh);
    mesh.bind(this.skeleton);
    return mesh;
  }

  _opaqueMaterial() {
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: CONFIG.voxel.roughness,
      metalness: CONFIG.voxel.metalness,
    });
    mat.name = `${this.name}:opaque`;
    const flash = this.flashUniform;
    const flashColor = this.flashColor;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uFlash = flash;
      shader.uniforms.uFlashColor = flashColor;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uFlash;\nuniform vec3 uFlashColor;')
        .replace(
          '#include <opaque_fragment>',
          'outgoingLight = mix(outgoingLight, uFlashColor * 0.95, uFlash * 0.8);\n#include <opaque_fragment>',
        );
    };
    mat.customProgramCacheKey = () => 'rigOpaque';
    return mat;
  }

  _emissiveMaterial() {
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    mat.name = `${this.name}:emissive`;
    const glow = this.glowUniform;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uGlow = glow;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\nattribute float aGlow;\nuniform float uGlow[${MAX_GLOW}];\nvarying float vGlow;`)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = uGlow[int(aGlow + 0.5)];');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vGlow;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vGlow;');
    };
    mat.customProgramCacheKey = () => 'rigEmissive';
    return mat;
  }

  bone(name) {
    return this.bones[name];
  }

  // Glow multiplier for a named group (1 = authored intensity).
  setGlow(group, k) {
    const i = typeof group === 'number' ? group : this.glowNames.indexOf(group);
    if (i >= 0) this.glowUniform.value[i] = k;
  }

  getGlow(group) {
    const i = typeof group === 'number' ? group : this.glowNames.indexOf(group);
    return i >= 0 ? this.glowUniform.value[i] : 0;
  }

  setFlash(k, color = null) {
    this.flashUniform.value = k;
    if (color) this.flashColor.value.set(color);
  }

  // Hide/show a bone's geometry (and its children's) by scaling it to ~0.
  setBoneVisible(name, visible) {
    const b = this.bones[name];
    const r = this.rest[this.index[name]];
    if (visible) b.scale.copy(r.scale);
    else b.scale.setScalar(1e-4);
  }

  // Reset every bone to its rest pose (the animator writes on top of this each frame).
  resetPose() {
    for (let i = 0; i < this.boneList.length; i++) {
      const b = this.boneList[i];
      const r = this.rest[i];
      b.position.copy(r.position);
      b.quaternion.copy(r.quaternion);
    }
  }

  // World-space pivot of a bone (after updateMatrixWorld).
  worldPosition(name, out = new THREE.Vector3()) {
    return this.bones[name].getWorldPosition(out);
  }

  setShadows(cast) {
    if (this.opaqueMesh) this.opaqueMesh.castShadow = cast;
    if (this.emissiveMesh) this.emissiveMesh.castShadow = cast;
  }

  dispose() {
    for (const m of [this.opaqueMesh, this.emissiveMesh]) {
      if (!m) continue;
      m.geometry.dispose();
      m.material.dispose();
    }
    this.skeleton.dispose();
  }
}
