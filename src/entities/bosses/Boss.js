import * as THREE from 'three';
import { CONFIG } from '../../config.js';
import { buildBossRig, BOSS_DEFS } from '../../voxel/models/BossModels.js';
import { Animator } from '../../anim/Animator.js';
import { bossClips } from '../../anim/clips/bossClips.js';
import { clampToArena } from '../../world/ArenaBounds.js';
import { wrapAngle as wrap } from '../../combat/Hitbox.js';

const _v = new THREE.Vector3();

/**
 * Boss base (spec §9). Exposes the same interface as Enemy so combat, hero attacks and skills work
 * unchanged (position, radius, hp, dead, blocks(), takeDamage(), stun(), rig, palette), plus:
 *  - big HP, no knockback, reduced stuns (Q 0.6 s, E 0.4 s; other stuns ignored), never yanked by Q;
 *  - an attack picker (weighted random, never the same attack 3 times in a row);
 *  - telegraph helpers (floor decals are tracked so a stun / death cancels them) and an eye/glow tell;
 *  - intro (drops in, lands with shake + petal burst + name banner) and death (slow-mo, explosions,
 *    then a big shatter + EXP burst handled by Combat.killEnemy);
 *  - enrage below 50% HP (subclasses read `this.speedMul`).
 * Subclasses implement startAttack(name) and updateAttack(dt) → true when finished, and may
 * override move(dt, hero). World clock.
 */
export class Boss {
  constructor(type, position, ctx, { hpScale = 1 } = {}) {
    const C = CONFIG.bosses[type];
    this.type = type;
    this.isBoss = true;
    this.ctx = ctx;
    this.bcfg = C;
    this.cfg = { blockReduction: 0, cooldown: 1 };
    this.name = C.name;
    this.radius = C.radius;
    this.maxHp = C.hp * hpScale;
    this.hp = this.maxHp;
    this.exp = C.exp * CONFIG.bosses.expBurst;
    this.speed = C.speed ?? 2;

    this.group = new THREE.Group();
    this.group.name = `boss:${type}`;
    this.rig = buildBossRig(type);
    this.palette = BOSS_DEFS[type].palette;
    this.group.add(this.rig.group);
    this.animator = new Animator(this.rig, bossClips(type));
    this.base = this.animator.addLayer('base');
    this.base.setBlend({ idle: 1, walk: 0 });

    this.position = this.group.position;
    this.position.copy(position);
    this.yaw = Math.atan2(-position.x, -position.z);
    this.velocity = new THREE.Vector3();
    this.dead = false;
    this.alive = true;
    this.dying = false;
    this.enraged = false;
    this.speedMul = 1;
    this.state = 'intro';
    this.t = 0;
    this.introT = 0;
    this.recoverT = CONFIG.bosses.introHold;
    this.stunT = 0;
    this.flash = 0;
    this.tell = 0; // eye / glow flare 0..1
    this.history = [];
    this.decalList = [];
    this.attack = null;
    this.walkBlend = 0;
    this.groundY = 0; // intro drop height
    this.dyingT = 0;
    this.nextBoom = 0;
    this.animator.update(0);
  }

  get invulnerable() {
    return this.state === 'intro' || this.dying;
  }

  blocks() {
    return false;
  }

  // ── Combat interface ─────────────────────────────────────────────────────
  takeDamage(amount, { stun = 0, skill = null } = {}) {
    if (this.dead || this.invulnerable) return false;
    this.hp -= amount;
    this.flash = 1;
    if (!this.enraged && this.hp <= this.maxHp * CONFIG.bosses.enrageAt) this._enrage();
    if (this.hp <= 0) {
      this.hp = 0;
      this._startDying();
      return false; // Combat kills us after the death sequence (Game sees `dead`)
    }
    if (stun > 0 && skill) this.stun(skill === 'q' ? CONFIG.bosses.stunQ : skill === 'e' ? CONFIG.bosses.stunE : 0);
    return false;
  }

  stun(duration) {
    if (this.dead || this.dying || duration <= 0 || this.state === 'intro') return;
    this._cancelAttack();
    this.state = 'stunned';
    this.stunT = Math.max(this.stunT, duration);
    this.base.play('stunned', { fade: 0.1 });
  }

