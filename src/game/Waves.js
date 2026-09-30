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

  _startWave(w) {
    this.wave = w;
    this.total = this.countFor(w);
    this.toSpawn = this.total;
    this.killed = 0;
    this.spawnTimer = 0.3;
    this.state = 'running';
  }

  // Debug N: clear the field and start the next wave now.
  skip() {
    this.game.killAll(false);
    this.game.cancelPendingSpawns();
    this._startWave(this.wave + 1);
    this.game.hud.banner(`WAVE ${this.wave}`);
  }

  onKill(enemy) {
    if (enemy.wave === this.wave) this.killed++;
  }

  update(dt) {
    if (!this.enabled || dt <= 0 || this.game.hero.dead) return;
    const W = CONFIG.waves;
    const g = this.game;
    if (this.state === 'intro' || this.state === 'break') {
      this.timer -= dt;
      if (this.timer <= 0) this._startWave(this.wave + 1);
      return;
    }
    // running
    this.spawnTimer -= dt;
    const alive = g.aliveCount();
    if (this.toSpawn > 0 && alive < W.maxAlive && this.spawnTimer <= 0) {
      this.toSpawn--;
      this.spawnTimer = W.spawnInterval;
      g.spawnEnemy(this._pickType(), { wave: this.wave, scale: this.scaleFor(this.wave) });
    }
    if (this.toSpawn === 0 && this.killed >= this.total && g.aliveCount() === 0) {
      // Cleared: breather, heal, banner for the next wave.
      this.state = 'break';
      this.timer = W.breakTime;
      g.hero.heal(g.hero.stats.maxHp * W.breakHeal);
      g.hud.banner(`WAVE ${this.wave + 1}`, `wave ${this.wave} cleared · +${Math.round(W.breakHeal * 100)}% HP`);
    }
  }
}
