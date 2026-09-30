import * as THREE from 'three';
import { CONFIG, ARENA_RADIUS } from '../../config.js';
import { Boss } from './Boss.js';
import { clampToArena } from '../../world/ArenaBounds.js';
import { hitCircle, hitRect } from '../../combat/Hitbox.js';

const DEG = Math.PI / 180;
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _up = new THREE.Vector3(0, 1, 0);
const _z = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const YELLOW = '#ffe14a';

// A body segment as a hit target: shares the boss's HP (×1), positioned every frame.
class SegmentProxy {
  constructor(owner) {
    this.proxy = true;
    this.owner = owner;
    this.isBoss = true;
    this.position = new THREE.Vector3();
    this.radius = owner.bcfg.radius;
    this.hitY = 3;
    this.cfg = owner.cfg;
    this.exp = 0;
  }
  get dead() {
    return this.owner.dead;
  }
  get invulnerable() {
    return this.owner.invulnerable;
  }
  get state() {
    return this.owner.state;
  }
  blocks() {
    return false;
  }
  takeDamage(amount, opts) {
    return this.owner.takeDamage(amount, opts, true);
  }
  stun(d) {
    this.owner.stun(d);
  }
}

/**
 * Wave 15 — Raiju Serpent: a flying segmented dragon. The head flies a path (orbit just outside
 * the rim at 2–4 m, sometimes a figure-8 crossing over the arena); the ~16 segments follow the
 * head's recorded path at fixed spacing. The head is the boss object (hits ×1.5); every segment is
 * a SegmentProxy in game.enemies so any attack can hit it (shared HP, each attack counts once).
 *  beam    hovers, sector telegraph, then a lightning breath sweeping across it (damage ticks)
 *  pillars lightning pillars on 5–8 circles around the hero (8–11 enraged)
 *  dive    lane telegraph across the arena through the hero, then dives along it
 */
export class Raiju extends Boss {
  constructor(position, ctx, opts) {
    super('raiju', position, ctx, opts);
    const R = this.bcfg;
    // The rig stays at the world origin; bones are placed in world space.
    this.group.position.set(0, 0, 0);
    this.flying = true; // no ground collision
    this.position = new THREE.Vector3().copy(position);
    this.head = new THREE.Vector3(position.x, -6, position.z);
    this.hitY = 3;
    this.angle = Math.atan2(position.x, position.z);
    this.dirSign = 1;
    this.path = [];
    this.proxies = Array.from({ length: R.segments }, () => new SegmentProxy(this));
    this.mode = 'orbit';
    this.cross = null;
    this.jawOpen = 0;
    this.velocity.set(0, 0, 0);
    this._pushPath(true);
  }

  takeDamage(amount, opts, fromSegment = false) {
    return super.takeDamage(fromSegment ? amount : amount * this.bcfg.headMult, opts);
  }

  // ── Movement ─────────────────────────────────────────────────────────────
  _orbitPoint(angle, t, out) {
    const R = this.bcfg;
    const [h0, h1] = R.height;
    return out.set(Math.sin(angle) * R.orbitRadius, (h0 + h1) / 2 + ((h1 - h0) / 2) * Math.sin(t * 0.9), Math.cos(angle) * R.orbitRadius);
  }

  _steerHead(target, dt, rate = 5) {
    this.head.lerp(target, 1 - Math.exp(-rate * dt));
  }

  _pushPath(force = false) {
    const last = this.path[this.path.length - 1];
    if (force || !last || last.distanceToSquared(this.head) > 0.0064) {
      this.path.push(this.head.clone());
      if (this.path.length > 400) this.path.shift();
    }
  }

  updateIntro(dt) {
    const B = CONFIG.bosses;
    const dur = B.introDrop * 1.6;
    const k = Math.min(1, this.introT / dur);
    this.angle += this.bcfg.orbitSpeed * dt;
    this._orbitPoint(this.angle, this.t, _v);
    _v.y = -6 + (_v.y + 6) * (1 - (1 - k) * (1 - k));
    this.head.copy(_v);
    if (k >= 1 && !this._landed) {
      this._landed = true;
      this.landImpact();
    }
    if (this.introT >= dur + B.introHold) {
      this.state = 'idle';
      this.recoverT = 0.3;
    }
  }

