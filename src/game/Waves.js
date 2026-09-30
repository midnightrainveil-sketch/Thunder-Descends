import { CONFIG } from '../config.js';

/**
 * Wave director (spec §9). Wave w has 3 + floor(1.2·w) enemies, spawned one at a time through the
 * spawn telegraph while fewer than `maxAlive` are alive (telegraphs in flight count as alive).
 * Enemies scale per wave (HP ×1.14^(w−1), damage ×1.07^(w−1), speed +1.5%/wave up to +30%).
 * When a wave is cleared: 2.5 s breather, heal 20% max HP, "Wave N" banner, next wave.
 * Boss waves (5/10/15) arrive in Stage 5; until then they are regular waves. World clock.
 */
export class Waves {
  constructor(game) {
    this.game = game;
    this.enabled = true;
    this.reset();
  }

  reset() {
    this.demoWave = 15;
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

  scaleFor(w) {
    const W = CONFIG.waves;
    return {
      hp: Math.pow(W.hpGrowth, w - 1),
      dmg: Math.pow(W.dmgGrowth, w - 1),
      speed: 1 + Math.min(W.speedMax, W.speedPerWave * (w - 1)),
    };
  }

  countFor(w) {
    const W = CONFIG.waves;
    return W.countBase + Math.floor(W.countPerWave * w);
  }

  get remaining() {
    return this.total - this.killed;
  }

  _pickType() {
    const W = CONFIG.waves;
    const pool = Object.keys(W.unlock).filter((t) => this.wave >= W.unlock[t]);
    const sum = pool.reduce((s, t) => s + W.weights[t], 0);
    let r = Math.random() * sum;
    for (const t of pool) {
      r -= W.weights[t];
      if (r <= 0) return t;
    }
    return pool[0];
  }

  // Boss waves every 5 (5 Juggernaut, 10 Kitsune, 15 Raiju, then they repeat with more HP).
  bossFor(w) {
    if (w % 5 !== 0) return null;
    const i = w / 5 - 1;
    return { type: ['juggernaut', 'kitsune', 'raiju'][i % 3], loop: Math.floor(i / 3) };
  }

  _startWave(w) {
    this.wave = w;
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
      // Wave 15 boss down (first time) → Demo clear screen; continuing resumes with the next wave.
      if (this.wave === this.demoWave && !this.demoCleared) {
        this.demoCleared = true;
        this.state = 'demo';
        this.timer = 1.6; // let the boss shatter and EXP burst play out first
        return;
      }
      // Cleared: breather, heal, banner for the next wave.
      this.state = 'break';
      this.timer = W.breakTime;
      g.hero.heal(g.hero.stats.maxHp * W.breakHeal);
      const nb = this.bossFor(this.wave + 1);
      g.hud.banner(`Wave ${this.wave + 1}`, nb ? 'boss wave' : `wave ${this.wave} cleared · +${Math.round(W.breakHeal * 100)}% HP`);
    }
  }
}
