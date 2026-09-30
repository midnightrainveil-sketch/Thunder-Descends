import * as THREE from 'three';
import { CONFIG } from '../../config.js';
import { Boss } from './Boss.js';
import { clampToArena } from '../../world/ArenaBounds.js';
import { hitSector } from '../../combat/Hitbox.js';
import { KITSUNE_TAILS, KITSUNE_TAIL_LINKS } from '../../voxel/models/BossModels.js';

const DEG = Math.PI / 180;
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const MAGENTA = '#ff3fd2';

/**
 * Wave 10 — Kage Kitsune: agile ninja mech, fox mask, 3 swaying block-chain tails, twin blades.
 *  blink  0.5 s magenta flash at a point behind the hero, then teleports there and slashes
 *  dash   triple dash-slash along 3 lane decals (all shown up front), fast dashes
 *  fan    tails rise, a 90° sector telegraph, then a fan of tail spikes (projectiles)
 * Enrage (< 50%): ×1.3 speed and 2 shadow clones (die in one hit, half damage, blink + dash only).
 */
export class Kitsune extends Boss {
  constructor(position, ctx, opts = {}) {
    super('kitsune', position, ctx, opts);
    this.clone = !!opts.clone;
    if (this.clone) {
      this.isBoss = false; // clones are ordinary one-hit enemies
      this.maxHp = this.hp = 1;
      this.exp = 0;
      this.dmgMul = this.bcfg.enrage.cloneDamage;
      this.name = 'Shadow';
      // Dark translucent look.
      const m = this.rig.opaqueMesh.material;
      m.transparent = true;
      m.opacity = 0.55;
      m.color = new THREE.Color(0.35, 0.3, 0.5);
      this.state = 'idle';
      this.recoverT = 0.8 + Math.random();
    } else this.dmgMul = 1;
    this.clones = [];
    this.tailRaise = 0;
  }

  canUse(name) {
    return !this.clone || name !== 'fan';
  }

  onEnrage() {
    if (this.clone) return;
    const E = this.bcfg.enrage;
    for (let i = 0; i < E.clones; i++) {
      const a = (i / E.clones) * Math.PI * 2 + Math.random();
      _v.set(this.position.x + Math.cos(a) * 3, 0, this.position.z + Math.sin(a) * 3);
      clampToArena(_v, 0.6);
      const c = this.ctx.spawnBossClone(_v);
      this.clones.push(c);
    }
  }

  onDying() {
    for (const c of this.clones) if (!c.dead) this.ctx.combat.killEnemy(c);
  }

  // Clones die in one hit without the boss death sequence.
  takeDamage(amount, opts) {
    if (this.clone) {
      if (this.dead) return false;
      this.hp = 0;
      this.dead = true;
      this.alive = false;
      return true;
    }
    return super.takeDamage(amount, opts);
  }

  startAttack(name, hero) {
    const C = this.bcfg;
    const s = this.speedMul;
    this.tell = 1;
    const a = (this.attack = { name, t: 0, phase: 'tell', hit: false, k: 0 });
    if (name === 'blink') {
      const B = C.blink;
      // Behind the hero (opposite his aim), inside the arena.
      a.to = new THREE.Vector3(hero.position.x - hero.aim.x * B.behind, 0, hero.position.z - hero.aim.z * B.behind);
      clampToArena(a.to, this.radius);
      a.phase = 'flash';
      this.decal('circle', { x: a.to.x, z: a.to.z, radius: 1.0, duration: B.flash / s, color: MAGENTA });
      this.base.play('crossUp', { fade: 0.08 });
    } else if (name === 'dash') {
      const D = C.dash;
      a.lanes = [];
      let from = this.position.clone();
      let toward = hero.position.clone();
      for (let k = 0; k < D.count; k++) {
        const dir = _v.subVectors(toward, from).setY(0);
        if (dir.lengthSq() < 0.01) dir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        dir.normalize();
        const end = from.clone().addScaledVector(dir, D.length);
        clampToArena(end, this.radius);
        const len = end.distanceTo(from);
        const yaw = Math.atan2(dir.x, dir.z);
        a.lanes.push({ from: from.clone(), end, len, yaw });
        const dashT = len / (D.speed * s);
        this.decal('rect', { x: from.x, z: from.z, yaw, length: len, width: D.width, duration: D.telegraph / s + k * (dashT + 0.12 / s), color: MAGENTA });
        // Next lane zig-zags back through the hero's position.
        from = end;
        toward = hero.position.clone().add(_w.set(Math.sin(yaw + Math.PI / 2), 0, Math.cos(yaw + Math.PI / 2)).multiplyScalar(k % 2 ? 2 : -2));
      }
      a.phase = 'tell';
      this.base.play('crossUp', { fade: 0.08 });
      this.yaw = a.lanes[0].yaw;
    } else if (name === 'fan') {
      const F = C.fan;
      this.faceTo(hero.position.x, hero.position.z, 0);
      a.yaw = this.yaw;
      this.decal('sector', { x: this.position.x, z: this.position.z, yaw: this.yaw, radius: F.range, arcDeg: F.arcDeg, duration: F.telegraph / s, color: MAGENTA });
      this.base.play('fanUp', { fade: 0.08 });
    }
    this.group.rotation.y = this.yaw;
  }

