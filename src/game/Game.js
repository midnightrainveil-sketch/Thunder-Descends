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
import { Score } from './Score.js';
import { Achievements } from './Achievements.js';
import { meta } from './Meta.js';
import { save } from './Save.js';
import { audio } from '../audio/Audio.js';

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
    // Run goals: score / combo / style rank, achievements (pay Thunder Cores), Armory (meta).
    this.score = new Score(this);
    this.achievements = new Achievements();
    this.score.onFeed = (t, c, p) => this.hud.feed(t, c, p);
    this.score.onRank = (k, up) => up && this.hud.rankPop();
    this.achievements.onToast = (d) => this.hud.toast(d);
    this.runCores = 0;
    this.rerollsLeft = 0;
    this.pickT = 0;
    this.armoryReturn = 'title';
    this.beatT = 0;
    this._duck = false;

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
    this.fx.exp.onCollect = (v) => {
      audio.play('exp');
      this.progression.addExp(v);
    };
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
    this.rig.onZoom = () => this.screens.syncSetting('dist');
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
    // Waiting for the pointer lock (run start, resume, a refused request): time holds and a
    // "click to continue" prompt shows until the lock is granted — never a dead camera.
    this.awaitLock = false;
    input.onLockError = () => {
      // Chrome refuses a re-lock within ~1 s of the player pressing Esc: retry once after that.
      clearTimeout(this._lockRetry);
      this._lockRetry = setTimeout(() => this.awaitLock && this.input.requestLock(), CONFIG.camera.follow.lockRetryMs || 1100);
    };
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
    // No pointer-lock support at all (rare embeds): play without it rather than wait forever.
    const canLock = !!this.engine.renderer.domElement.requestPointerLock;
    const picking = this.mode === 'cards' && this.pickT > 0; // lock grabbed by the card click
    return canLock && CONFIG.camera.mode === 'follow' && (this.mode === 'play' || picking) && !this.lockBlocked && !this.rig.override;
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
    if (!want && this.input.locked) this.releasePointer();
    const need = want && !this.input.locked && this.mode === 'play';
    if (need && !this.awaitLock) {
      this.awaitLock = true;
      this.time.paused = true;
      this.screens.showLockPrompt(true);
      this.input.requestLock();
    } else if (!need && this.awaitLock) {
      this.awaitLock = false;
      this.screens.showLockPrompt(false);
      if (this.mode === 'play') this.time.paused = false;
    }
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
    else if (a === 'armory') this.openArmory();
    else if (a === 'back') this.screens.show(this.armoryReturn || 'title');
    else if (a === 'reroll') this.rerollCards();
    else if (a.startsWith('buy:')) this.buyUpgrade(a.slice(4));
    else if (a === 'shake') {
      const S = CONFIG.camera.shake;
      S.enabled = !S.enabled;
      this.screens.setShakeLabel(S.enabled);
    } else if (a === 'raw') {
      CONFIG.input.rawMouse = !CONFIG.input.rawMouse; // takes effect at the next mouse capture (Resume)
      this.screens.setRawLabel(CONFIG.input.rawMouse, true);
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
      // Nothing left to offer: drop the queue and make sure play resumes.
      this.progression.pendingUpgrades = 0;
      if (this.mode === 'cards') this._closeCards();
      return;
    }
    this.cards = cards;
    this.mode = 'cards';
    this.time.paused = true;
    this.pickT = 0;
    this.rerollsLeft = CONFIG.cards.rerolls;
    this.screens.showCards(cards, this.rerollsLeft);
  }

  rerollCards() {
    if (this.mode !== 'cards' || this.pickT > 0 || this.rerollsLeft <= 0) return;
    this.rerollsLeft--;
    this.cards = rollCards(this);
    audio.play('reroll');
    this.screens.showCards(this.cards, this.rerollsLeft);
  }

  // Apply at once; the picked card flares for a moment before the screen closes (update()).
  pickCard(i) {
    if (this.mode !== 'cards' || this.pickT > 0 || !this.cards?.[i]) return;
    const c = this.cards[i];
    try {
      c.apply();
    } catch (err) {
      console.error(err); // a broken card must never strand the player on this screen
    }
    // Grab the mouse inside this click (a user gesture), so play resumes without another click.
    if (CONFIG.camera.mode === 'follow' && !this.input.locked) this.input.requestLock();
    audio.play('cardPick', { rarity: c.rarity });
    if (c.rarity === 'legendary') this.achievements.unlock('legendary');
    this.screens.markPicked(i);
    this.pickT = CONFIG.ui.cardPickDelay;
  }

  _afterPick() {
    this.progression.pendingUpgrades = Math.max(0, this.progression.pendingUpgrades - 1);
    this.cards = null;
    this.pickT = 0;
    if (this.progression.pendingUpgrades > 0) {
      try {
        return this.openCards(); // queued level-ups
      } catch (err) {
        console.error(err);
        this.progression.pendingUpgrades = 0;
      }
    }
    this._closeCards();
  }

  _closeCards() {
    this.cards = null;
    this.mode = 'play';
    this.time.paused = false;
    this.screens.show(null);
    this.cardT = 0;
  }

  openArmory() {
    if (this.screens.current !== 'armory') this.armoryReturn = this.screens.current || 'title';
    this.screens.renderArmory();
    this.screens.show('armory');
  }

  buyUpgrade(id) {
    if (!meta.buy(id)) {
      audio.play('denied');
      return;
    }
    audio.play('buy');
    if (meta.allMaxed()) this.achievements.unlock('maxed');
    this.screens.renderArmory(id);
  }

  // End of a run (death) or the demo clear: pay Thunder Cores for the score not yet paid, update
  // personal bests, show the results breakdown.
  _finishRun(which) {
    const sc = this.score;
    const S = CONFIG.score;
    if (sc.score >= 50000) this.achievements.unlock('score50');
    if (sc.score >= 150000) this.achievements.unlock('score150');
    const earned = save.addCores((sc.score - sc.settled) * S.coresPerScore + (sc.bossKills - sc.settledBosses) * S.coresPerBoss);
    sc.settled = sc.score;
    sc.settledBosses = sc.bossKills;
    this.runCores += earned;
    const b = save.data.best;
    const newBest = sc.score > b.score;
    b.score = Math.max(b.score, sc.score);
    b.wave = Math.max(b.wave, this.waves.wave);
    b.combo = Math.max(b.combo, sc.maxCombo);
    b.rank = Math.max(b.rank, sc.bestRank);
    if (which === 'clear') b.clearTime = b.clearTime ? Math.min(b.clearTime, this.runTime) : this.runTime;
    save.write();
    this.screens.setResults(which, {
      score: sc.score,
      newBest,
      best: b.score,
      rows: [
        ['WAVE', this.waves.wave],
        ['LEVEL', this.progression.level],
        ['KILLS', sc.kills],
        ['BOSSES', sc.bossKills],
        ['MAX COMBO', sc.maxCombo],
        ['DODGES', sc.dodges],
        ['DASH STRIKES', sc.strikes],
        ['FLAWLESS WAVES', sc.flawlessWaves],
        ['TIME', fmtTime(this.runTime)],
      ],
      rank: CONFIG.score.ranks[sc.bestRank],
      cores: this.runCores,
      total: save.data.cores,
      achievements: this.achievements.unlockedThisRun.map((a) => a.name),
    });
  }

  onDemoClear() {
    this.mode = 'clear';
    this.time.paused = true;
    audio.play('victory');
    this.achievements.unlock('clear');
    this._finishRun('clear');
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
    audio.play('spawn');
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
    audio.play('death');
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
    meta.applyToHero(this.hero); // Armory bonuses
    this.rig.snapBehind(this.hero);
    this.progression.reset();
    this.progression.pendingUpgrades += meta.startCards(); // Head Start: free card(s)
    this.waves.reset();
    this.score.reset();
    this.achievements.unlockedThisRun = [];
    this.runCores = 0;
    this.pickT = 0;
    save.data.runs++;
    save.write();
    this.combat.stats = { hits: 0, crits: 0, kills: 0 };
    this.hud.banner('Wave 1', this.waves.bossFor(1) ? 'boss wave' : 'survive', CONFIG.waves.bannerTime);
  }

  // ── Update ───────────────────────────────────────────────────────────────
  update(time, input) {
    const mode = this.mode;
    if (mode === 'title' && this.screens.current === 'title' && (input.wasButtonPressed(0) || input.wasPressed('Enter'))) this.startRun();
    else if (mode === 'play') {
      const sk = this.hero.skills;
      const aiming = (sk.q.active && sk.q.phase === 'aim') || (sk.e.active && sk.e.phase === 'aim');
      if ((input.wasPressed('Escape') && !aiming) || input.wasPressed('KeyP')) this.setPaused(true);
    } else if (mode === 'paused') {
      // The Esc that broke the pointer lock must not also resume.
      const fresh = this._lockPauseT >= 0 && performance.now() - this._lockPauseT < 300;
      if (!fresh && (input.wasPressed('Escape') || input.wasPressed('KeyP'))) this.setPaused(false);
    } else if (mode === 'cards') {
      for (let i = 0; i < 3; i++) if (input.wasPressed(`Digit${i + 1}`) || input.wasPressed(`Numpad${i + 1}`)) this.pickCard(i);
      if (input.wasPressed('KeyR')) this.rerollCards();
      if (this.pickT > 0) {
        this.pickT -= time.realDt;
        if (this.pickT <= 0) this._afterPick();
      }
    } else if (mode === 'over' && this.screens.current === 'over' && input.wasPressed('Enter')) this.restart();
    this._audio(time);
    if (input.wasPressed('KeyV') && this.mode !== 'title') this.toggleCameraMode();
    this._syncCamera();
    // Safety net: the vertical mouse only drives the Storm Grapple distance while Q is aiming.
    const q = this.hero.skills.q;
    if (this.rig.skillAim && !(q.active && q.phase === 'aim')) this.rig.endSkillAim();
    const rig = this.rig;
    this.hud.setCrosshair(this.mode === 'play' && rig.following && input.locked && !rig.override && !rig.skillAim && rig.cineK < 0.5 && !this.hero.dead);
    const inp = this.mode === 'play' && !this.awaitLock ? input : NO_INPUT;
    if (this.mode === 'play' && !this.hero.dead) {
      this.hero.skills.handleInput(inp, time);
      this.hero.dash.handleInput(inp, time);
      this.runTime += time.realDt;
      this.score.update(time.heroDt);
      // Level-up cards wait for the end of the wave (the break between waves, or the run intro
      // for Head Start cards), then open shortly after.
      const ws = this.waves.state;
      if (this.progression.pendingUpgrades > 0 && (ws === 'break' || ws === 'intro')) {
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

    for (const e of this.enemies) {
      if (e.proxy) continue;
      try {
        e.update(time.worldDt, this.hero, this.enemies);
      } catch (err) {
        // One broken enemy must not stall the frame for everything else.
        if (!e._errLogged) console.error('[enemy update]', e.type ?? e.constructor?.name, err);
        e._errLogged = true;
      }
    }
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
        this.mode = 'over';
        this._finishRun('over');
        this.screens.show('over');
      }
    }
  }

  // Music intensity (title/menus calm, waves battle, bosses full), menu duck, low-HP heartbeat.
  _audio(time) {
    const playing = this.mode === 'play' && !this.hero.dead;
    audio.music?.setIntensity(playing ? (this.boss ? 2 : 1) : 0);
    const duck = this.mode !== 'play' && this.mode !== 'title';
    if (duck !== this._duck) {
      this._duck = duck;
      audio.setMenuDuck(duck);
    }
    const S = this.hero.stats;
    if (playing && !this.awaitLock && S.hp > 0 && S.hp / S.maxHp <= CONFIG.ui.hpLow) {
      this.beatT -= time.realDt;
      if (this.beatT <= 0) {
        this.beatT = CONFIG.audio.lowHpBeat;
        audio.play('heartbeat');
      }
    } else this.beatT = 0;
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
