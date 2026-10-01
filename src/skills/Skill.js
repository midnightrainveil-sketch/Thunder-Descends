import { CONFIG } from '../config.js';

// Rank value helper: config entries are either a number or an array indexed by rank − 1.
export const rankValue = (v, rank) => (Array.isArray(v) ? v[Math.min(v.length, Math.max(1, rank)) - 1] : v);

/**
 * Skill base (spec §7). A skill has a rank (1–4), a cooldown that ticks on the hero clock ×
 * SkillSystem.cooldownRate, and a small lifecycle driven by the SkillSystem:
 *   canCast() → begin() → update(dt) each hero frame (after the pose) → finish() / cancel().
 * Skills steer the hero through `hero.control` (move / aim / attack locks, base-layer ownership,
 * invulnerability, knockback immunity).
 */
export class Skill {
  constructor(system, key, cfg) {
    this.system = system;
    this.hero = system.hero;
    this.game = system.game;
    this.key = key;
    this.cfg = cfg;
    this.rank = CONFIG.skills.startRank;
    this.cd = 0;
    this.active = false;
    this.t = 0;
  }

  r(v) {
    return rankValue(v, this.rank);
  }

  get cooldownMax() {
    return this.r(this.cfg.cooldown) * (this.hero.bonus?.cooldownMul ?? 1);
  }

  get ready() {
    return this.cd <= 0;
  }

  startCooldown() {
    this.cd = this.cooldownMax;
  }

  tick(dt) {
    if (this.cd > 0) this.cd = Math.max(0, this.cd - dt * this.system.cooldownRate);
  }

  // Override: return false to refuse (e.g. nothing to do).
  canCast() {
    return true;
  }

  begin() {
    this.active = true;
    this.t = 0;
  }

  update(/* dt */) {}

  // Normal end of the skill: release the hero.
  finish() {
    this.active = false;
    this.hero.releaseControl();
    if (this.system.active === this) this.system.active = null;
  }

  // Hard stop (death, restart): must restore time, post and FX it touched.
  cancel() {
    if (this.active) this.finish();
  }

  // Real-time input while active (Q aiming).
  handleInput(/* input, time */) {}

  // HUD text.
  get label() {
    if (this.active) return 'active';
    return this.cd > 0 ? `${this.cd.toFixed(1)}s` : 'ready';
  }
}
