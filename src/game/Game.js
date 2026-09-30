import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { ArenaMap } from '../world/ArenaMap.js';
import { spawnGates, randomRimPoint } from '../world/ArenaBounds.js';
import { Hero } from '../entities/Hero.js';
import { Enemy } from '../entities/Enemy.js';
import { MouseReticle } from '../fx/MouseReticle.js';
import { FX } from '../fx/FX.js';
import { Combat } from '../combat/Combat.js';
import { Projectiles } from '../combat/Projectiles.js';
import { Waves } from './Waves.js';
import { Progression } from './Progression.js';
import { HUD } from '../ui/HUD.js';
import { buildVoxelTest } from '../voxel/models/VoxelTest.js';

const _v = new THREE.Vector3();

// Owns the world, entities and gameplay systems. Each system picks its clock explicitly:
// world → time.worldDt, hero → time.heroDt, UI-like FX → time.realDt.
export class Game {
  constructor({ engine, rig, postFX, time, input }) {
    this.engine = engine;
    this.rig = rig;
    this.postFX = postFX;
    this.time = time;
    this.input = input;
    const scene = engine.scene;
    this.scene = scene;
    const uiRoot = document.getElementById('ui');

    this.map = new ArenaMap({ scene, rig });
    this.lighting = this.map.lighting; // debug panel compatibility

    this.fx = new FX({ scene, uiRoot, postFX });
    this.combat = new Combat(this);
    this.projectiles = new Projectiles(scene, this.fx);
    this.hud = new HUD(uiRoot);

    this.hero = new Hero();
    this.hero.attachFX(this);
    scene.add(this.hero.group);
    scene.add(this.hero.trail.mesh);
    scene.add(this.hero.whip.mesh);
    postFX.addToMask(this.hero.group); // hero keeps full color inside the time-stop ring
    postFX.addToMask(this.hero.trail.mesh);
    postFX.addToMask(this.hero.whip.mesh);

    this.enemies = [];
    this.pendingSpawns = []; // { type, pos, t, opts } — spawn telegraphs in flight
    this.godMode = false;
    this.deathT = -1;

    this.progression = new Progression(this);
    this.waves = new Waves(this);
    this.fx.exp.onCollect = (v) => this.progression.addExp(v);
    const boltFrom = new THREE.Vector3();
    this.projectiles.onHitHero = (b) => {
      boltFrom.set(b.p.x - Math.sin(b.yaw), 0, b.p.z - Math.cos(b.yaw)); // pushed along the bolt's path
      this.combat.enemyHitsHero(b.owner, b.damage, CONFIG.enemies.teppo.knockback, boltFrom);
    };
    this.combat.onKill = (e) => this.waves.onKill(e);
    this.combat.onHeroDeath = () => this._onHeroDeath();

    this.reticle = new MouseReticle();
    scene.add(this.reticle.mesh);

    this.voxelTest = buildVoxelTest();
    const vt = CONFIG.voxel.test.position;
    this.voxelTest.position.set(vt.x, 0, vt.z);
    scene.add(this.voxelTest);

    this.photoMode = false;
    this.hud.banner('WAVE 1', 'survive', CONFIG.waves.bannerTime);
  }

  // ── Spawning ─────────────────────────────────────────────────────────────
  // Spawn with the telegraph (orange beam + ring) at a gate ≥ spawnMinDist from the hero, else a
  // rim point. opts: { wave, scale, instant }.
  spawnEnemy(type, opts = {}) {
    const E = CONFIG.enemies;
    const far = spawnGates.filter((g) => g.spawn.distanceTo(this.hero.position) >= E.spawnMinDist);
    const pos = far.length ? far[Math.floor(Math.random() * far.length)].spawn.clone() : randomRimPoint(this.hero.position, E.spawnMinDist, new THREE.Vector3());
    if (opts.instant) return this._createEnemy(type, pos, opts);
    this.fx.shock.beam(pos);
    this.fx.decals.show('circle', { x: pos.x, z: pos.z, radius: 0.9, duration: E.spawnBeam, color: CONFIG.fx.emberColor });
    this.pendingSpawns.push({ type, pos, t: E.spawnBeam, opts });
    return null;
  }

  _createEnemy(type, pos, opts) {
    const enemy = new Enemy(type, pos, opts.scale);
    enemy.wave = opts.wave;
    enemy.ctx = this;
    enemy.group.visible = !this.photoMode;
    this.enemies.push(enemy);
    this.scene.add(enemy.group);
    this.fx.particles.embers(_v.set(pos.x, 0.8, pos.z), 14, { radius: 0.5 });
    this.fx.shock.ring(pos, { r0: 0.2, r1: 1.6, duration: 0.3, color: CONFIG.fx.emberColor, intensity: 2 });
    return enemy;
  }

