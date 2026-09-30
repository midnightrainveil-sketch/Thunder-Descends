import { CONFIG } from '../config.js';

// Layered game clock (spec §12).
//  - realDt: wall-clock frame delta, clamped. UI and camera shake use it.
//  - worldDt: enemies, projectiles, world particles, petals, tree sway, lanterns.
//  - heroDt: the hero, his skills, his FX and cooldowns.
// worldTime / heroTime accumulate the scaled deltas so shaders can freeze with them.
export class GameTime {
  constructor() {
    this.realDt = 0;
    this.worldDt = 0;
    this.heroDt = 0;

    this.realTime = 0;
    this.worldTime = 0;
    this.heroTime = 0;

    this.worldScale = 1;
    this.heroScale = 1;
    this.debugScale = 1; // debug T hotkey multiplier on both clocks
    this.paused = false;

    this.hitstopRemaining = 0;
    this.hitstopLocked = false; // Demontime cast sets this so hitstop can't interrupt it

    // Active scale tweens per layer, driven in real time.
    this._tweens = { world: null, hero: null };
  }

  // Freeze both clocks briefly (hit feel). Ignored while hitstopLocked.
  hitstop(duration) {
    if (this.hitstopLocked) return;
    this.hitstopRemaining = Math.max(this.hitstopRemaining, duration);
  }

  // Smoothly move a layer's scale ('world' | 'hero' | 'both') to target over duration real seconds.
  tweenScale(layer, target, duration = 0) {
    if (layer === 'both') {
      this.tweenScale('world', target, duration);
      this.tweenScale('hero', target, duration);
      return;
    }
    const key = layer === 'hero' ? 'heroScale' : 'worldScale';
    if (duration <= 0) {
      this[key] = target;
      this._tweens[layer] = null;
      return;
    }
    this._tweens[layer] = { key, from: this[key], to: target, t: 0, duration };
  }

  update(rawDt) {
    const realDt = Math.min(Math.max(rawDt, 0), CONFIG.time.maxDt);
    this.realDt = realDt;
    this.realTime += realDt;

    if (this.paused) {
      this.worldDt = 0;
      this.heroDt = 0;
      return;
    }

    for (const layer in this._tweens) {
      const tw = this._tweens[layer];
      if (!tw) continue;
      tw.t += realDt;
      const k = Math.min(tw.t / tw.duration, 1);
      const e = k * k * (3 - 2 * k); // smoothstep
      this[tw.key] = tw.from + (tw.to - tw.from) * e;
      if (k >= 1) this._tweens[layer] = null;
    }

    let worldDt = realDt * this.worldScale * this.debugScale;
    let heroDt = realDt * this.heroScale * this.debugScale;

    if (this.hitstopRemaining > 0) {
      this.hitstopRemaining = Math.max(0, this.hitstopRemaining - realDt);
      if (!this.hitstopLocked) {
        worldDt = 0;
        heroDt = 0;
      }
    }

    this.worldDt = worldDt;
    this.heroDt = heroDt;
    this.worldTime += worldDt;
    this.heroTime += heroDt;
  }
}
