import * as THREE from 'three';
import { CONFIG } from '../../config.js';
import { buildBossRig, BOSS_DEFS } from '../../voxel/models/BossModels.js';
import { Animator } from '../../anim/Animator.js';
import { bossClips } from '../../anim/clips/bossClips.js';
import { clampToArena } from '../../world/ArenaBounds.js';
import { wrapAngle as wrap } from '../../combat/Hitbox.js';

const _v = new THREE.Vector3();
const rand = (a, b) => a + Math.random() * (b - a);

/**
 * Boss base (spec §9). Exposes the same interface as Enemy so combat, hero attacks and skills work
 * unchanged (position, radius, hp, dead, blocks(), takeDamage(), stun(), rig, palette), plus:
 *  - big HP, no knockback, reduced stuns (Q 0.6 s, E 0.4 s; other stuns ignored), never yanked by Q;
 *  - an attack picker (weighted random, never the same attack 3 times in a row);
 *  - telegraph helpers (floor decals are tracked so a stun / death cancels them) and an eye/glow tell;
 *  - intro (drops in, lands with shake + petal burst + name banner) and death (slow-mo, explosions,
 *    then a big shatter + EXP burst handled by Combat.killEnemy);
 *  - enrage below 60% HP (subclasses read `this.speedMul`: base tempo × enrage speed × a random
 *    per-attack jitter, so telegraph lengths vary);
 *  - unpredictable rhythm: random recovery, a chance to chain straight into the next attack, and
 *    erratic footwork between attacks (approach / circle-strafe / flank dash / back-step);
 *  - global difficulty knobs: hpMul, damageMul (applied in hitHero), tempo, plus endless loop scaling.
 * Subclasses implement startAttack(name) and updateAttack(dt) → true when finished, and may
 * override move(dt, hero). World clock.
 */
export class Boss {
  constructor(type, position, ctx, { hpScale = 1, loop = 0 } = {}) {
    const B = CONFIG.bosses;
    const C = B[type];
    this.type = type;
    this.isBoss = true;
    this.ctx = ctx;
    this.bcfg = C;
    this.cfg = { blockReduction: 0, cooldown: 1 };
    this.name = C.name;
    this.radius = C.radius;
    this.maxHp = C.hp * B.hpMul * hpScale;
    this.loop = loop;
    this.dmgScale = B.damageMul * (1 + B.loopDamage * loop); // every hit on the hero goes through hitHero
    this.hp = this.maxHp;
    this.exp = C.exp * B.expBurst;
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
    this.tempoMul = B.tempo; // base tempo (enrage multiplies on top)
    this.speedMul = B.tempo; // effective: movement, attack timing and telegraphs (tempo × per-attack jitter)
    this.moveMode = 'approach';
    this.moveT = 0;
    this.moveDir = 1; // strafe / flank side
    this.moveVec = new THREE.Vector3();
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
    this.animator.timeScale = this.speedMul;
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
    this.tempoMul = CONFIG.bosses.tempo * this.bcfg.enrage.speed;
    this._setTempo(1);
    this.ctx.hud.banner(this.name.toUpperCase(), 'enraged', 1.4);
    this.ctx.rig.shake(0.3, 0.3);
    this.onEnrage?.();
  }