  move(dt) {
    const R = this.bcfg;
    if (this.mode === 'cross') {
      const c = this.cross;
      c.t += dt * this.speedMul;
      const u = Math.min(1, c.t / c.d);
      const a = (1 - u) * (1 - u);
      const b = 2 * (1 - u) * u;
      const e = u * u;
      _v.set(c.p0.x * a + c.p1.x * b + c.p2.x * e, c.p0.y * a + c.p1.y * b + c.p2.y * e, c.p0.z * a + c.p1.z * b + c.p2.z * e);
      this._steerHead(_v, dt, 10);
      if (u >= 1) {
        this.mode = 'orbit';
        this.angle = Math.atan2(this.head.x, this.head.z);
        this.dirSign = -this.dirSign; // figure-8
      }
      return;
    }
    this.angle += this.dirSign * R.orbitSpeed * this.speedMul * dt;
    this._orbitPoint(this.angle, this.t, _v);
    this._steerHead(_v, dt, 4);
    // Sometimes cross over the arena between attacks.
    if (this.recoverT > 0.5 && !this._crossRolled) {
      this._crossRolled = true;
      if (Math.random() < R.crossChance) this._startCross();
    }
  }

  _startCross() {
    const R = this.bcfg;
    const a1 = this.angle + Math.PI + (Math.random() - 0.5) * 1.2;
    const p2 = this._orbitPoint(a1, this.t, new THREE.Vector3());
    const p0 = this.head.clone();
    const p1 = new THREE.Vector3(0, R.height[1] + 0.8, 0);
    this.cross = { p0, p1, p2, t: 0, d: (p0.distanceTo(p1) + p1.distanceTo(p2)) / 8 };
    this.mode = 'cross';
  }

  // ── Attacks ──────────────────────────────────────────────────────────────
  startAttack(name, hero) {
    const R = this.bcfg;
    const s = this.speedMul;
    this._crossRolled = false;
    this.mode = 'orbit';
    this.tell = 1;
    const a = (this.attack = { name, t: 0, phase: 'tell', hit: false, tick: 0 });
    if (name === 'beam') {
      const B = R.beam;
      a.hover = this.head.clone();
      a.ox = this.head.x;
      a.oz = this.head.z;
      a.yaw = Math.atan2(hero.position.x - a.ox, hero.position.z - a.oz);
      this.decal('sector', { x: a.ox, z: a.oz, yaw: a.yaw, radius: B.length, arcDeg: B.arcDeg, duration: B.telegraph / s, color: YELLOW });
    } else if (name === 'pillars') {
      const P = R.pillars;
      const [n0, n1] = this.enraged ? P.enragedCount : P.count;
      const n = n0 + Math.floor(Math.random() * (n1 - n0 + 1));
      a.spots = [];
      for (let i = 0; i < n; i++) {
        const p = i === 0 ? hero.position.clone().setY(0) : new THREE.Vector3(hero.position.x + (Math.random() - 0.5) * 2 * P.spread, 0, hero.position.z + (Math.random() - 0.5) * 2 * P.spread);
        clampToArena(p, 0.5);
        a.spots.push({ p, t: (P.telegraph + i * 0.07) / s });
        this.decal('circle', { x: p.x, z: p.z, radius: P.radius, duration: (P.telegraph + i * 0.07) / s, color: YELLOW });
      }
      a.i = 0;
    } else if (name === 'dive') {
      const D = R.dive;
      const ang = Math.atan2(this.head.x, this.head.z);
      a.A = new THREE.Vector3(Math.sin(ang) * (ARENA_RADIUS - 0.5), 0, Math.cos(ang) * (ARENA_RADIUS - 0.5));
      const dir = _v.subVectors(hero.position, a.A).setY(0);
      if (dir.lengthSq() < 0.01) dir.set(-a.A.x, 0, -a.A.z);
      dir.normalize();
      // Far rim point along the lane.
      const b = a.A.x * dir.x + a.A.z * dir.z;
      const c = a.A.lengthSq() - (ARENA_RADIUS - 0.5) ** 2;
      const len = -b + Math.sqrt(Math.max(0, b * b - c));
      a.B = a.A.clone().addScaledVector(dir, len);
      a.len = len;
      a.yaw = Math.atan2(dir.x, dir.z);
      this.decal('rect', { x: a.A.x, z: a.A.z, yaw: a.yaw, length: len, width: D.width, duration: D.telegraph / s, color: YELLOW });
    }
  }

