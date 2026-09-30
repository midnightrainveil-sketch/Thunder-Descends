import * as THREE from 'three';
import { CONFIG, ARENA_RADIUS } from '../config.js';

// Night lighting (spec §4): dim blue hemisphere fill, cool moonlight (only shadow caster)
// with a shadow frustum fitted tightly around the arena, and a subtle back/rim light.
export class Lighting {
  constructor(scene) {
    const L = CONFIG.lighting;
    this.hemi = new THREE.HemisphereLight(L.hemiSky, L.hemiGround, L.hemiIntensity);
    this.hemi.name = 'hemiFill';

    this.moon = new THREE.DirectionalLight(L.moonColor, L.moonIntensity);
    this.moon.name = 'moonlight';
    this.moon.castShadow = true;
    this.moon.target.position.set(0, 0, 0);

    this.rim = new THREE.DirectionalLight(L.rimColor, L.rimIntensity);
    this.rim.name = 'rimLight';
    this.rim.castShadow = false;

    scene.add(this.hemi, this.moon, this.moon.target, this.rim, this.rim.target);
    this.applySettings();
  }

  applySettings() {
    const L = CONFIG.lighting;
    this.hemi.color.set(L.hemiSky);
    this.hemi.groundColor.set(L.hemiGround);
    this.hemi.intensity = L.hemiIntensity;

    this.moon.color.set(L.moonColor);
    this.moon.intensity = L.moonIntensity;
    const d = new THREE.Vector3(L.moonDir.x, L.moonDir.y, L.moonDir.z).normalize();
    this.moon.position.copy(d).multiplyScalar(L.moonDistance);
    this.moon.target.updateMatrixWorld();
    this.moon.updateMatrixWorld();

    this.rim.color.set(L.rimColor);
    this.rim.intensity = L.rimIntensity;
    this.rim.position.set(L.rimDir.x, L.rimDir.y, L.rimDir.z).normalize().multiplyScalar(L.moonDistance);

    this._fitShadow();
  }

  // Fit the orthographic shadow camera to the light-space bounds of the arena cylinder.
  _fitShadow() {
    const L = CONFIG.lighting;
    const sh = this.moon.shadow;
    if (sh.mapSize.x !== L.shadowMapSize) {
      sh.mapSize.set(L.shadowMapSize, L.shadowMapSize);
      sh.map?.dispose();
      sh.map = null;
    }
    sh.bias = L.shadowBias;
    sh.normalBias = L.shadowNormalBias;
    sh.radius = L.shadowRadius;

    const view = new THREE.Matrix4().lookAt(this.moon.position, this.moon.target.position, new THREE.Vector3(0, 1, 0));
    view.setPosition(this.moon.position);
    const inv = view.clone().invert();
    const r = ARENA_RADIUS + L.shadowMargin;
    const p = new THREE.Vector3();
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity, zmin = Infinity, zmax = -Infinity;
    const steps = 48;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      for (const y of [-0.5, L.shadowHeight]) {
        p.set(Math.sin(a) * r, y, Math.cos(a) * r).applyMatrix4(inv);
        xmin = Math.min(xmin, p.x); xmax = Math.max(xmax, p.x);
        ymin = Math.min(ymin, p.y); ymax = Math.max(ymax, p.y);
        zmin = Math.min(zmin, p.z); zmax = Math.max(zmax, p.z);
      }
    }
    const cam = sh.camera;
    cam.left = xmin;
    cam.right = xmax;
    cam.bottom = ymin;
    cam.top = ymax;
    // Camera looks down −Z in its own space: distances are −z.
    cam.near = Math.max(0.1, -zmax - 2);
    cam.far = -zmin + 2;
    cam.updateProjectionMatrix();
  }
}