  cancelPendingSpawns() {
    this.pendingSpawns.length = 0;
  }

  aliveCount() {
    let n = this.pendingSpawns.length;
    for (const e of this.enemies) if (!e.dead) n++;
    return n;
  }

  // Remove without FX (debug / reset).
  clearEnemies() {
    for (const e of this.enemies) {
      this.scene.remove(e.group);
      e.dispose();
    }
    this.enemies.length = 0;
  }

  // Debug K: kill everything (shatter; EXP optional).
  killAll(withExp = true) {
    for (const e of this.enemies) {
      if (e._killed) continue;
      if (!withExp) e.exp = 0;
      e.dead = true;
      this.combat.killEnemy(e);
    }
  }

  // ── Death / retry ────────────────────────────────────────────────────────
  _onHeroDeath() {
    const C = CONFIG.combat;
    this.hero.playDeath();
    this.time.tweenScale('both', C.deathSlowmo, C.deathSlowmoTween);
    this.deathT = 0;
    this.postFX.setSaturation(0.35, 0.8);
  }

  restart() {
    this.deathT = -1;
    this.hud.showDeath(false);
    this.time.tweenScale('both', 1, 0);
    this.postFX.setSaturation(CONFIG.post.grade.saturation, 0);
    this.clearEnemies();
    this.cancelPendingSpawns();
    this.projectiles.clear();
    this.fx.clear();
    this.hero.reset();
    this.progression.reset();
    this.waves.reset();
    this.combat.stats = { hits: 0, crits: 0, kills: 0 };
    this.hud.banner('WAVE 1', 'survive', CONFIG.waves.bannerTime);
  }

  // ── Update ───────────────────────────────────────────────────────────────
  update(time, input) {
    this.hero.update(time.heroDt, input, this.rig);

    // Spawn telegraphs resolve on the world clock.
    for (let i = this.pendingSpawns.length - 1; i >= 0; i--) {
      const s = this.pendingSpawns[i];
      s.t -= time.worldDt;
      if (s.t <= 0) {
        this.pendingSpawns.splice(i, 1);
        this._createEnemy(s.type, s.pos, s.opts);
      }
    }

    for (const e of this.enemies) e.update(time.worldDt, this.hero, this.enemies);
    this._resolveOverlaps();
    this.projectiles.update(time.worldDt, this.hero);

    // Dead enemies leave the list (their shatter lives in the FX pool).
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) {
        if (!e._killed) this.combat.killEnemy(e);
        this.scene.remove(e.group);
        e.dispose();
        this.enemies.splice(i, 1);
      }
    }

    this.waves.update(time.worldDt);
    this.map.update(time, this.rig.activeCamera);
    this.voxelTest.visible = CONFIG.voxel.test.enabled;

    // Death → slow-mo → retry overlay (real time).
    if (this.deathT >= 0) {
      this.deathT += time.realDt;
      if (this.deathT >= CONFIG.combat.deathOverlayDelay) {
        const s = this.combat.stats;
        this.hud.showDeath(true, `WAVE ${this.waves.wave} · LV ${this.progression.level} · ${s.kills} KILLS · ${s.crits} WHIP STRIKES`);
        if (input.wasPressed('Enter')) this.restart();
      }
    }
  }

  // Hard overlap resolve: enemies never overlap each other or the hero.
  _resolveOverlaps() {
    const list = this.enemies;
    const gap = 0.05;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.dead) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.dead) continue;
        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const min = a.radius + b.radius + gap;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-8) {
          const d = Math.sqrt(d2);
          const push = (min - d) / 2;
          a.position.x -= (dx / d) * push;
          a.position.z -= (dz / d) * push;
          b.position.x += (dx / d) * push;
          b.position.z += (dz / d) * push;
        }
      }
      const h = this.hero;
      const dx = a.position.x - h.position.x;
      const dz = a.position.z - h.position.z;
      const min = a.radius + h.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-8) {
        const d = Math.sqrt(d2);
        a.position.x += (dx / d) * (min - d);
        a.position.z += (dz / d) * (min - d);
      }
    }
  }

  updateFX(time, input) {
    this.reticle.update(time.realDt, input);
    const cam = this.rig.activeCamera;
    const el = this.engine.renderer.domElement;
    this.fx.update(time, cam, this.hero, el.clientWidth, el.clientHeight);
    this.hud.update(time.realDt, this);
  }

  // The fixed camera was refit (resize or debug edit).
  onCameraChanged() {
    this.map.onCameraChanged();
  }

  // Photo mode hides gameplay actors.
  setPhotoMode(on) {
    this.photoMode = on;
    this.hero.group.visible = !on;
    this.hero.trail.mesh.visible = !on;
    for (const e of this.enemies) e.group.visible = !on;
    this.reticle.visible = !on;
  }
}
