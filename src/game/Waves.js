import { CONFIG } from '../config.js';
import { audio } from '../audio/Audio.js';

/**
 * Wave director (spec §9). Waves alternate boss / basic: 1 Juggernaut, 2 basic, 3 Kitsune,
 * 4 basic, 5 Raiju → Demo clear; endless keeps alternating and the bosses repeat with more HP
 * and damage. A basic wave is scaled to level L = 1 + (w−1)·scaleStep: 4 + floor(0.6·L) enemies,
 * spawned one at a time through the spawn telegraph while fewer than `maxAlive` are alive
 * (telegraphs in flight count as alive), HP ×1.14^(L−1), damage ×1.07^(L−1), speed +1.5%/level up
 * to +30%, EXP +15%/level. When a wave is cleared: 2.5 s breather, heal (more after a boss),
 * "Wave N" banner, next wave. World clock.
 */
export class Waves {
  constructor(game) {
    this.game = game;
    this.enabled = true;
    this.reset();
  }

  reset() {
    this.demoWave = CONFIG.waves.demoWave;
    this.demoCleared = false;
    this.bossPending = null;
    this.bossWave = false;
    this.wave = 0;
    this.state = 'intro';
    this.timer = CONFIG.waves.firstDelay;
    this.toSpawn = 0;
    this.total = 0;
    this.killed = 0;
    this.spawnTimer = 0;
  }

  // Difficulty level of a basic wave (old per-wave scaling, `scaleStep` levels per wave).
  levelFor(w) {
    return 1 + (w - 1) * CONFIG.waves.scaleStep;
  }

  scaleFor(w) {
    const W = CONFIG.waves;
    const L = this.levelFor(w);
    return {
      hp: Math.pow(W.hpGrowth, L - 1),
      dmg: Math.pow(W.dmgGrowth, L - 1),
      speed: 1 + Math.min(W.speedMax, W.speedPerWave * (L - 1)),
      exp: 1 + W.expPerLevel * (L - 1),
    };
  }

  countFor(w) {
    const W = CONFIG.waves;
    return W.countBase + Math.floor(W.countPerWave * this.levelFor(w));
  }

  get remaining() {
    return this.total - this.killed;
  }

  _pickType() {
    const W = CONFIG.waves;
    const L = this.levelFor(this.wave);
    const pool = Object.keys(W.unlock).filter((t) => L >= W.unlock[t]);
    const sum = pool.reduce((s, t) => s + W.weights[t], 0);
    let r = Math.random() * sum;
    for (const t of pool) {
      r -= W.weights[t];
      if (r <= 0) return t;
    }
    return pool[0];
  }

  // Boss waves: 1 Juggernaut, 3 Kitsune, 5 Raiju, then they repeat (loop = repeat count).
  bossFor(w) {
    const W = CONFIG.waves;
    if (w < 1 || (w - 1) % W.bossEvery !== 0) return null;
    const i = (w - 1) / W.bossEvery;
    const order = W.bossOrder;
    return { type: order[i % order.length], loop: Math.floor(i / order.length) };
  }

  _startWave(w) {
    this.wave = w;
    this.game.score?.onWaveStart();
    audio.play('waveStart');
    this.killed = 0;
    this.spawnTimer = 0.3;
    this.state = 'running';
    const boss = this.bossFor(w);
    this.bossWave = !!boss;
    if (boss) {
      this.total = 1;
      this.toSpawn = 0;
      this.bossPending = { ...boss, t: 0.9 };
    } else {
      this.total = this.countFor(w);
      this.toSpawn = this.total;
    }
  }

  // Debug N: clear the field and start the next wave now.
  skip() {
    this.game.killAll(false);
    this.game.cancelPendingSpawns();
    this._startWave(this.wave + 1);
    this.game.hud.banner(`Wave ${this.wave}`, this.bossWave ? 'boss wave' : '');
  }

  onKill(enemy) {
    if (enemy.wave === this.wave) this.killed++;
  }

  update(dt) {
    if (!this.enabled || dt <= 0 || this.game.hero.dead) return;
    const W = CONFIG.waves;
    const g = this.game;
    if (this.state === 'demo') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'break';
        this.timer = W.breakTime;
        g.onDemoClear();
      }
      return;
    }
    if (this.state === 'intro' || this.state === 'break') {
      this.timer -= dt;
      if (this.timer <= 0) this._startWave(this.wave + 1);
      return;
    }
    // running
    if (this.bossPending) {
      this.bossPending.t -= dt;
      if (this.bossPending.t <= 0) {
        g.spawnBoss(this.bossPending.type, { wave: this.wave, loop: this.bossPending.loop });
        this.bossPending = null;
      }
      return;
    }
    this.spawnTimer -= dt;
    const alive = g.aliveCount();
    if (this.toSpawn > 0 && alive < W.maxAlive && this.spawnTimer <= 0) {
      this.toSpawn--;
      this.spawnTimer = W.spawnInterval;
      g.spawnEnemy(this._pickType(), { wave: this.wave, scale: this.scaleFor(this.wave) });
    }
    if (this.toSpawn === 0 && this.killed >= this.total && g.aliveCount() === 0) {
      // Last demo boss down (wave 5, first time) → Demo clear screen; continuing resumes with the next wave.
      if (this.wave === this.demoWave && !this.demoCleared) {
        g.score?.onWaveClear(this.wave);
        this.demoCleared = true;
        this.state = 'demo';
        this.timer = 1.6; // let the boss shatter and EXP burst play out first
        return;
      }
      // Cleared: breather, heal (more after a boss), banner for the next wave.
      g.score?.onWaveClear(this.wave);
      audio.play('waveClear');
      if (this.wave >= 10) g.achievements?.unlock('wave10');
      this.state = 'break';
      this.timer = W.breakTime;
      const heal = this.bossWave ? W.bossHeal : W.breakHeal;
      g.hero.heal(g.hero.stats.maxHp * heal);
      const nb = this.bossFor(this.wave + 1);
      g.hud.banner(`Wave ${this.wave + 1}`, nb ? `boss wave · +${Math.round(heal * 100)}% HP` : `wave ${this.wave} cleared · +${Math.round(heal * 100)}% HP`);
    }
  }
}