  updateAttack(dt) {
    const R = this.bcfg;
    const a = this.attack;
    const hero = this.ctx.hero;
    const g = this.ctx;
    const s = this.speedMul;
    a.t += dt;
    if (a.name === 'beam') {
      const B = R.beam;
      this._steerHead(a.hover, dt, 6);
      this.jawOpen = Math.min(1, a.t / (B.telegraph / s));
      if (a.phase === 'tell') {
        if (a.t >= B.telegraph / s) {
          a.phase = 'sweep';
          a.t = 0;
        }
        return false;
      }
      const u = Math.min(1, a.t / (B.sweep / s));
      const yaw = a.yaw + (u - 0.5) * B.arcDeg * DEG;
      const mouth = this.rig.worldPosition('jaw', _w);
      const end = _v.set(a.ox + Math.sin(yaw) * B.length, 0.05, a.oz + Math.cos(yaw) * B.length);
      g.fx.lightning.bolt(mouth, end, { life: 0.05, width: 0.28, jitter: 0.35, color: YELLOW, intensity: 4, clock: 'world' });
      for (let k = 0; k < 3; k++) {
        const f = 0.3 + 0.7 * Math.random();
        g.fx.particles.sparks(_x.set(a.ox + Math.sin(yaw) * B.length * f, 0.1, a.oz + Math.cos(yaw) * B.length * f), null, 1, { color: YELLOW, speed: 5, life: 0.2 });
      }
      a.tick -= dt;
      if (a.tick <= 0) {
        a.tick = B.tick;
        if (hitRect(a.ox, a.oz, yaw, B.length, B.width, hero)) this.hitHero(B.damage, 2, _x.set(a.ox, 0, a.oz));
      }
      if (u >= 1) {
        this.jawOpen = 0;
        return true;
      }
      return false;
    }
    if (a.name === 'pillars') {
      const P = R.pillars;
      this.move(dt);
      while (a.i < a.spots.length && a.t >= a.spots[a.i].t) {
        const p = a.spots[a.i].p;
        g.fx.lightning.bolt(_v.set(p.x, 14, p.z), _w.set(p.x, 0, p.z), { life: 0.25, width: 0.35, jitter: 0.6, color: YELLOW, intensity: 4.5, clock: 'world' });
        g.fx.lightning.bolt(_v.set(p.x + 0.3, 10, p.z), _w.set(p.x, 0, p.z), { life: 0.18, width: 0.18, jitter: 0.8, color: '#ffffff', intensity: 3, clock: 'world' });
        g.fx.shock.ring(p, { r0: 0.2, r1: P.radius * 1.3, duration: 0.3, color: YELLOW, intensity: 2.6 });
        g.fx.particles.sparks(_v.set(p.x, 0.2, p.z), _w.set(0, 1, 0), 10, { color: YELLOW, speed: 7, life: 0.3 });
        if (hitCircle(p.x, p.z, P.radius, hero)) this.hitHero(P.damage, 4, p);
        g.rig.shake(0.12, 0.15);
        a.i++;
      }
      return a.i >= a.spots.length && a.t >= a.spots[a.spots.length - 1].t + 0.3;
    }
    if (a.name === 'dive') {
      const D = R.dive;
      if (a.phase === 'tell') {
        _v.copy(a.A).setY(2.6);
        this._steerHead(_v, dt, 5);
        if (a.t >= D.telegraph / s) {
          a.phase = 'dive';
          a.t = 0;
        }
        return false;
      }
      const T = a.len / (D.speed * s);
      const u = Math.min(1, a.t / T);
      _v.lerpVectors(a.A, a.B, u).setY(D.height + 1.4 * Math.abs(u - 0.5) * 2 * 0.5);
      this.head.copy(_v);
      this.jawOpen = 1;
      if (!a.hit && Math.hypot(hero.position.x - this.head.x, hero.position.z - this.head.z) < D.width / 2 + hero.radius) {
        a.hit = true;
        this.hitHero(D.damage, 9, this.head);
      }
      if (Math.random() < 0.7) g.fx.particles.sparks(_w.set(this.head.x, 0.2, this.head.z), null, 2, { color: YELLOW, speed: 5, life: 0.25 });
      if (u >= 1) {
        this.jawOpen = 0;
        this.angle = Math.atan2(this.head.x, this.head.z);
        g.map.petalImpulse(this.head, 3, 6);
        return true;
      }
      return false;
    }
    return true;
  }