  _enrage() {
    this.enraged = true;
    this.speedMul = this.bcfg.enrage.speed;
    this.animator.timeScale = this.speedMul;
    this.ctx.hud.banner(this.name.toUpperCase(), 'enraged', 1.4);
    this.ctx.rig.shake(0.3, 0.3);
    this.onEnrage?.();
  }

  // ── Telegraph helpers ───────────────────────────────────────────────────
  decal(shape, opts) {
    const d = this.ctx.fx.decals.show(shape, opts);
    this.decalList.push(d);
    return d;
  }

  _cancelAttack() {
    for (const d of this.decalList) if (d.active && !d.resolved) d.cancel();
    this.decalList.length = 0;
    this.attack = null;
    this.onCancelAttack?.();
  }

  hitHero(damage, knockback, from = this.position) {
    return this.ctx.combat.enemyHitsHero(this, damage, knockback, from);
  }

  // Weighted random attack, never the same one 3 times in a row.
  pickAttack() {
    const W = this.bcfg.weights;
    const h = this.history;
    const banned = h.length >= 2 && h[h.length - 1] === h[h.length - 2] ? h[h.length - 1] : null;
    const names = Object.keys(W).filter((n) => n !== banned && this.canUse(n));
    const sum = names.reduce((s, n) => s + W[n], 0);
    let r = Math.random() * sum;
    let pick = names[0];
    for (const n of names) {
      r -= W[n];
      if (r <= 0) {
        pick = n;
        break;
      }
    }
    h.push(pick);
    if (h.length > 4) h.shift();
    return pick;
  }

  canUse() {
    return true;
  }

  faceTo(x, z, dt, rate = 6) {
    const target = Math.atan2(x - this.position.x, z - this.position.z);
    if (dt === 0) this.yaw = target;
    else this.yaw += wrap(target - this.yaw) * (1 - Math.exp(-rate * this.speedMul * dt));
  }

  // ── Update ───────────────────────────────────────────────────────────────
  update(dt, hero) {
    if (this.dead) return;
    const B = CONFIG.bosses;
    const realDt = this.ctx.time.realDt;
    if (this.dying) {
      this._updateDying(realDt);
      if (dt > 0) {
        this.animator.update(dt);
        this.postAnimate(0);
      }
      return;
    }
    if (dt <= 0) return;
    this.t += dt;

    if (this.state === 'intro') {
      this.introT += dt;
      this.updateIntro(dt);
    } else if (this.state === 'stunned') {
      this.stunT -= dt;
      if (this.stunT <= 0) {
        this.state = 'idle';
        this.recoverT = 0.5;
        this.base.setBlend({ idle: 1, walk: 0 });
      }
    } else if (this.state === 'attack') {
      if (this.updateAttack(dt)) {
        this.attack = null;
        this.decalList.length = 0;
        this.state = 'idle';
        const [a, b] = B.recover;
        this.recoverT = (a + Math.random() * (b - a)) / this.speedMul;
      }
    } else {
      this.move(dt, hero);
      this.recoverT -= dt;
      if (this.recoverT <= 0 && !hero.dead) {
        this.state = 'attack';
        this.velocity.set(0, 0, 0);
        this.startAttack(this.pickAttack(), hero);
      }
    }

    this.afterUpdate(dt, hero);
    this.animator.update(dt);
    this.postAnimate(dt);
    this._glow(dt);
  }

  // Default: walk toward the hero, stop at keepDist, face him.
  move(dt, hero) {
    const C = this.bcfg;
    _v.set(hero.position.x - this.position.x, 0, hero.position.z - this.position.z);
    const d = _v.length();
    const sp = d > C.keepDist ? this.speed * this.speedMul : 0;
    const desired = _v.multiplyScalar(sp / Math.max(d, 1e-4));
    this.velocity.lerp(desired, 1 - Math.exp(-6 * dt));
    this.position.addScaledVector(this.velocity, dt);
    clampToArena(this.position, this.radius);
    this.faceTo(hero.position.x, hero.position.z, dt);
    this.group.rotation.y = this.yaw;
    const w = Math.min(1, this.velocity.length() / Math.max(0.1, this.speed));
    this.walkBlend += (w - this.walkBlend) * (1 - Math.exp(-8 * dt));
    this.base.setBlend({ idle: 1 - this.walkBlend, walk: this.walkBlend });
  }

