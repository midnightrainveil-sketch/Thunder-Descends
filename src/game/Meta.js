import { CONFIG } from '../config.js';
import { save } from './Save.js';

/**
 * Armory: permanent upgrades bought with Thunder Cores between runs. Each upgrade has a few levels
 * with growing cost; buying them all is the long-term goal ("Fully Forged" achievement). The bonuses
 * are applied to the hero at the start of every run (`applyToHero`).
 */
export const meta = {
  defs: () => CONFIG.meta.upgrades,
  def(id) {
    return CONFIG.meta.upgrades.find((u) => u.id === id);
  },
  level(id) {
    return save.data.upgrades[id] || 0;
  },
  cost(id) {
    const d = this.def(id);
    return Math.round(d.cost * Math.pow(CONFIG.meta.costGrowth, this.level(id)));
  },
  maxed(id) {
    return this.level(id) >= this.def(id).max;
  },
  allMaxed() {
    return CONFIG.meta.upgrades.every((u) => this.maxed(u.id));
  },
  canBuy(id) {
    return !this.maxed(id) && save.data.cores >= this.cost(id);
  },
  buy(id) {
    if (!this.canBuy(id)) return false;
    save.data.cores -= this.cost(id);
    save.data.upgrades[id] = this.level(id) + 1;
    save.write();
    return true;
  },
  // Permanent bonuses → the hero's fresh stats for a new run.
  applyToHero(hero) {
    const v = (id) => this.level(id) * this.def(id).value;
    const S = hero.stats;
    S.maxHp *= 1 + v('hp');
    S.hp = S.maxHp;
    S.atk *= 1 + v('atk');
    S.critRate = Math.min(1, S.critRate + v('crit'));
    hero.bonus.dashRechargeMul *= 1 - v('dash');
    hero.bonus.cooldownMul *= 1 - v('cd');
    hero.bonus.lifesteal += v('leech');
    hero.bonus.dashCharges += this.level('dash4');
    hero.dash.refill();
  },
  startCards() {
    return this.level('start');
  },
};