  // Effective tempo = base tempo × jitter, capped; the animation follows it.
  _setTempo(jitter) {
    this.speedMul = Math.min(CONFIG.bosses.maxTempo, this.tempoMul * jitter);
    this.animator.timeScale = this.speedMul;
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
    return this.ctx.combat.enemyHitsHero(this, damage * this.dmgScale, knockback, from);
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
        this._setTempo(1);
        // Unpredictable rhythm: random recovery, sometimes straight into the next attack.
        const [a, b] = B.recover;
        this.recoverT = Math.random() < B.chainChance ? 0.05 : rand(a, b) / this.speedMul;
        this.moveT = 0; // pick a fresh movement mode
      }
    } else {
      this.move(dt, hero);
      this.recoverT -= dt;
      if (this.recoverT <= 0 && !hero.dead) {
        this.state = 'attack';
        this.velocity.set(0, 0, 0);
        this._setTempo(rand(...B.attackJitter));
        this.startAttack(this.pickAttack(), hero);
      }
    }

    this.afterUpdate(dt, hero);
    this.animator.update(dt);
    this.postAnimate(dt);
    this._glow(dt);
  }

  // Default: erratic footwork around the hero, switching at random between approaching (stop at
  // keepDist), circle-strafing, a fast flank dash to his side and a back-step; always facing him.
  move(dt, hero) {
    const C = this.bcfg;
    const B = CONFIG.bosses;
    _v.set(hero.position.x - this.position.x, 0, hero.position.z - this.position.z);
    const d = Math.max(_v.length(), 1e-4);
    const nx = _v.x / d, nz = _v.z / d; // toward the hero
    const base = this.speed * this.speedMul;
    this.moveT -= dt;
    if (this.moveT <= 0) this._pickMove(hero, d);
    const desired = this.moveVec;
    if (this.moveMode === 'approach') {
      const sp = d > C.keepDist ? base : 0;
      desired.set(nx * sp, 0, nz * sp);
    } else if (this.moveMode === 'strafe') {
      // Tangent around the hero plus a pull back to keepDist.
      const radial = THREE.MathUtils.clamp((d - C.keepDist) * 1.5, -base, base);
      desired.set(-nz * this.moveDir * base * 0.9 + nx * radial, 0, nx * this.moveDir * base * 0.9 + nz * radial);
    } else if (this.moveMode === 'flank') {
      // Burst toward a point beside / behind the hero.
      const tx = hero.position.x + this.flankX - this.position.x;
      const tz = hero.position.z + this.flankZ - this.position.z;
      const tl = Math.hypot(tx, tz) || 1;
      const sp = tl > 0.4 ? base * B.flank.speed : 0;
      desired.set((tx / tl) * sp, 0, (tz / tl) * sp);
      if (Math.random() < 0.5) this.ctx.fx.particles.dust(this.position, 1, { speed: 2 });
    } else {
      desired.set(-nx * base * B.backstep.speed, 0, -nz * base * B.backstep.speed);
    }
    this.velocity.lerp(desired, 1 - Math.exp(-(this.moveMode === 'flank' ? 14 : 6) * dt));
    this.position.addScaledVector(this.velocity, dt);
    clampToArena(this.position, this.radius);
    this.faceTo(hero.position.x, hero.position.z, dt);
    this.group.rotation.y = this.yaw;
    const w = Math.min(1, this.velocity.length() / Math.max(0.1, this.speed));
    this.walkBlend += (w - this.walkBlend) * (1 - Math.exp(-8 * dt));
    this.base.setBlend({ idle: 1 - this.walkBlend, walk: this.walkBlend });
  }

  _pickMove(hero, d) {
    const B = CONFIG.bosses;
    const W = B.moveWeights;
    // Far away → mostly close in; already close → mostly strafe / flank.
    const w = { ...W };
    if (d > this.bcfg.keepDist * 2) (w.approach *= 2.5), (w.backstep = 0);
    if (d < this.bcfg.keepDist * 0.8) w.approach *= 0.3;
    const sum = Object.values(w).reduce((s, x) => s + x, 0);
    let r = Math.random() * sum;
    let mode = 'approach';
    for (const k in w) {
      r -= w[k];
      if (r <= 0) {
        mode = k;
        break;
      }
    }
    this.moveMode = mode;
    this.moveDir = Math.random() < 0.5 ? -1 : 1;
    if (mode === 'flank') {
      const a = Math.atan2(this.position.x - hero.position.x, this.position.z - hero.position.z) + this.moveDir * rand(B.flank.angleDeg[0], B.flank.angleDeg[1]) * (Math.PI / 180);
      const r2 = this.bcfg.keepDist * 0.9 + this.radius;
      this.flankX = Math.sin(a) * r2;
      this.flankZ = Math.cos(a) * r2;
      this.moveT = rand(...B.flank.duration);
    } else if (mode === 'backstep') this.moveT = rand(...B.backstep.duration);
    else this.moveT = rand(...B.moveSwitch);
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
