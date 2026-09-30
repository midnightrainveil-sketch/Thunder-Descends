import * as THREE from 'three';
import { CONFIG, ENV_VOXEL, FLOOR_BLOCK } from '../config.js';
import { buildPart, hash01 } from '../voxel/VoxelBuilder.js';
import { MAP_PALETTE } from '../voxel/palettes.js';
import { getBlockEdgeMaterial } from '../voxel/blockEdgeMaterial.js';
import { lanternBoxes, balustradePostBoxes, balustradeRailBoxes } from '../voxel/models/ShrineProps.js';
import { spawnGates, arenaDir } from './ArenaBounds.js';
import { Embers } from './Embers.js';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

// Platform rim (spec §4): stepped foundation wall dropping into mist, low instanced balustrade
// with the 4 gate gaps, 8 stone lanterns with flickering fire boxes, 2 real point lights,
// fake light-pool decals and rising embers. Flicker and embers run on the world clock.
export class Rim {
  constructor(floor) {
    this.group = new THREE.Group();
    this.group.name = 'rim';
    this._buildFoundation(floor);
    this._buildBalustrade();
    this._buildLanterns();
  }

  _buildFoundation(floor) {
    const F = CONFIG.map.foundation;
    const FL = CONFIG.map.floor;
    const boxes = [];
    const occluders = [];
    const pick = (i, j, y) => {
      if (hash01(41, i, j * 7 + y) < F.mossChance * (y === -1 ? 1.6 : 1)) return 'moss';
      return hash01(43, i, j, y) < 0.5 ? 'basalt1' : 'basalt2';
    };
    for (const t of floor.tiles.values()) occluders.push({ p: [t.i, 0, t.j], s: [1, 1, 1] });
    for (const t of floor.boundaryTiles()) {
      for (let y = -1; y >= -F.depth; y--) boxes.push({ p: [t.i, y, t.j], s: [1, 1, 1], c: pick(t.i, t.j, y) });
    }
    // Lower, inset tier (mostly hidden in mist).
    const r2 = FL.rimOuterRadius - F.inset;
    const inTier2 = (i, j) => Math.hypot(i, j) <= r2;
    for (const t of floor.tiles.values()) {
      const { i, j } = t;
      if (!inTier2(i, j)) continue;
      if (inTier2(i + 1, j) && inTier2(i - 1, j) && inTier2(i, j + 1) && inTier2(i, j - 1)) continue;
      boxes.push({ p: [i, -F.depth - F.tier2Depth, j], s: [1, F.tier2Depth, 1], c: 'basalt3' });
    }
    const part = buildPart(boxes, MAP_PALETTE, {
      voxelSize: FLOOR_BLOCK,
      origin: [-0.5, 0, -0.5],
      jitter: F.jitter,
      seed: 31,
      occluders,
      castShadow: false,
      material: getBlockEdgeMaterial(FLOOR_BLOCK, { offset: 0.5 }),
      name: 'foundation',
    });
    this.foundation = part;
    this.group.add(part.group);
  }

