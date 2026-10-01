import { CONFIG } from '../config.js';
import { audio } from '../audio/Audio.js';

/**
 * Per-run score, combo and style rank (the moment-to-moment goal).
 *  - Combo: every landed hit extends it; it ends after `comboTimeout` s without a hit or when the
 *    hero is hurt. Multiplier 1 + 0.02 per hit (max ×2).
 *  - Style meter (0..1000) → ranks D C B A S SS SSS. Hits, crits, kills, skills, dash strikes and
 *    dodges fill it; it decays (faster at high ranks) and drops hard when the hero is hit. Repeating
 *    the same action over and over gains less, so mixing attacks, skills and dashes is rewarded.
 *  - Score: damage × (combo × rank multipliers), kill / boss / wave / flawless bonuses.
 * Events come from Combat / Game; `update(dt)` runs on the hero clock (pauses with the game).
 */
export class Score {
  constructor(game) {
    this.game = game;
    this.onFeed = null; // (text, color, points) => void
    this.onRank = null; // (rankIndex, up) => void
    this.reset();
  }

  reset() {
    this.score = 0;
    this.combo = 0;
    this.comboT = 0;
    this.maxCombo = 0;
    this.style = 0;
    this.rank = 0;
    this.bestRank = 0;
    this.kills = 0;
    this.bossKills = 0;
    this.dodges = 0;
    this.strikes = 0;
    this.hurtThisWave = false;
    this.flawlessWaves = 0;
    this.breakdown = { combat: 0, kills: 0, waves: 0, bosses: 0, flawless: 0 };
    this.lastAction = null;
    this.repeat = 0;
    this.settled = 0; // score already converted to cores (demo clear → continue)
    this.settledBosses = 0;
  }

  get ranks() {
    return CONFIG.score.ranks;
  }

  get rankDef() {
    return this.ranks[this.rank];
  }

  get comboMult() {
    const S = CONFIG.score;
    return Math.min(S.comboMax, 1 + this.combo * S.comboStep);
  }

  get mult() {
    return this.comboMult * this.rankDef.mult;
  }

  // 0..1 progress from the current rank toward the next.
  get rankProgress() {
    const r = this.ranks;
    const lo = r[this.rank].at;
    const hi = this.rank + 1 < r.length ? r[this.rank + 1].at : 1000;
    return Math.min(1, (this.style - lo) / Math.max(1, hi - lo));
  }

  _add(points, key) {
    const p = Math.round(points);
    this.score += p;
    if (key) this.breakdown[key] += p;
    return p;
  }

  _style(amount, action) {
    const St = CONFIG.score.style;
    if (amount > 0 && action) {
      if (action === this.lastAction) this.repeat++;
      else (this.lastAction = action), (this.repeat = 0);
      if (this.repeat >= St.repeatAfter) amount *= St.repeatMul;
    }
    this.style = Math.max(0, Math.min(1000, this.style + amount));
    this._updateRank();
  }

  _updateRank() {
    const r = this.ranks;
    let k = 0;
    for (let i = 0; i < r.length; i++) if (this.style >= r[i].at) k = i;
    if (k === this.rank) return;
    const up = k > this.rank;
    this.rank = k;
    if (up) {
      audio.play('rankUp', { rank: k });
      if (k > this.bestRank) this.bestRank = k;
      const ach = this.game.achievements;
      if (k >= 4) ach.unlock('rankS');
      if (k >= 6) ach.unlock('rankSSS');
    } else audio.play('rankDown');
    this.onRank?.(k, up);
  }

  update(dt) {
    if (dt <= 0) return;
    const S = CONFIG.score;
    if (this.combo > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
    const St = S.style;
    if (this.style > 0) {
      this.style = Math.max(0, this.style - (St.decay + St.decayRank * this.rank) * dt);
      this._updateRank();
    }
  }

  // ── Events ──────────────────────────────────────────────────────────────
  onHit(damage, { crit = false, skill = null, boss = false, strike = false } = {}) {
    const S = CONFIG.score;
    const St = S.style;
    this.combo++;
    this.comboT = S.comboTimeout;
    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
      if (this.combo >= 50) this.game.achievements.unlock('combo50');
      if (this.combo >= 150) this.game.achievements.unlock('combo150');
    }
    this._add(damage * S.damageScore * this.mult, 'combat');
    if (strike) return; // the dash strike awards its own style
    const base = (skill ? St.skillHit : crit ? St.crit : St.hit) * (boss ? 0.6 : 1) + (boss ? St.bossHit : 0);
    this._style(base, skill || (crit ? 'whip' : 'combo'));
  }

  onKill(enemy) {
    const S = CONFIG.score;
    this.kills++;
    this.game.achievements.unlock('firstBlood');
    const type = enemy.isBoss === false && enemy.clone ? 'clone' : enemy.type;
    const p = this._add((S.kill[type] ?? 120) * this.mult, 'kills');
    this._style(S.style.kill, null);
    this.onFeed?.('KILL', '#ffd166', p);
  }

  onBossKill(boss) {
    const S = CONFIG.score;
    this.bossKills++;
    const p = this._add(S.bossKill * (1 + (boss.loop || 0)) * this.rankDef.mult, 'bosses');
    this._style(300, null);
    this.onFeed?.(`${boss.name.toUpperCase()} DOWN`, '#ff4d6d', p);
    this.game.achievements.unlock(boss.type);
  }

  onStrike() {
    this.strikes++;
    this._style(CONFIG.score.style.dashStrike, 'strike');
    this.onFeed?.('DASH STRIKE', '#8ff4ff');
    if (this.strikes >= 10) this.game.achievements.unlock('strikes');
  }

  onDodge() {
    this.dodges++;
    this._style(CONFIG.score.style.dodge, 'dodge');
    audio.play('dodge');
    this.onFeed?.('DODGE', '#b9f6ff');
    if (this.dodges >= 15) this.game.achievements.unlock('dodges');
  }

  onHurt() {
    this.combo = 0;
    this.hurtThisWave = true;
    this._style(CONFIG.score.style.hurt, null);
  }

  onWaveStart() {
    this.hurtThisWave = false;
  }

  onWaveClear(wave) {
    const S = CONFIG.score;
    const p = this._add(S.waveClear * wave, 'waves');
    this.onFeed?.(`WAVE ${wave} CLEAR`, '#8ff4ff', p);
    if (!this.hurtThisWave) {
      this.flawlessWaves++;
      const f = this._add(S.flawless * wave, 'flawless');
      this.onFeed?.('FLAWLESS', '#ffd166', f);
      audio.play('flawless');
      this.game.achievements.unlock('flawless');
    }
    if (this.score >= 50000) this.game.achievements.unlock('score50');
    if (this.score >= 150000) this.game.achievements.unlock('score150');
  }
}
