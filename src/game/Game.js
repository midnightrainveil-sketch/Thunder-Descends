import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { ArenaMap } from '../world/ArenaMap.js';
import { spawnGates, randomRimPoint } from '../world/ArenaBounds.js';
import { Hero } from '../entities/Hero.js';
import { Enemy } from '../entities/Enemy.js';
import { Juggernaut } from '../entities/bosses/Juggernaut.js';
import { Kitsune } from '../entities/bosses/Kitsune.js';
import { Raiju } from '../entities/bosses/Raiju.js';
import { MouseReticle } from '../fx/MouseReticle.js';
import { FX } from '../fx/FX.js';
import { Combat } from '../combat/Combat.js';
import { Projectiles } from '../combat/Projectiles.js';
import { Waves } from './Waves.js';
import { Progression } from './Progression.js';
import { HUD } from '../ui/HUD.js';
import { Screens } from '../ui/Screens.js';
import { rollCards } from './Upgrades.js';

// Input stub for non-play modes (title / menus): the hero idles.
const NO_INPUT = { isDown: () => false, wasPressed: () => false, wasReleased: () => false, isButtonDown: () => false, wasButtonPressed: () => false, wasButtonReleased: () => false, groundValid: false, groundPoint: new THREE.Vector3() };
import { buildVoxelTest } from '../voxel/models/VoxelTest.js';