  _buildBalustrade() {
    const B = CONFIG.map.balustrade;
    const r = B.radius;
    const post = buildPart(balustradePostBoxes(), MAP_PALETTE, { voxelSize: ENV_VOXEL, seed: 51, name: 'post' });
    const rail = buildPart(balustradeRailBoxes(B.railLength), MAP_PALETTE, {
      voxelSize: ENV_VOXEL,
      origin: [-B.railLength / 2, 0, -0.5],
      seed: 53,
      name: 'rail',
    });
    const postWidth = 2 * ENV_VOXEL;
    const railModelLen = B.railLength * ENV_VOXEL;

    // Posts and rails per arc between gates.
    const posts = [];
    const rails = [];
    const gates = [...spawnGates].sort((a, b) => a.angleDeg - b.angleDeg);
    for (let k = 0; k < gates.length; k++) {
      const g0 = gates[k];
      const g1 = gates[(k + 1) % gates.length];
      const a0 = g0.angleDeg * DEG + g0.halfAngle;
      let a1 = g1.angleDeg * DEG - g1.halfAngle;
      if (a1 <= a0) a1 += TAU;
      const span = a1 - a0;
      const nseg = Math.max(1, Math.round((span * r) / B.postSpacing));
      const step = span / nseg;
      for (let i = 0; i <= nseg; i++) posts.push(a0 + i * step);
      const chord = 2 * r * Math.sin(step / 2);
      const stretch = (chord - postWidth) / railModelLen;
      for (let i = 0; i < nseg; i++) rails.push({ a: a0 + (i + 0.5) * step, dist: r * Math.cos(step / 2), stretch });
    }

    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const postMesh = new THREE.InstancedMesh(post.opaqueMesh.geometry, post.opaqueMesh.material, posts.length);
    posts.forEach((a, i) => {
      dummy.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
      dummy.rotation.set(0, a, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      postMesh.setMatrixAt(i, dummy.matrix);
      postMesh.setColorAt(i, col.setScalar(1 + (hash01(61, i) * 2 - 1) * B.jitter));
    });
    const railMesh = new THREE.InstancedMesh(rail.opaqueMesh.geometry, rail.opaqueMesh.material, rails.length);
    rails.forEach((rl, i) => {
      dummy.position.set(Math.sin(rl.a) * rl.dist, 0, Math.cos(rl.a) * rl.dist);
      const flip = hash01(63, i) < 0.5 ? Math.PI : 0; // vary the moss block position
      dummy.rotation.set(0, rl.a + flip, 0);
      dummy.scale.set(rl.stretch, 1, 1);
      dummy.updateMatrix();
      railMesh.setMatrixAt(i, dummy.matrix);
      railMesh.setColorAt(i, col.setScalar(1 + (hash01(67, i) * 2 - 1) * B.jitter));
    });
    for (const m of [postMesh, railMesh]) {
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
    }
    postMesh.name = 'balustrade:posts';
    railMesh.name = 'balustrade:rails';
    this.postMesh = postMesh;
    this.railMesh = railMesh;
  }

  _buildLanterns() {
    const L = CONFIG.map.lanterns;
    const part = buildPart(lanternBoxes(), MAP_PALETTE, { voxelSize: ENV_VOXEL, seed: 71, name: 'lantern' });
    const n = L.count;
    this.lanterns = [];
    const dummy = new THREE.Object3D();
    const opaque = new THREE.InstancedMesh(part.opaqueMesh.geometry, part.opaqueMesh.material, n);
    const fire = new THREE.InstancedMesh(part.emissiveMesh.geometry, part.emissiveMesh.material, n);
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const deg = L.angleOffsetDeg + (i * 360) / n;
      const dir = arenaDir(deg);
      dummy.position.copy(dir).multiplyScalar(L.radius);
      dummy.rotation.set(0, deg * DEG, 0);
      dummy.updateMatrix();
      opaque.setMatrixAt(i, dummy.matrix);
      fire.setMatrixAt(i, dummy.matrix);
      fire.setColorAt(i, col.setScalar(L.emissive));
      this.lanterns.push({
        angleDeg: deg,
        position: dummy.position.clone(),
        fire: dummy.position.clone().setY(5 * ENV_VOXEL),
        phase: hash01(73, i) * 100,
        flicker: 1,
      });
    }
    opaque.castShadow = true;
    opaque.receiveShadow = true;
    fire.castShadow = false;
    opaque.name = 'lanterns';
    fire.name = 'lanterns:fire';
    fire.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.lanternMesh = opaque;
    this.fireMesh = fire;
    this.group.add(opaque, fire);

    // Real point lights on selected lanterns, nudged toward the arena.
    this.pointLights = [];
    for (const idx of L.pointLights.slice(0, 2)) {
      const lt = this.lanterns[idx % n];
      const light = new THREE.PointLight(L.lightColor, L.lightIntensity, L.lightDistance, L.lightDecay);
      light.position.copy(lt.position).multiplyScalar(0.94).setY(L.lightHeight);
      light.castShadow = false;
      light.userData.lantern = lt;
      this.pointLights.push(light);
      this.group.add(light);
    }

    // Fake light pools: additive radial decals on the rim/floor, clipped to the platform.
    const poolMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(L.poolColor) },
        uIntensity: { value: L.poolIntensity },
        uClip: { value: CONFIG.map.floor.rimOuterRadius + 0.5 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorld;
        varying float vFlicker;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          #ifdef USE_INSTANCING_COLOR
            vFlicker = instanceColor.r;
          #else
            vFlicker = 1.0;
          #endif
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uIntensity;
        uniform float uClip;
        varying vec2 vUv;
        varying vec3 vWorld;
        varying float vFlicker;
        void main() {
          if (length(vWorld.xz) > uClip) discard;
          float r = length(vUv - 0.5) * 2.0;
          float a = pow(max(1.0 - r, 0.0), 2.2);
          gl_FragColor = vec4(uColor * uIntensity * a * vFlicker, 1.0);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const poolGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const pools = new THREE.InstancedMesh(poolGeo, poolMat, n);
    for (let i = 0; i < n; i++) {
      const lt = this.lanterns[i];
      dummy.position.copy(lt.position).multiplyScalar(0.93).setY(L.poolHeight);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(L.poolRadius * 2);
      dummy.updateMatrix();
      pools.setMatrixAt(i, dummy.matrix);
      pools.setColorAt(i, col.setScalar(1));
    }
    pools.instanceColor.setUsage(THREE.DynamicDrawUsage);
    pools.renderOrder = 1;
    pools.name = 'lanterns:pools';
    this.poolMesh = pools;
    this.group.add(pools);

    this.embers = new Embers(this.lanterns.map((l) => ({ position: l.fire })));
    this.group.add(this.embers.mesh);
  }

  update(worldDt, worldTime, wind) {
    const L = CONFIG.map.lanterns;
    const fc = this.fireMesh.instanceColor.array;
    const pc = this.poolMesh.instanceColor.array;
    for (let i = 0; i < this.lanterns.length; i++) {
      const lt = this.lanterns[i];
      const t = worldTime * L.flickerSpeed + lt.phase;
      const n = Math.sin(t) * 0.5 + Math.sin(t * 2.3 + 1.7) * 0.3 + Math.sin(t * 5.9 + 0.4) * 0.2;
      lt.flicker = 1 + L.flickerAmount * n;
      const e = L.emissive * lt.flicker;
      fc[i * 3] = e; fc[i * 3 + 1] = e; fc[i * 3 + 2] = e;
      pc[i * 3] = lt.flicker; pc[i * 3 + 1] = lt.flicker; pc[i * 3 + 2] = lt.flicker;
    }
    this.fireMesh.instanceColor.needsUpdate = true;
    this.poolMesh.instanceColor.needsUpdate = true;
    this.poolMesh.material.uniforms.uIntensity.value = L.poolIntensity;
    for (const light of this.pointLights) {
      light.intensity = L.lightIntensity * light.userData.lantern.flicker;
      light.distance = L.lightDistance;
    }
    this.embers.update(worldDt, worldTime, wind.velocity);
  }
}
