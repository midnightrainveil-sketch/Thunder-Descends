import * as THREE from 'three';
import { CONFIG } from '../config.js';

const _v = new THREE.Vector3();
const _d = new THREE.Vector3();
const _h = new THREE.Vector3();

/**
 * Damage resolution and hit feedback (Stage 3). Everything that hurts something goes through here
 * so feel (hitstop, shake, flashes, numbers, sparks) stays consistent:
 *  heroHitsEnemy — combo / whip hits: crit damage, Tate frontal block, knockback, stun, kill.
 *  enemyHitsHero — melee, slam, bolts: i-frames, god mode, flash, knockback, death.
 *  killEnemy     — shatter + EXP shards + onKill (waves).
 */
export class Combat {
  constructor(game) {
    this.game = game;
    this.onKill = null; // (enemy) => void
    this.onHeroDeath = null;
    this.stats = { hits: 0, crits: 0, kills: 0 };
  }

  get fx() {
    return this.game.fx;
  }

  // Chest-height point on `enemy`'s surface facing the attacker at `from`.
  hitPoint(enemy, from, out = _h) {
    _d.set(from.x - enemy.position.x, 0, from.z - enemy.position.z);
    const len = _d.length() || 1;
    return out.set(enemy.position.x + (_d.x / len) * enemy.radius, 1.1, enemy.position.z + (_d.z / len) * enemy.radius);
  }

  /**
   * opts: { mult, crit, knockback, stun, whip, from (Vector3), hitstop, shake }
   * Returns { damage, blocked, killed }.
   */
  heroHitsEnemy(enemy, opts) {
    const C = CONFIG.combat;
    const hero = this.game.hero;
    const S = hero.stats;
    const from = opts.from || hero.position;
    let dmg = S.atk * (opts.mult ?? 1) * (opts.crit ? S.critDamage : 1);
    dmg *= 1 + (Math.random() * 2 - 1) * C.damageJitter;
    const blocked = enemy.blocks(from);
    if (blocked) dmg *= 1 - enemy.cfg.blockReduction;
    dmg = Math.max(1, Math.round(dmg));

    // Push direction: away from the attacker.
    _d.set(enemy.position.x - from.x, 0, enemy.position.z - from.z);
    const len = _d.length() || 1;
    _d.multiplyScalar(1 / len);
    const kb = (opts.knockback ?? 2) * (blocked ? C.blockedKnockback : 1);
    const killed = enemy.takeDamage(dmg, { dirX: _d.x, dirZ: _d.z, knockback: kb, stun: blocked ? 0 : opts.stun ?? 0, blocked });

    // Feedback
    const p = this.hitPoint(enemy, from, _v);
    const P = this.fx.particles;
    if (blocked) {
      P.sparks(p, _d.clone().negate(), 10, { color: CONFIG.fx.emberColor, speed: 6, life: 0.22 });
      P.hitStar(p, { color: '#ffb35a', intensity: 3, rays: 5, speed: 9, size: 0.05, life: 0.1, clock: 'world' });
      this.fx.numbers.show(_v.set(p.x, p.y + 0.5, p.z), `BLOCKED ${dmg}`, 'blocked');
    } else if (opts.crit) {
      P.sparks(p, _d, 22, { color: CONFIG.fx.critColor, intensity: 4, speed: 13, life: 0.35 });
      P.hitStar(p, { color: '#ffffff', intensity: 6, rays: 10, speed: 20, size: 0.08, life: 0.16, clock: 'world' });
      P.debris(p, 4, { color: '#5E2016', speed: 3.5, size: 0.08 });
      this.fx.numbers.show(_v.set(p.x, p.y + 0.7, p.z), dmg, 'crit');
    } else {
      P.sparks(p, _d, 12, { speed: 9, life: 0.26 });
      P.hitStar(p, { color: '#dffbff', intensity: 4.5, rays: 7, speed: 14, size: 0.06, life: 0.12, clock: 'world' });
      this.fx.numbers.show(_v.set(p.x, p.y + 0.5, p.z), dmg, 'normal');
    }
    const T = this.game.time;
    T.hitstop(opts.hitstop ?? C.heroHitstop);
    this.game.rig.shake(opts.shake ?? C.heroShake, 0.25);

    this.stats.hits++;
    if (opts.crit) this.stats.crits++;
    if (killed) this.killEnemy(enemy, _d);
    return { damage: dmg, blocked, killed };
  }

  killEnemy(enemy, pushDir = null) {
    if (!enemy.dead) {
      enemy.dead = true;
      enemy.alive = false;
    }
    if (enemy._killed) return;
    enemy._killed = true;
    enemy.group.visible = false;
    this.fx.shatter.burst(enemy.rig, enemy.palette, pushDir, 1);
    const p = enemy.position;
    this.fx.particles.dust(p, 8);
    this.fx.particles.sparks(_v.set(p.x, 1.0, p.z), null, 14, { color: CONFIG.fx.emberColor, speed: 7, life: 0.4 });
    this.fx.shock.ring(p, { r0: 0.3, r1: 2.2, duration: 0.4, color: CONFIG.fx.emberColor, intensity: 1.6, thickness: 0.18 });
    this.fx.exp.drop(p, enemy.exp);
    this.game.map.petalImpulse(p, 2.2, 3);
    this.stats.kills++;
    this.onKill?.(enemy);
  }

  // Enemy damage to the hero (melee, slam, bolt). `from` = attacker position.
  enemyHitsHero(source, damage, knockback, from = source.position) {
    const hero = this.game.hero;
    if (hero.dead || hero.iFrames > 0) return false;
    const C = CONFIG.combat;
    _d.set(hero.position.x - from.x, 0, hero.position.z - from.z);
    const len = _d.length() || 1;
    _d.multiplyScalar(1 / len);
    const dmg = Math.max(1, Math.round(damage * (1 + (Math.random() * 2 - 1) * C.damageJitter)));
    const god = this.game.godMode;
    hero.takeHit(god ? 0 : dmg, _d, knockback ?? C.hurtKnockback);
    const p = _v.set(hero.position.x, 1.3, hero.position.z);
    this.fx.numbers.show(p, god ? 'GOD' : dmg, 'hero');
    this.fx.particles.sparks(p, _d, 10, { color: '#ff3a4f', intensity: 3, speed: 7, life: 0.25 });
    this.game.rig.shake(C.hurtShake, 0.3);
    this.game.time.hitstop(C.hurtHitstop);
    this.game.postFX.flash(0.12, 0.15, 0xff2030);
    if (hero.stats.hp <= 0 && !hero.dead) this.onHeroDeath?.();
    return true;
  }

  // Tate slam impact FX (hit resolution is done by the caller).
  slamImpact(center, radius) {
    const fx = this.fx;
    fx.shock.ring(center, { r0: 0.4, r1: radius * 1.15, duration: 0.35, color: CONFIG.fx.emberColor, intensity: 2.6, thickness: 0.25 });
    fx.shock.ring(center, { r0: 0.2, r1: radius * 0.7, duration: 0.25, color: '#ffffff', intensity: 1.4, thickness: 0.3 });
    fx.particles.dust(center, 14, { speed: 4, size: 0.18 });
    fx.particles.debris(center, 10, { color: '#34363f', speed: 4.5 });
    fx.particles.sparks(_v.set(center.x, 0.2, center.z), _d.set(0, 1, 0), 12, { color: CONFIG.fx.emberColor, speed: 7, life: 0.3 });
    this.game.rig.shake(0.3, 0.3);
    this.game.map.petalImpulse(center, radius + 1, 6);
  }
}
