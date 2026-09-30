import * as THREE from 'three';
import { CONFIG } from '../config.js';

const _v = new THREE.Vector3();

/**
 * EXP and levels (spec §10). EXP to next = 40 + 25·(L−1). Level-up: +8% ATK, +5% max HP, heal 25%,
 * "Level up" burst, and one pending upgrade card (the card picker arrives in Stage 5).
 */
export class Progression {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.level = 1;
    this.exp = 0;
    this.pendingUpgrades = 0;
  }

  get expToNext() {
    const P = CONFIG.progression;
    return P.expBase + P.expPerLevel * (this.level - 1);
  }

  addExp(amount) {
    this.exp += amount;
    while (this.exp >= this.expToNext) {
      this.exp -= this.expToNext;
      this.levelUp();
    }
  }

  levelUp() {
    const P = CONFIG.progression;
    const g = this.game;
    const S = g.hero.stats;
    this.level++;
    S.atk *= 1 + P.atkGain;
    S.maxHp *= 1 + P.hpGain;
    g.hero.heal(S.maxHp * P.levelHeal);
    this.pendingUpgrades++;
    // Burst: cyan rings, rising sparks, label.
    const p = g.hero.position;
    g.fx.shock.ring(p, { r0: 0.3, r1: 3.2, duration: 0.5, color: '#35e0ff', intensity: 2.6, thickness: 0.2, clock: 'hero' });
    g.fx.shock.ring(p, { r0: 0.1, r1: 1.8, duration: 0.35, color: '#ffffff', intensity: 1.6, thickness: 0.3, clock: 'hero' });
    g.fx.particles.sparks(_v.set(p.x, 0.3, p.z), _v.clone().set(0, 1, 0), 26, { color: '#8ff4ff', intensity: 3.5, speed: 8, spread: 0.6, life: 0.6, clock: 'hero' });
    g.fx.numbers.show(_v.set(p.x, 2.7, p.z), 'LEVEL UP', 'label', { color: '#8ff4ff' });
    g.hud.flashLevel();
  }
}
