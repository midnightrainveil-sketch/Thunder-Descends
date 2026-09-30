import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { mapUniforms } from './mapMaterials.js';

const DEG = Math.PI / 180;

// Night sky (spec §4). The fixed camera looks down 38°, so the "sky" is a stage-set: the dome's
// gradient is mapped onto view elevations that fall inside the frame (deep indigo at the top of the
// frame → lighter blue-violet toward the mist). Faint twinkling stars, a large pixel-art moon placed
// at a fixed screen position, a soft halo and thin cloud wisps drifting across it (world clock).
export class Sky {
  constructor(rig) {
    this.rig = rig;
    this.group = new THREE.Group();
    this.group.name = 'sky';
    const S = CONFIG.map.sky;

    this.domeUniforms = {
      uTop: { value: new THREE.Color(S.top) },
      uHorizon: { value: new THREE.Color(S.horizon) },
      uBottom: { value: new THREE.Color(S.bottom) },
      uTopElev: { value: S.topElevDeg * DEG },
      uHorizonElev: { value: S.horizonElevDeg * DEG },
      uStarDensity: { value: S.starDensity },
      uStarBrightness: { value: S.starBrightness },
      uStarTwinkle: { value: S.starTwinkle },
      uWorldTime: mapUniforms.uWorldTime,
    };
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(900, 48, 24),
      new THREE.ShaderMaterial({
        uniforms: this.domeUniforms,
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vDir = wp.xyz - cameraPosition;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uTop, uHorizon, uBottom;
          uniform float uTopElev, uHorizonElev, uStarDensity, uStarBrightness, uStarTwinkle, uWorldTime;
          varying vec3 vDir;
          float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
          void main() {
            vec3 d = normalize(vDir);
            float e = asin(clamp(d.y, -1.0, 1.0));
            float t = clamp((e - uHorizonElev) / (uTopElev - uHorizonElev), 0.0, 1.0);
            vec3 col = e < uHorizonElev
              ? mix(uHorizon, uBottom, clamp((uHorizonElev - e) / 0.2, 0.0, 1.0))
              : mix(uHorizon, uTop, smoothstep(0.0, 1.0, t));
            // Stars: sparse cells on the view sphere, only in the upper part of the gradient.
            vec3 p = d * 220.0;
            vec3 cell = floor(p);
            float h = hash(cell);
            if (h > 1.0 - uStarDensity) {
              vec3 f = fract(p) - 0.5;
              float s = 1.0 - smoothstep(0.08, 0.28, length(f.xy + f.z * 0.3));
              float tw = 0.6 + 0.4 * sin(uWorldTime * uStarTwinkle * (0.6 + h * 3.0) + h * 91.0);
              col += vec3(0.75, 0.82, 1.0) * s * tw * uStarBrightness * smoothstep(0.35, 0.9, t) * (0.4 + 0.6 * fract(h * 17.0));
            }
            gl_FragColor = vec4(col, 1.0);
          }
        `,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    );
    dome.name = 'sky:dome';
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    this.dome = dome;
    this.group.add(dome);

    // Moon: pixel-art disc on a camera-facing quad.
    this.moonUniforms = {
      uColor: { value: new THREE.Color(S.moon.color) },
      uIntensity: { value: S.moon.intensity },
      uPixels: { value: S.moon.pixels },
    };
    this.moon = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        uniforms: this.moonUniforms,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uIntensity, uPixels;
          varying vec2 vUv;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
          void main() {
            vec2 q = (floor(vUv * uPixels) + 0.5) / uPixels;
            vec2 c = q - 0.5;
            float r = length(c) * 2.0;
            if (r > 1.0) discard;
            vec2 cellId = floor(vUv * uPixels);
            // Chunky craters: a few darker pixels in blobs + soft limb darkening.
            float crater = step(0.8, hash(floor(cellId / 2.0) + 3.0)) * 0.12 + step(0.9, hash(cellId)) * 0.07;
            float limb = mix(1.0, 0.82, r * r);
            gl_FragColor = vec4(uColor * uIntensity * (limb - crater), 1.0);
          }
        `,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    );
    this.moon.name = 'sky:moon';
    this.moon.renderOrder = -8;
    this.group.add(this.moon);

    this.halo = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        uniforms: { uColor: this.moonUniforms.uColor, uIntensity: { value: S.moon.haloIntensity } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uIntensity;
          varying vec2 vUv;
          void main() {
            float r = length(vUv - 0.5) * 2.0;
            float a = pow(max(1.0 - r, 0.0), 2.6) * uIntensity;
            gl_FragColor = vec4(uColor * a, 1.0);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    );
    this.halo.name = 'sky:halo';
    this.halo.renderOrder = -9;
    this.group.add(this.halo);

    // Thin cloud wisps near the moon: pixelated streaks drifting sideways.
    this.cloudUniforms = { uWorldTime: mapUniforms.uWorldTime, uOpacity: { value: S.clouds.opacity } };
    const cloudMat = new THREE.ShaderMaterial({
      uniforms: this.cloudUniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
        }
        void main() {
          vec2 px = floor(vUv * vec2(64.0, 6.0)) / vec2(64.0, 6.0); // chunky pixels
          float n = noise(px * vec2(7.0, 3.0)) * 0.65 + noise(px * vec2(17.0, 5.0)) * 0.35;
          float band = smoothstep(0.0, 0.35, px.y) * smoothstep(1.0, 0.6, px.y);
          float ends = smoothstep(0.0, 0.2, px.x) * smoothstep(1.0, 0.8, px.x);
          float a = smoothstep(0.45, 0.7, n) * band * ends * uOpacity;
          gl_FragColor = vec4(vec3(0.42, 0.46, 0.66) * a, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    this.clouds = [];
    for (let i = 0; i < S.clouds.count; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), cloudMat);
      m.name = `sky:cloud${i}`;
      m.renderOrder = -7;
      m.userData = { offY: (i - (S.clouds.count - 1) / 2) * 0.55 + (i % 2 ? 0.15 : -0.1), phase: i * 1.7, speed: 0.6 + (i % 3) * 0.25 };
      this.clouds.push(m);
      this.group.add(m);
    }

    this.moonPosition = new THREE.Vector3();
    this.moonSize = 10;
    this.placeMoon();
  }

  // Place the moon at its configured NDC position in the fixed camera, at a fixed distance.
  placeMoon() {
    const S = CONFIG.map.sky;
    const cam = this.rig.pickCamera;
    cam.updateMatrixWorld(true);
    const p = new THREE.Vector3(S.moon.screen.x, S.moon.screen.y, 0.5).unproject(cam);
    const dir = p.sub(cam.position).normalize();
    this.moonPosition.copy(cam.position).addScaledVector(dir, S.moon.distance);
    const tanY = Math.tan((cam.fov * DEG) / 2);
    this.moonSize = S.moon.size * 2 * tanY * S.moon.distance;
    this.moonUniforms.uPixels.value = S.moon.pixels;
  }

  // Direction from the arena toward the moon on XZ (for the light azimuth).
  moonAzimuth(out = new THREE.Vector3()) {
    return out.set(this.moonPosition.x, 0, this.moonPosition.z).normalize();
  }

  update(worldTime, camera) {
    const S = CONFIG.map.sky;
    this.dome.position.copy(camera.position);
    this.moon.position.copy(this.moonPosition);
    this.moon.quaternion.copy(camera.quaternion);
    this.moon.scale.setScalar(this.moonSize);
    this.halo.position.copy(this.moonPosition).addScaledVector(camera.getWorldDirection(this._tmp || (this._tmp = new THREE.Vector3())), 5);
    this.halo.quaternion.copy(camera.quaternion);
    this.halo.scale.setScalar(this.moonSize * S.moon.halo);
    this.moonUniforms.uIntensity.value = S.moon.intensity;
    this.halo.material.uniforms.uIntensity.value = S.moon.haloIntensity;
    this.cloudUniforms.uOpacity.value = S.clouds.opacity;

    // Clouds drift along the camera's right axis across the moon and wrap.
    const right = this._right || (this._right = new THREE.Vector3());
    const up = this._up || (this._up = new THREE.Vector3());
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    const span = this.moonSize * 7;
    const toCam = this._toCam || (this._toCam = new THREE.Vector3());
    toCam.copy(camera.position).sub(this.moonPosition).normalize();
    for (const c of this.clouds) {
      const u = c.userData;
      const x = (((worldTime * S.clouds.speed * u.speed + u.phase * span * 0.3) % span) + span) % span - span / 2;
      c.position.copy(this.moonPosition)
        .addScaledVector(right, x)
        .addScaledVector(up, u.offY * this.moonSize)
        .addScaledVector(toCam, 20);
      c.quaternion.copy(camera.quaternion);
      c.scale.set(this.moonSize * S.clouds.width, this.moonSize * S.clouds.height, 1);
    }
  }
}