  updateAttack(dt) {
    const C = this.bcfg;
    const a = this.attack;
    const hero = this.ctx.hero;
    const g = this.ctx;
    const s = this.speedMul;
    a.t += dt;
    if (a.name === 'blink') {
      const B = C.blink;
      if (a.phase === 'flash') {
        // Magenta flash on both ends.
        if (Math.random() < 0.7) g.fx.particles.embers(_v.set(a.to.x, 0.8, a.to.z), 2, { color: MAGENTA, intensity: 3, radius: 0.5 });
        this.rig.setFlash(0.6 * Math.min(1, a.t / (B.flash / s)), MAGENTA);
        if (a.t >= B.flash / s) {
          g.fx.particles.sparks(_v.set(this.position.x, 1.2, this.position.z), null, 16, { color: MAGENTA, speed: 7, life: 0.3 });
          this.position.copy(a.to);
          g.fx.particles.sparks(_v.set(this.position.x, 1.2, this.position.z), null, 16, { color: MAGENTA, speed: 7, life: 0.3 });
          g.fx.shock.ring(this.position, { r0: 0.2, r1: 1.8, duration: 0.25, color: MAGENTA, intensity: 2.4 });
          this.faceTo(hero.position.x, hero.position.z, 0);
          this.group.rotation.y = this.yaw;
          this.base.play('slash', { fade: 0.03 });
          this.rig.setFlash(0, '#ffffff');
          a.phase = 'slash';
          a.t = 0;
        }
        return false;
      }
      if (!a.hit && a.t >= 0.09 / s) {
        a.hit = true;
        if (hitSector(this.position.x, this.position.z, this.yaw, B.reach, B.arcDeg * DEG, hero)) this.hitHero(B.damage * this.dmgMul, 5);
        g.fx.slashes.spawn({ pos: _v.set(this.position.x, 1.1, this.position.z), yaw: this.yaw, tiltDeg: 20, radius: B.reach, thickness: 0.6, arcDeg: B.arcDeg, dir: 1, color: MAGENTA, intensity: 2.4, sweep: 0.08, clock: 'world' });
      }
      return a.t >= 0.5 / s;
    }
    if (a.name === 'dash') {
      const D = C.dash;
      if (a.phase === 'tell') {
        if (a.t >= D.telegraph / s) {
          a.phase = 'dash';
          a.t = 0;
          a.k = 0;
          a.hit = false;
          this.base.play('dash', { fade: 0.04 });
        }
        return false;
      }
      if (a.phase === 'gap') {
        if (a.t >= 0.12 / s) {
          a.phase = 'dash';
          a.t = 0;
          a.hit = false;
        }
        return false;
      }
      const lane = a.lanes[a.k];
      const T = lane.len / (D.speed * s);
      const u = Math.min(1, a.t / T);
      this.position.lerpVectors(lane.from, lane.end, u);
      this.yaw = lane.yaw;
      this.group.rotation.y = this.yaw;
      if (Math.random() < 0.8) g.fx.particles.embers(_v.set(this.position.x, 1, this.position.z), 2, { color: MAGENTA, intensity: 3, radius: 0.3, life: 0.35 });
      if (!a.hit && Math.hypot(hero.position.x - this.position.x, hero.position.z - this.position.z) < D.width / 2 + hero.radius + 0.2) {
        a.hit = true;
        this.hitHero(D.damage * this.dmgMul, 6);
        g.fx.slashes.spawn({ pos: _v.set(this.position.x, 1.1, this.position.z), yaw: this.yaw, tiltDeg: -30, radius: 1.8, thickness: 0.5, arcDeg: 120, dir: -1, color: MAGENTA, intensity: 2.4, sweep: 0.06, clock: 'world' });
      }
      if (u >= 1) {
        a.k++;
        if (a.k >= a.lanes.length) {
          this.base.play('idle', { fade: 0.15 });
          return true;
        }
        a.phase = 'gap';
        a.t = 0;
      }
      return false;
    }
    if (a.name === 'fan') {
      const F = C.fan;
      this.tailRaise = Math.min(1, a.t / (F.telegraph / s));
      if (!a.hit && a.t >= F.telegraph / s) {
        a.hit = true;
        const n = F.count;
        for (let i = 0; i < n; i++) {
          const yaw = a.yaw + (i / (n - 1) - 0.5) * F.arcDeg * DEG;
          g.spikes.fire(_v.set(this.position.x + Math.sin(yaw) * 0.6, 1.3, this.position.z + Math.cos(yaw) * 0.6), yaw, F.damage * this.dmgMul, this);
        }
        g.fx.particles.sparks(_v.set(this.position.x, 1.8, this.position.z), null, 20, { color: MAGENTA, speed: 8 });
        g.rig.shake(0.15, 0.2);
      }
      if (a.t >= F.telegraph / s + 0.4 / s) {
        this.tailRaise = 0;
        return true;
      }
      return false;
    }
    return true;
  }

  onCancelAttack() {
    this.tailRaise = 0;
    this.rig.setFlash(0, '#ffffff');
  }

  // Tails sway (and rise for the fan tell).
  postAnimate() {
    const T = this.bcfg.tailSway;
    for (let t = 0; t < KITSUNE_TAILS; t++) {
      for (let k = 0; k < KITSUNE_TAIL_LINKS; k++) {
        const ph = this.t * T.speed * this.speedMul + t * 2.1 + k * 0.7;
        const amp = (T.amp * DEG * (k + 1)) / KITSUNE_TAIL_LINKS;
        const spread = (t - 1) * 0.35 * (k === 0 ? 1 : 0);
        this.animator.addRotation(`tail${t}_${k}`, -0.12 - this.tailRaise * 0.32 + Math.sin(ph * 0.7) * amp * 0.4, Math.sin(ph) * amp + spread, 0);
      }
    }
  }

  bodyPoint(out) {
    return out.set(this.position.x + (Math.random() - 0.5) * 1.2, 0.5 + Math.random() * 2.2, this.position.z + (Math.random() - 0.5) * 1.2);
  }
}
