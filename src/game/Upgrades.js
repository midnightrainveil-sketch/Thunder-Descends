import { CONFIG } from '../config.js';

const ROMAN = ['I', 'II', 'III', 'IV'];
const RARITIES = ['common', 'rare', 'epic', 'legendary'];
const txt = (v) => (typeof v === 'function' ? v() : v);
const pct = (v) => `${Math.round(v * 100)}%`;

// Rank-up descriptions (the numbers themselves live in CONFIG.skills rank arrays / CONFIG.cards).
const SKILL_TEXT = {
  q: { title: () => CONFIG.names.q, icon: 'claw', ranks: ['', '+1 target and +0.5 m grab radius', '−1 s cooldown', 'Grabbed enemies take +30% damage while stunned'] },
  e: { title: () => CONFIG.names.e, icon: 'shatter', ranks: ['', () => `${CONFIG.names.overdrive} lasts +0.4 s`, 'Thrust range +1.5 m and width +0.4 m', () => `${CONFIG.names.overdrive} slashes chain lightning to a nearby enemy`] },
  r: { title: () => CONFIG.names.r, icon: 'demontime', ranks: ['', 'Buff lasts +2 s', 'Release pulse ×2 damage and +2 m radius', 'Kills during the buff extend it by 0.5 s (max +4 s)'] },
};
const PASSIVE_TEXT = ['', 'Crit damage +30%', 'Whip reach +1.5 m', 'Crits heal 1% max HP'];

// Special cards: fixed rarity, a cap on how often they can be taken, and an effect on hero.bonus.
const SPECIALS = [
  { id: 'leech', rarity: 'rare', max: 3, icon: 'leech', title: 'Vampiric Edge', desc: () => `+${pct(CONFIG.cards.leech)} lifesteal`, apply: (h) => (h.bonus.lifesteal += CONFIG.cards.leech) },
  { id: 'strikeDmg', rarity: 'rare', max: 2, icon: 'strike', title: 'Thunder Lunge', desc: () => `Dash strike damage +${pct(CONFIG.cards.strikeDmg)}`, apply: (h) => (h.bonus.strikeMul += CONFIG.cards.strikeDmg) },
  { id: 'extraDash', rarity: 'epic', max: 1, icon: 'dash', title: 'Spare Capacitor', desc: '+1 dash charge', apply: (h) => ((h.bonus.dashCharges += 1), (h.dash.charges += 1)) },
  { id: 'thunderStep', rarity: 'epic', max: 1, icon: 'step', title: 'Thunder Step', desc: () => `Dashing through enemies zaps them for ${CONFIG.cards.thunderStepMult}×ATK`, apply: (h) => (h.bonus.thunderStep = true) },
  { id: 'timeThief', rarity: 'epic', max: 1, icon: 'time', title: 'Time Thief', desc: () => `Every kill cuts skill cooldowns by ${CONFIG.cards.timeThief} s`, apply: (h) => (h.bonus.timeThief = true) },
  { id: 'stormCaller', rarity: 'legendary', max: 1, icon: 'storm', title: 'Storm Caller', desc: () => `Every ${CONFIG.cards.stormEvery}th hit calls lightning down: ${CONFIG.cards.stormMult}×ATK around the target`, apply: (h) => (h.bonus.stormCaller = true) },
  { id: 'secondWind', rarity: 'legendary', max: 1, icon: 'wind', title: 'Second Wind', desc: () => `Once per run, a lethal hit leaves you at ${pct(CONFIG.cards.secondWindHp)} HP instead`, apply: (h) => (h.bonus.secondWind = true) },
];

