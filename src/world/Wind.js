import * as THREE from 'three';
import { CONFIG } from '../config.js';

const DEG = Math.PI / 180;

// Global wind on the world clock: a base direction/strength plus smooth gusts.
// Petals read `velocity`; tree sway reads `dir` + `gust` through the shared map uniforms.
export class Wind {
  constructor() {
    this.dir = new THREE.Vector2(0, 1); // XZ unit vector the wind blows toward
    this.velocity = new THREE.Vector3(); // m/s, world
    this.gust = 0; // 0..1
    this.speed = 0;
    this.update(0, 0);
  }

  update(worldDt, worldTime) {
    const W = CONFIG.map.wind;
    const a = W.dirDeg * DEG;
    this.dir.set(Math.sin(a), Math.cos(a));
    const t = worldTime * W.gustFreq * Math.PI * 2;
    // Smooth, irregular gust envelope in 0..1.
    const n = 0.5 + 0.5 * (Math.sin(t) * 0.55 + Math.sin(t * 2.37 + 1.3) * 0.3 + Math.sin(t * 5.1 + 2.1) * 0.15);
    this.gust = Math.pow(Math.max(0, n), 3);
    this.speed = W.strength * (1 + W.gustStrength * this.gust);
    this.velocity.set(this.dir.x * this.speed, 0, this.dir.y * this.speed);
  }
}