  // Default intro: drop from the sky onto the spawn point, land with impact.
  updateIntro() {
    const B = CONFIG.bosses;
    const k = Math.min(1, this.introT / B.introDrop);
    this.rig.group.position.y = 14 * (1 - k * k);
    this.group.rotation.y = this.yaw;
    if (k >= 1 && !this._landed) {
      this._landed = true;
      this.landImpact();
    }
    if (this.introT >= B.introDrop + B.introHold) {
      this.state = 'idle';
      this.recoverT = 0.2;
    }
  }

  landImpact() {
    const g = this.ctx;
    const p = this.position;
    g.rig.shake(0.7, 0.5);
    g.map.petalImpulse(p, 9, 12);
    g.fx.shock.ring(p, { r0: 0.5, r1: 6, duration: 0.5, color: CONFIG.fx.emberColor, intensity: 2.6, thickness: 0.2 });
    g.fx.particles.dust(p, 20, { speed: 5, size: 0.22 });
    g.fx.particles.debris(_v.set(p.x, 0.3, p.z), 14, { speed: 5 });
    g.hud.bossBanner(this.name);
  }

  afterUpdate() {}
  postAnimate() {}

  _glow(dt) {
    this.tell = Math.max(0, this.tell - dt * 2);
    const flare = this.state === 'attack' ? 0.5 : 0;
    this.rig.setGlow('eyes', this.state === 'stunned' ? 0.3 : 1 + 2.5 * Math.max(this.tell, flare));
    this.rig.setGlow('core', this.enraged ? this.bcfg.enrage.chestGlow ?? 1.8 : 1);
    this.flash = Math.max(0, this.flash - dt / CONFIG.enemies.hurtFlash);
    this.rig.setFlash(this.flash * 0.7);
  }

  // ── Death ────────────────────────────────────────────────────────────────
  _startDying() {
    if (this.dying) return;
    const B = CONFIG.bosses;
    this.dying = true;
    this._cancelAttack();
    this.dyingT = 0;
    this.nextBoom = 0;
    this.ctx.time.tweenScale('both', B.deathSlowmo, 0.2);
    this.ctx.hud.banner(`${this.name.toUpperCase()}`, 'defeated', 2.2);
    this.onDying?.();
  }

  // Random point on the body for explosions (subclasses with odd shapes override).
  bodyPoint(out) {
    return out.set(this.position.x + (Math.random() - 0.5) * this.radius * 2, 0.5 + Math.random() * 2.5, this.position.z + (Math.random() - 0.5) * this.radius * 2);
  }

  _updateDying(realDt) {
    const B = CONFIG.bosses;
    const g = this.ctx;
    this.dyingT += realDt;
    this.rig.setFlash(0.3 + 0.3 * Math.sin(this.dyingT * 30));
    if (this.dyingT >= this.nextBoom) {
      this.nextBoom += 0.22;
      const p = this.bodyPoint(_v);
      g.fx.particles.hitStar(p, { color: '#ffd28a', intensity: 5, rays: 9, speed: 12, size: 0.09, life: 0.2, clock: 'hero' });
      g.fx.particles.sparks(p, null, 16, { color: CONFIG.fx.emberColor, intensity: 3.5, speed: 9, life: 0.4, clock: 'hero' });
      g.fx.shock.ring(p, { r0: 0.2, r1: 2.2, duration: 0.3, color: '#ffb35a', intensity: 2.4, clock: 'hero' });
      g.rig.shake(0.25, 0.2);
    }
    if (this.dyingT >= B.deathTime) {
      this.dead = true;
      this.alive = false;
      g.time.tweenScale('both', 1, 0.5);
      g.rig.shake(0.6, 0.5);
      g.postFX.flash(0.4, 0.35, 0xffe6c0);
    }
  }

  dispose() {
    this._cancelAttack();
    this.rig.dispose();
  }
}
