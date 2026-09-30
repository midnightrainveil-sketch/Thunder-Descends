import { Thunderclaw } from './Thunderclaw.js';
import { Shatter } from './Shatter.js';
import { Demontime } from './Demontime.js';

/**
 * Owns the hero's three skills (Q / E / R). One skill at a time; a basic attack can be cancelled
 * into a skill once its hit has come out; no casting while dead or stunned. Cooldowns tick on the
 * hero clock × cooldownRate (×2 during the Demontime buff). The Demontime buff runs on its own
 * after the cast, so other skills can be used during it.
 */
export class SkillSystem {
  constructor(hero, game) {
    this.hero = hero;
    this.game = game;
    this.q = new Thunderclaw(this, 'Q', 'thunderclaw');
    this.e = new Shatter(this, 'E', 'shatter');
    this.r = new Demontime(this, 'R', 'demontime');
    this.list = [this.q, this.e, this.r];
    this.active = null;
  }

  get cooldownRate() {
    return this.r.buffActive ? this.r.cfg.cooldownRate : 1;
  }

  canCast(skill) {
    const h = this.hero;
    if (h.dead || h.stunT > 0 || this.active || !skill.ready) return false;
    if (!h.canCancelAttack()) return false;
    return skill.canCast();
  }

  tryCast(skill) {
    if (!this.canCast(skill)) return false;
    this.hero.interruptAttack();
    this.active = skill;
    skill.begin();
    return true;
  }

  // Every frame (real time, runs even during hitstop / slow-mo).
  handleInput(input, time) {
    if (input.wasPressed('KeyQ')) this.tryCast(this.q);
    if (input.wasPressed('KeyE')) this.tryCast(this.e);
    if (input.wasPressed('KeyR')) this.tryCast(this.r);
    this.active?.handleInput(input, time);
  }

  // Hero clock, after the hero's pose update.
  update(dt) {
    for (const s of this.list) s.tick(dt);
    this.active?.update(dt);
    this.r.updateBuff(dt);
  }

  resetCooldowns() {
    for (const s of this.list) s.cd = 0;
  }

  // Death / restart: stop everything and restore time, post-processing and the hero's nodes.
  reset() {
    this.active?.cancel();
    this.active = null;
    this.r.endBuff(false);
    this.hero.releaseControl();
  }
}
