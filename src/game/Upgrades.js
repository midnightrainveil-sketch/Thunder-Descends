import { CONFIG } from '../config.js';

const ROMAN = ['I', 'II', 'III', 'IV'];

// Rank-up descriptions (the numbers themselves live in CONFIG.skills rank arrays / CONFIG.cards).
const SKILL_TEXT = {
  q: { title: () => CONFIG.names.q, icon: 'claw', ranks: ['', '+1 target and +0.5 m grab radius', '−1 s cooldown', 'Grabbed enemies take +30% damage while stunned'] },
  e: { title: () => CONFIG.names.e, icon: 'shatter', ranks: ['', () => `${CONFIG.names.overdrive} lasts +0.4 s`, 'Thrust range +1.5 m and width +0.4 m', () => `${CONFIG.names.overdrive} slashes chain lightning to a nearby enemy`] },
  r: { title: () => CONFIG.names.r, icon: 'demontime', ranks: ['', 'Buff lasts +2 s', 'Release pulse ×2 damage and +2 m radius', 'Kills during the buff extend it by 0.5 s (max +4 s)'] },
};
const txt = (v) => (typeof v === 'function' ? v() : v);
const PASSIVE_TEXT = ['', 'Crit damage +30%', 'Whip reach +1.5 m', 'Crits heal 1% max HP'];

/**
 * Level-up card pool (spec §10): skill rank-ups II–IV, passive II–IV, and stat cards (ATK +10%,
 * max HP +12%, attack speed +8%; each at most 5 times). Maxed options leave the pool.
 * Each card: { id, kind, icon, title, desc, rank, maxRank, apply() } — rank = current, the card
 * raises it by one.
 */
export function upgradePool(game) {
  const hero = game.hero;
  const S = hero.skills;
  const K = CONFIG.cards;
  const pool = [];
  for (const key of ['q', 'e', 'r']) {
    const sk = S[key];
    if (sk.rank >= 4) continue;
    const T = SKILL_TEXT[key];
    pool.push({ id: `skill-${key}`, kind: 'skill', icon: T.icon, title: `${T.title()} ${ROMAN[sk.rank]}`, desc: txt(T.ranks[sk.rank]), rank: sk.rank, maxRank: 4, apply: () => sk.rank++ });
  }
  if (hero.passiveRank < 4) {
    const r = hero.passiveRank;
    pool.push({
      id: 'passive', kind: 'passive', icon: 'passive', title: `${CONFIG.names.passive} ${ROMAN[r]}`, desc: PASSIVE_TEXT[r], rank: r, maxRank: 4,
      apply: () => {
        hero.passiveRank++;
        if (hero.passiveRank === 2) hero.stats.critDamage += K.passiveCritDamage;
        if (hero.passiveRank === 3) hero.whipReachBonus = K.passiveWhipReach;
      },
    });
  }
  const stat = (id, icon, title, desc, applyFn) => {
    const n = hero.statCards[id];
    if (n < K.statMax) pool.push({ id: `stat-${id}`, kind: 'stat', icon, title, desc, rank: n, maxRank: K.statMax, apply: () => ((hero.statCards[id] += 1), applyFn()) });
  };
  stat('atk', 'atk', 'Power', `ATK +${Math.round(K.atk * 100)}%`, () => (hero.stats.atk *= 1 + K.atk));
  stat('hp', 'hp', 'Vitality', `Max HP +${Math.round(K.hp * 100)}%`, () => {
    const add = hero.stats.maxHp * K.hp;
    hero.stats.maxHp += add;
    hero.heal(add);
  });
  stat('aspd', 'aspd', 'Swiftness', `Attack speed +${Math.round(K.attackSpeed * 100)}%`, () => (hero.stats.attackSpeed += K.attackSpeed));
  return pool;
}

// Three distinct random cards (fewer if the pool is nearly exhausted).
export function rollCards(game, n = 3) {
  const pool = upgradePool(game);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}