/**
 * Level-up card pool (spec §10). Cards have a rarity (common / rare / epic / legendary):
 *  - stat cards (Power / Vitality / Swiftness) roll their rarity, which scales their strength;
 *  - skill rank-ups are rare, the passive epic;
 *  - special cards (lifesteal, dash strike damage, extra dash, Thunder Step, Time Thief, Storm
 *    Caller, Second Wind) have a fixed rarity and a cap.
 * Each card: { id, kind, rarity, icon, title, desc, rank, maxRank, apply() }.
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
    pool.push({ id: `skill-${key}`, kind: 'skill', rarity: 'rare', icon: T.icon, title: `${T.title()} ${ROMAN[sk.rank]}`, desc: txt(T.ranks[sk.rank]), rank: sk.rank, maxRank: 4, apply: () => sk.rank++ });
  }
  if (hero.passiveRank < 4) {
    const r = hero.passiveRank;
    pool.push({
      id: 'passive', kind: 'passive', rarity: 'epic', icon: 'passive', title: `${CONFIG.names.passive} ${ROMAN[r]}`, desc: PASSIVE_TEXT[r], rank: r, maxRank: 4,
      apply: () => {
        hero.passiveRank++;
        if (hero.passiveRank === 2) hero.stats.critDamage += K.passiveCritDamage;
        if (hero.passiveRank === 3) hero.whipReachBonus = K.passiveWhipReach;
      },
    });
  }
  // Stat cards: rarity is rolled when dealt (see rollCards) and scales the bonus.
  const stat = (id, icon, title, descFn, applyFn) => {
    const n = hero.statCards[id];
    if (n >= K.statMax) return;
    pool.push({
      id: `stat-${id}`, kind: 'stat', rarity: null, icon, title, rank: n, maxRank: K.statMax,
      describe: (m) => descFn(m),
      applyWith: (m) => ((hero.statCards[id] += 1), applyFn(m)),
    });
  };
  stat('atk', 'atk', 'Power', (m) => `ATK +${pct(K.atk * m)}`, (m) => (hero.stats.atk *= 1 + K.atk * m));
  stat('hp', 'hp', 'Vitality', (m) => `Max HP +${pct(K.hp * m)}`, (m) => {
    const add = hero.stats.maxHp * K.hp * m;
    hero.stats.maxHp += add;
    hero.heal(add);
  });
  stat('aspd', 'aspd', 'Swiftness', (m) => `Attack speed +${pct(K.attackSpeed * m)}`, (m) => (hero.stats.attackSpeed += K.attackSpeed * m));
  for (const c of SPECIALS) {
    const n = hero.specialCards[c.id] || 0;
    if (n >= c.max) continue;
    pool.push({
      id: `special-${c.id}`, kind: 'special', rarity: c.rarity, icon: c.icon, title: c.title, desc: txt(c.desc), rank: n, maxRank: c.max,
      apply: () => {
        hero.specialCards[c.id] = n + 1;
        c.apply(hero);
      },
    });
  }
  return pool;
}

// Rarity odds; a higher style rank at level-up shifts weight toward epic and legendary.
function rollRarity(rankIndex) {
  const R = CONFIG.cards.rarity;
  const K = CONFIG.cards;
  const w = {
    common: R.common.weight,
    rare: R.rare.weight,
    epic: R.epic.weight + K.rankLuckEpic * rankIndex,
    legendary: R.legendary.weight + K.rankLuckLegendary * rankIndex,
  };
  let r = Math.random() * (w.common + w.rare + w.epic + w.legendary);
  for (const k of RARITIES) {
    r -= w[k];
    if (r <= 0) return k;
  }
  return 'common';
}

/**
 * Deal `n` distinct cards. Each slot rolls a rarity, then takes a random card of that rarity (stat
 * cards fit any rarity); if none is left at that rarity it steps down, then up.
 */
export function rollCards(game, n = 3) {
  const pool = upgradePool(game);
  const rankIndex = game.score?.rank ?? 0;
  const out = [];
  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  shuffle(pool);
  for (let k = 0; k < n && pool.length; k++) {
    const want = RARITIES.indexOf(rollRarity(rankIndex));
    const order = [want, ...[want - 1, want - 2, want - 3].filter((x) => x >= 0), ...[want + 1, want + 2, want + 3].filter((x) => x < 4)];
    let pick = -1;
    let rarity = 'common';
    for (const ri of order) {
      const r = RARITIES[ri];
      pick = pool.findIndex((c) => c.rarity === r || c.rarity === null);
      if (pick >= 0) {
        rarity = pool[pick].rarity ?? r;
        break;
      }
    }
    if (pick < 0) break;
    const c = pool.splice(pick, 1)[0];
    if (c.kind === 'stat') {
      const m = CONFIG.cards.rarity[rarity].mult;
      out.push({ ...c, rarity, desc: c.describe(m), apply: () => c.applyWith(m) });
    } else out.push(c);
  }
  return out;
}
