import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Renderer, scene and resize handling (spec §12).
export class Engine {
  constructor(container) {
    this.container = container;
    const R = CONFIG.render;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, R.pixelRatioMax));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = R.exposure;
    renderer.shadowMap.enabled = true;
    // PCFSoftShadowMap is removed in current three.js; PCFShadowMap + light.shadow.radius is the soft path.
    renderer.shadowMap.type = THREE.PCFShadowMap;
    // PostFX renders the scene more than once for the hero mask; shadows are refreshed explicitly once per frame.
    renderer.shadowMap.autoUpdate = false;
    // Draw calls are summed across all passes of a frame; the loop resets them.
    renderer.info.autoReset = false;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(new THREE.Color(R.fogColor), R.fogDensity);
    scene.background = makeGradientSky(R.skyTop, R.skyHorizon);
    this.scene = scene;

    this.width = container.clientWidth;
    this.height = container.clientHeight;
    this._resizeHandlers = [];
    window.addEventListener('resize', () => this._onResize());
  }

  onResize(fn) {
    this._resizeHandlers.push(fn);
    fn(this.width, this.height);
  }

  get pixelRatio() {
    return this.renderer.getPixelRatio();
  }

  // Re-apply render settings edited live in the debug panel.
  applySettings() {
    const R = CONFIG.render;
    this.renderer.toneMappingExposure = R.exposure;
    this.scene.fog.color.set(R.fogColor);
    this.scene.fog.density = R.fogDensity;
  }

  _onResize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.render.pixelRatioMax));
    this.renderer.setSize(this.width, this.height);
    for (const fn of this._resizeHandlers) fn(this.width, this.height);
  }
}

// Placeholder vertical gradient background (the real sky arrives in Stage 1).
function makeGradientSky(top, horizon) {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, top);
  g.addColorStop(1, horizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