  // Place head + segments (after the base update each frame).
  afterUpdate(dt) {
    const R = this.bcfg;
    if (this.state === 'stunned') this.head.y += Math.sin(this.t * 6) * 0.005;
    this._pushPath();
    const B = this.rig.bones;
    // Head faces its motion (or the hero while hovering).
    const path = this.path;
    const n = path.length;
    let ahead = this.head;
    const behind = n > 3 ? path[Math.max(0, n - 4)] : this.head;
    _z.subVectors(ahead, behind);
    if (_z.lengthSq() < 1e-4 || this.attack?.name === 'beam') _z.set(this.ctx.hero.position.x - this.head.x, -0.3, this.ctx.hero.position.z - this.head.z);
    this._placeBone(B.head, this.head, _z);
    this.position.set(this.head.x, 0, this.head.z);
    this.hitY = this.head.y;
    // Segments at fixed arc lengths behind the head.
    let dist = 0;
    let idx = n - 1;
    let prev = this.head;
    for (let i = 0; i < R.segments; i++) {
      const want = 0.75 + i * R.spacing;
      while (idx > 0 && dist + path[idx].distanceTo(path[idx - 1]) < want) {
        dist += path[idx].distanceTo(path[idx - 1]);
        idx--;
      }
      let p;
      if (idx > 0) {
        const seg = path[idx].distanceTo(path[idx - 1]) || 1e-4;
        p = _v.lerpVectors(path[idx], path[idx - 1], Math.min(1, (want - dist) / seg));
      } else p = _v.copy(path[0]);
      _w.subVectors(prev, p);
      const bone = B[`seg_${i}`];
      this._placeBone(bone, p, _w);
      prev = bone.position;
      const px = this.proxies[i];
      px.position.set(p.x, 0, p.z);
      px.hitY = p.y;
    }
    this.animator.addRotation('jaw', this.jawOpen * 0.6, 0, 0);
  }

  // Bone pivot at pos (world = root space), +Z along dir.
  _placeBone(bone, pos, dir) {
    _z.copy(dir);
    if (_z.lengthSq() < 1e-6) _z.set(0, 0, 1);
    _z.normalize();
    _x.crossVectors(_up, _z);
    if (_x.lengthSq() < 1e-6) _x.set(1, 0, 0);
    _x.normalize();
    _y.crossVectors(_z, _x);
    bone.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
    // Geometry is authored around the rest pivot height; move the pivot to pos.
    bone.position.copy(pos).sub(this.rig.bones.root.position); // root sits at the world origin
  }

  postAnimate() {
    // The animator rewrote bone transforms from clips; re-apply the world placement.
    this.afterUpdate(0);
  }

  bodyPoint(out) {
    const px = this.proxies[Math.floor(Math.random() * this.proxies.length)];
    return out.set(px.position.x, px.hitY, px.position.z);
  }
}