const _v = new THREE.Vector3();
const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

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
    const F = CONFIG.bosses.kitsune.fan;
    this.spikes = new Projectiles(scene, this.fx, { color: '#ff3fd2', size: [0.1, 0.1, 0.5], speed: F.speed, radius: 0.16, life: F.range / F.speed });
    this.boss = null;
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
    this.spikes.onHitHero = this.projectiles.onHitHero;
    this.combat.onKill = (e) => {
      this.waves.onKill(e);
      this.hero.skills.r.onKill();
    };
    this.combat.onHeroDeath = () => this._onHeroDeath();

    this.reticle = new MouseReticle();
    scene.add(this.reticle.mesh);

    this.voxelTest = buildVoxelTest();
    const vt = CONFIG.voxel.test.position;
    this.voxelTest.position.set(vt.x, 0, vt.z);
    scene.add(this.voxelTest);

    this.photoMode = false;

    // Game modes: title → play ⇄ paused / cards → over | clear.
    this.screens = new Screens(uiRoot, this);
    this.screens.onAction = (a) => this._onScreenAction(a);
    this.screens.onPick = (i) => this.pickCard(i);
    this.mode = 'title';
    this.waves.enabled = false;
    this.screens.show('title');
    this.cards = null;
    this.cardT = 0;
    this.runTime = 0;

    // Follow camera + pointer lock (mouse look). Losing the lock mid-run (Esc, alt-tab) pauses.
    this.lockBlocked = false; // debug: orbit camera / model viewer need the cursor
    this._prevMode = this.mode;
    this._releasing = false;
    this._lockPauseT = -1;
    input.wantLock = () => this._wantLock();
    input.onLockChange = (locked) => {
      if (locked) return;
      if (this._releasing) this._releasing = false;
      else if (this.mode === 'play') {
        this.setPaused(true);
        this._lockPauseT = performance.now();
      }
    };
  }

  _wantLock() {
    return CONFIG.camera.mode === 'follow' && this.mode === 'play' && !this.lockBlocked && !this.rig.override;
  }

  // Give the cursor back without pausing (debug panel, menus).
  releasePointer() {
    if (!this.input.locked) return;
    this._releasing = true;
    this.input.releaseLock();
  }

  // V: third-person follow camera ⇄ fixed cinematic camera.
  toggleCameraMode() {
    const C = CONFIG.camera;
    C.mode = C.mode === 'follow' ? 'fixed' : 'follow';
    if (C.mode === 'follow') {
      this.rig.snapBehind(this.hero);
      if (this._wantLock()) this.input.requestLock();
    } else this.releasePointer();
    this.hud.banner('', C.mode === 'follow' ? 'third-person camera · V to switch' : 'fixed camera · V to switch', 1.4);
  }

  _syncCamera() {
    const follow = CONFIG.camera.mode === 'follow';
    this.rig.followWanted = follow && this.mode !== 'title';
    const want = this._wantLock();
    if (this.mode === 'play' && this._prevMode !== 'play' && want) this.input.requestLock();
    if (!want && this.input.locked) this.releasePointer();
    this._prevMode = this.mode;
  }

  // ── Modes ───────────────────────────────────────────────────────────────
  startRun() {
    this.restart();
  }

  _onScreenAction(a) {
    if (a === 'resume') this.setPaused(false);
    else if (a === 'restart') this.restart();
    else if (a === 'continue') this.continueEndless();
    else if (a === 'shake') {
      const S = CONFIG.camera.shake;
      S.enabled = !S.enabled;
      this.screens.setShakeLabel(S.enabled);
    }
  }

  setPaused(on) {
    if (on && this.mode !== 'play') return;
    if (!on && this.mode !== 'paused') return;
    this.mode = on ? 'paused' : 'play';
    this.time.paused = on;
    this.screens.show(on ? 'pause' : null);
  }

  openCards() {
    const cards = rollCards(this);
    if (!cards.length) {
      this.progression.pendingUpgrades = 0;
      return;
    }
    this.cards = cards;
    this.mode = 'cards';
    this.time.paused = true;
    this.screens.showCards(cards);
  }

  pickCard(i) {
    if (this.mode !== 'cards' || !this.cards?.[i]) return;
    this.cards[i].apply();
    this.progression.pendingUpgrades = Math.max(0, this.progression.pendingUpgrades - 1);
    this.cards = null;
    if (this.progression.pendingUpgrades > 0) return this.openCards(); // queued level-ups
    this.mode = 'play';
    this.time.paused = false;
    this.screens.show(null);
    this.cardT = 0;
  }

  onDemoClear() {
    this.mode = 'clear';
    this.time.paused = true;
    const s = this.combat.stats;
    this.screens.setStats('clear', [`WAVES ${this.waves.wave}`, `LEVEL ${this.progression.level}`, `KILLS ${s.kills} · WHIP STRIKES ${s.crits}`, `TIME ${fmtTime(this.runTime)}`]);
    this.screens.show('clear');
  }

  continueEndless() {
    if (this.mode !== 'clear') return;
    this.mode = 'play';
    this.time.paused = false;
    this.screens.show(null);
    this.hud.banner(`Wave ${this.waves.wave + 1}`, 'endless');
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

  // Boss (spec §9): drops in at the back of the arena; `loop` = endless repeat count (HP scaling).
  spawnBoss(type, { wave, loop = 0 } = {}) {
    const hpScale = 1 + CONFIG.bosses.loopHp * loop;
    const pos = new THREE.Vector3(0, 0, -5);
    if (type === 'raiju') pos.set(0, 0, -CONFIG.bosses.raiju.orbitRadius);
    const Cls = { juggernaut: Juggernaut, kitsune: Kitsune, raiju: Raiju }[type];
    const boss = new Cls(pos, this, { hpScale, loop });
    boss.wave = wave;
    this.enemies.push(boss, ...(boss.proxies || []));
    this.scene.add(boss.group);
    boss.group.visible = !this.photoMode;
    this.boss = boss;
    return boss;
  }

  // Kitsune shadow clones (ordinary one-hit enemies).
  spawnBossClone(pos) {
    const c = new Kitsune(pos, this, { clone: true, loop: this.boss?.loop ?? 0 });
    this.enemies.push(c);
    this.scene.add(c.group);
    this.fx.particles.sparks(_v.set(pos.x, 1.2, pos.z), null, 20, { color: '#ff3fd2', speed: 7 });
    return c;
  }

  cancelPendingSpawns() {
    this.pendingSpawns.length = 0;
  }

  aliveCount() {
    let n = this.pendingSpawns.length;
    for (const e of this.enemies) if (!e.dead && !e.proxy) n++;
    return n;
  }

  // Remove without FX (debug / reset).
  clearEnemies() {
    for (const e of this.enemies) {
      if (e.proxy) continue;
      this.scene.remove(e.group);
      e.dispose();
    }
    this.enemies.length = 0;
    this.boss = null;
    this.time.resetScales?.();
  }

  // Debug K: kill everything (shatter; EXP optional).
  killAll(withExp = true) {
    for (const e of this.enemies) {
      if (e._killed || e.proxy) continue;
      if (!withExp) e.exp = 0;
      if (e.isBoss && !e.dying && withExp) {
        e.hp = 0;
        e._startDying(); // bosses get their death sequence
        continue;
      }
      e.dead = true;
      this.combat.killEnemy(e);
    }
  }

  // ── Death / retry ────────────────────────────────────────────────────────
  // Undo every time / post effect a skill may have left running.
  _resetTimeAndPost() {
    this.time.resetScales();
    this.postFX.setTimeRing(null, 0, false);
    this.postFX.setTint(null, 0, 0);
    this.postFX.setSaturation(CONFIG.post.grade.saturation, 0);
  }

  _onHeroDeath() {
    const C = CONFIG.combat;
    this.hero.skills.reset(); // reattaches the claw, blade segments and plates; restores time
    this._resetTimeAndPost();
    this.fx.chain.hide();
    this.fx.aim.show(false);
    this.fx.nanobots.clear();
    this.hero.playDeath();
    this.time.tweenScale('both', C.deathSlowmo, C.deathSlowmoTween);
    this.deathT = 0;
    this.postFX.setSaturation(0.35, 0.8);
  }

  restart() {
    this.deathT = -1;
    this.mode = 'play';
    this.screens.show(null);
    this.hud.setVisible(true);
    this.waves.enabled = true;
    this.runTime = 0;
    this.cardT = 0;
    this.cards = null;
    this.time.paused = false;
    this._resetTimeAndPost();
    this.clearEnemies();
    this.cancelPendingSpawns();
    this.projectiles.clear();
    this.spikes.clear();
    this.fx.clear();
    this.hero.reset();
    this.rig.snapBehind(this.hero);
    this.progression.reset();
    this.waves.reset();
    this.combat.stats = { hits: 0, crits: 0, kills: 0 };
    this.hud.banner('Wave 1', this.waves.bossFor(1) ? 'boss wave' : 'survive', CONFIG.waves.bannerTime);
  }

  // ── Update ───────────────────────────────────────────────────────────────
  update(time, input) {
    const mode = this.mode;
    if (mode === 'title' && (input.wasButtonPressed(0) || input.wasPressed('Enter'))) this.startRun();
    else if (mode === 'play') {
      const aiming = this.hero.skills.q.active && this.hero.skills.q.phase === 'aim';
      if ((input.wasPressed('Escape') && !aiming) || input.wasPressed('KeyP')) this.setPaused(true);
    } else if (mode === 'paused') {
      // The Esc that broke the pointer lock must not also resume.
      const fresh = this._lockPauseT >= 0 && performance.now() - this._lockPauseT < 300;
      if (!fresh && (input.wasPressed('Escape') || input.wasPressed('KeyP'))) this.setPaused(false);
    } else if (mode === 'cards') {
      for (let i = 0; i < 3; i++) if (input.wasPressed(`Digit${i + 1}`) || input.wasPressed(`Numpad${i + 1}`)) this.pickCard(i);
    } else if (mode === 'over' && input.wasPressed('Enter')) this.restart();
    if (input.wasPressed('KeyV') && this.mode !== 'title') this.toggleCameraMode();
    this._syncCamera();
    const inp = this.mode === 'play' ? input : NO_INPUT;
    if (this.mode === 'play' && !this.hero.dead) {
      this.hero.skills.handleInput(inp, time);
      this.hero.dash.handleInput(inp, time);
      this.runTime += time.realDt;
      // Level-up cards open shortly after the level-up burst.
      if (this.progression.pendingUpgrades > 0) {
        this.cardT += time.realDt;
        if (this.cardT >= CONFIG.ui.cardDelay) this.openCards();
      } else this.cardT = 0;
    }
    this.hero.update(time.heroDt, inp, this.rig);

    // Spawn telegraphs resolve on the world clock.
    for (let i = this.pendingSpawns.length - 1; i >= 0; i--) {
      const s = this.pendingSpawns[i];
      s.t -= time.worldDt;
      if (s.t <= 0) {
        this.pendingSpawns.splice(i, 1);
        this._createEnemy(s.type, s.pos, s.opts);
      }
    }

    for (const e of this.enemies) if (!e.proxy) e.update(time.worldDt, this.hero, this.enemies);
    this._resolveOverlaps();
    this.projectiles.update(time.worldDt, this.hero);
    this.spikes.update(time.worldDt, this.hero);

    // Dead enemies leave the list (their shatter lives in the FX pool).
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead && e.proxy) {
        this.enemies.splice(i, 1);
        continue;
      }
      if (e.dead) {
        if (!e._killed) this.combat.killEnemy(e);
        if (e === this.boss) this.boss = null;
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
      if (this.deathT >= CONFIG.combat.deathOverlayDelay && this.mode === 'play') {
        const s = this.combat.stats;
        this.mode = 'over';
        this.screens.setStats('over', [`WAVE ${this.waves.wave}`, `LEVEL ${this.progression.level}`, `KILLS ${s.kills} · WHIP STRIKES ${s.crits}`, `TIME ${fmtTime(this.runTime)}`]);
        this.screens.show('over');
      }
    }
  }

  // Hard overlap resolve: enemies never overlap each other or the hero.
  _resolveOverlaps() {
    const list = this.enemies;
    const gap = 0.05;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.dead || a.proxy || a.flying) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.dead || b.proxy || b.flying) continue;
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
        if (a.isBoss) {
          // Bosses don't budge: push the hero out instead.
          h.position.x -= (dx / d) * (min - d);
          h.position.z -= (dz / d) * (min - d);
        } else {
          a.position.x += (dx / d) * (min - d);
          a.position.z += (dz / d) * (min - d);
        }
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
