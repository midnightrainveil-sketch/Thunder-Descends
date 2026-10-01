import { CONFIG } from '../config.js';
import { Music } from './Music.js';

/**
 * Procedural sound (Web Audio, no files). Every effect is synthesized on demand from oscillators and
 * filtered noise, so the single-file build stays small.
 *
 * Buses: hero (the player's actions — stays crisp), world (enemies, impacts — muffled by a lowpass
 * while time is stopped), ui (menus, rewards) and music (its own lowpass for time stop / menus).
 * The context starts on the first user gesture (browser autoplay rules). `play(name, opts)` is a
 * no-op until then, and each sound has a minimum gap so rapid repeats don't pile up.
 */
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.last = {};
    this.expChain = 0;
    this.expT = 0;
    this.music = null;
    this._unlock = () => this.unlock();
    window.addEventListener('pointerdown', this._unlock, true);
    window.addEventListener('keydown', this._unlock, true);
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    const g = (v = 1) => {
      const n = ctx.createGain();
      n.gain.value = v;
      return n;
    };
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.knee.value = 10;
    this.comp.ratio.value = 4;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.2;
    this.master = g();
    this.master.connect(this.comp).connect(ctx.destination);
    this.sfxGain = g();
    this.sfxGain.connect(this.master);
    this.worldFilter = ctx.createBiquadFilter();
    this.worldFilter.type = 'lowpass';
    this.worldFilter.frequency.value = 20000;
    this.buses = { hero: g(), world: g(), ui: g(), music: g() };
    this.buses.hero.connect(this.sfxGain);
    this.buses.world.connect(this.worldFilter).connect(this.sfxGain);
    this.buses.ui.connect(this.sfxGain);
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 20000;
    this.musicGain = g();
    this.buses.music.connect(this.musicFilter).connect(this.musicGain).connect(this.master);
    // 2 s of white noise, shared by every noise voice.
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    this.music = new Music(this);
    this.music.start();
    window.removeEventListener('pointerdown', this._unlock, true);
    window.removeEventListener('keydown', this._unlock, true);
  }

  applyVolumes() {
    if (!this.ctx) return;
    const A = CONFIG.audio;
    this.master.gain.value = A.master;
    this.sfxGain.gain.value = A.sfx;
    this.musicGain.gain.value = A.music;
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // Time stop: muffle the world and the music (the hero's own sounds stay clear).
  setTimeStop(on, ramp = 0.35) {
    if (!this.ctx) return;
    const f = on ? CONFIG.audio.timeStopCutoff : 20000;
    const t = this.now;
    for (const flt of [this.worldFilter.frequency, this.musicFilter.frequency]) {
      flt.cancelScheduledValues(t);
      flt.setValueAtTime(flt.value, t);
      flt.exponentialRampToValueAtTime(f, t + ramp);
    }
  }

  // Menus: music softer and darker.
  setMenuDuck(on) {
    if (!this.ctx) return;
    const t = this.now;
    const p = this.musicFilter.frequency;
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.exponentialRampToValueAtTime(on ? 1400 : 20000, t + 0.3);
  }

  // ── Primitives (absolute start time `at`, defaults to now) ───────────────
  // Oscillator with a pitch glide and a fast-attack / exponential-decay envelope.
  osc({ type = 'sine', f0, f1 = f0, dur, gain = 0.2, attack = 0.004, at, bus = 'world', detune = 0, filter = null }) {
    const ctx = this.ctx;
    const t = at ?? ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    o.detune.value = detune;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.0001, t);
    e.gain.exponentialRampToValueAtTime(gain, t + attack);
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter.type || 'lowpass';
      f.frequency.value = filter.f;
      f.Q.value = filter.q ?? 0.7;
      node.connect(f);
      node = f;
    }
    node.connect(e).connect(this.buses[bus]);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // Filtered white noise with a cutoff sweep.
  noise({ type = 'bandpass', f0 = 1000, f1 = f0, q = 1, dur, gain = 0.2, attack = 0.003, at, bus = 'world' }) {
    const ctx = this.ctx;
    const t = at ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const off = Math.random() * 1.5;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.0001, t);
    e.gain.exponentialRampToValueAtTime(gain, t + attack);
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(e).connect(this.buses[bus]);
    src.start(t, off, dur + 0.05);
  }

  // Low "boom" (impacts, landings, drums).
  boom(at, { f0 = 110, f1 = 38, dur = 0.5, gain = 0.8, bus = 'world', noise = 0.4 } = {}) {
    this.osc({ type: 'sine', f0, f1, dur, gain, at, bus, attack: 0.002 });
    if (noise > 0) this.noise({ type: 'lowpass', f0: 2600, f1: 120, dur: dur * 0.7, gain: noise, at, bus });
  }

  // Short tonal note (UI, music).
  note(at, f, { dur = 0.25, gain = 0.1, type = 'triangle', bus = 'ui' } = {}) {
    this.osc({ type, f0: f, dur, gain, at, bus, attack: 0.005 });
  }

  // ── Play by name ────────────────────────────────────────────────────────
  play(name, opts = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const def = SOUNDS[name];
    if (!def) return;
    const now = performance.now();
    const gap = def.gap ?? 0.03;
    if (now - (this.last[name] || 0) < gap * 1000) return;
    this.last[name] = now;
    try {
      def.fn(this, this.ctx.currentTime, opts);
    } catch {
      /* never let a sound break the game */
    }
  }
}

const rnd = (a, b) => a + Math.random() * (b - a);
const ARP = (A, t, freqs, step, o) => freqs.forEach((f, i) => A.note(t + i * step, f, o));

// Sound definitions: fn(audio, t, opts). Gains are pre-mix; the compressor glues the result.
const SOUNDS = {
  // Player swings and strikes
  swing: { gap: 0.05, fn: (A, t, { step = 0 }) => {
    const heavy = step === 2;
    A.noise({ type: 'bandpass', f0: heavy ? 1800 : 2600, f1: heavy ? 280 : 650, q: 1.3, dur: heavy ? 0.22 : 0.14, gain: heavy ? 0.42 : 0.3, bus: 'hero' });
    if (heavy) A.osc({ type: 'sine', f0: 260, f1: 120, dur: 0.18, gain: 0.12, bus: 'hero' });
  } },
  hit: { gap: 0.025, fn: (A, t, { crit, heavy }) => {
    A.osc({ type: 'sine', f0: heavy ? 150 : 180, f1: 48, dur: heavy ? 0.22 : 0.13, gain: heavy ? 0.75 : 0.55 });
    A.noise({ type: 'lowpass', f0: 3400, f1: 700, dur: 0.07, gain: 0.32 });
    A.osc({ type: 'square', f0: rnd(1300, 1600), f1: 900, dur: 0.05, gain: 0.05 });
    if (crit) {
      A.noise({ type: 'highpass', f0: 5000, dur: 0.09, gain: 0.22 });
      A.osc({ type: 'sawtooth', f0: 2200, f1: 320, dur: 0.1, gain: 0.07 });
    }
  } },
  blocked: { gap: 0.05, fn: (A) => {
    A.osc({ type: 'square', f0: 720, f1: 640, dur: 0.09, gain: 0.12 });
    A.osc({ type: 'triangle', f0: 1450, dur: 0.18, gain: 0.08 });
  } },
  whip: { gap: 0.06, fn: (A) => {
    A.noise({ type: 'highpass', f0: 3000, f1: 8000, dur: 0.05, gain: 0.45, bus: 'hero' });
    A.osc({ type: 'sawtooth', f0: 1900, f1: 180, dur: 0.26, gain: 0.1, bus: 'hero' });
    A.noise({ type: 'bandpass', f0: 1400, q: 6, dur: 0.28, gain: 0.14, bus: 'hero' });
  } },
  kill: { gap: 0.04, fn: (A, t) => {
    A.noise({ type: 'lowpass', f0: 2600, f1: 260, dur: 0.38, gain: 0.5 });
    A.osc({ type: 'square', f0: 420, f1: 60, dur: 0.3, gain: 0.08 });
    A.note(t + 0.03, rnd(1100, 1500), { dur: 0.12, gain: 0.05, bus: 'world' });
  } },
  bossKill: { gap: 1, fn: (A, t) => {
    A.osc({ type: 'sine', f0: 75, f1: 24, dur: 1.8, gain: 0.95, attack: 0.003 });
    A.noise({ type: 'lowpass', f0: 1100, f1: 70, dur: 1.6, gain: 0.6 });
    A.osc({ type: 'sawtooth', f0: 140, f1: 38, dur: 1.1, gain: 0.12 });
    ARP(A, t + 0.4, [392, 523, 659, 784, 1047], 0.09, { dur: 0.5, gain: 0.09 });
  } },
  bossBoom: { gap: 0.18, fn: (A, t) => A.boom(t, { f0: 120, f1: 40, dur: 0.35, gain: 0.5, noise: 0.35 }) },
  exp: { gap: 0.025, fn: (A, t) => {
    const now = performance.now();
    A.expChain = now - A.expT < 450 ? Math.min(A.expChain + 1, 24) : 0;
    A.expT = now;
    const f = 760 * Math.pow(2, A.expChain / 12);
    A.note(t, f, { dur: 0.08, gain: 0.07, type: 'sine' });
    A.note(t, f * 2, { dur: 0.05, gain: 0.025 });
  } },
  levelUp: { gap: 0.3, fn: (A, t) => {
    ARP(A, t, [523, 659, 784, 1047, 1319], 0.06, { dur: 0.3, gain: 0.13 });
    A.noise({ type: 'highpass', f0: 6000, dur: 0.6, gain: 0.07, at: t + 0.2, bus: 'ui', attack: 0.2 });
  } },
  hurt: { gap: 0.1, fn: (A) => {
    A.osc({ type: 'sine', f0: 95, f1: 40, dur: 0.22, gain: 0.6, bus: 'hero' });
    A.osc({ type: 'square', f0: 230, f1: 90, dur: 0.18, gain: 0.14, bus: 'hero', filter: { f: 1400 } });
    A.noise({ type: 'lowpass', f0: 1500, f1: 300, dur: 0.14, gain: 0.32, bus: 'hero' });
  } },
  heartbeat: { gap: 0.4, fn: (A, t) => {
    A.osc({ type: 'sine', f0: 62, f1: 42, dur: 0.14, gain: 0.45, bus: 'ui' });
    A.osc({ type: 'sine', f0: 58, f1: 40, dur: 0.12, gain: 0.32, bus: 'ui', at: t + 0.17 });
  } },
  // Movement
  dash: { gap: 0.08, fn: (A) => {
    A.noise({ type: 'bandpass', f0: 500, f1: 3200, q: 0.8, dur: 0.2, gain: 0.32, bus: 'hero' });
    A.osc({ type: 'sine', f0: 220, f1: 520, dur: 0.1, gain: 0.05, bus: 'hero' });
  } },
  dodge: { gap: 0.15, fn: (A, t) => {
    A.osc({ type: 'triangle', f0: 1500, f1: 2600, dur: 0.14, gain: 0.08, bus: 'ui' });
    A.noise({ type: 'highpass', f0: 5000, dur: 0.1, gain: 0.1, bus: 'ui' });
    A.note(t + 0.06, 2093, { dur: 0.18, gain: 0.05 });
  } },
  strikeLunge: { gap: 0.1, fn: (A) => {
    A.noise({ type: 'bandpass', f0: 400, f1: 4200, q: 1, dur: 0.14, gain: 0.32, bus: 'hero' });
    A.osc({ type: 'sawtooth', f0: 300, f1: 1400, dur: 0.12, gain: 0.05, bus: 'hero' });
  } },
  strikeImpact: { gap: 0.1, fn: (A, t) => {
    A.boom(t, { f0: 130, f1: 32, dur: 0.6, gain: 0.95, bus: 'hero', noise: 0.6 });
    A.osc({ type: 'sawtooth', f0: 2600, f1: 200, dur: 0.22, gain: 0.13, bus: 'hero' });
    A.osc({ type: 'square', f0: 1700, f1: 1500, dur: 0.12, gain: 0.06, bus: 'hero' });
    A.noise({ type: 'highpass', f0: 4500, dur: 0.12, gain: 0.25, bus: 'hero' });
  } },
  // Skills
  aim: { gap: 0.2, fn: (A) => {
    A.osc({ type: 'sine', f0: 520, f1: 180, dur: 0.35, gain: 0.08, bus: 'hero' });
    A.noise({ type: 'lowpass', f0: 2000, f1: 200, dur: 0.35, gain: 0.12, bus: 'hero' });
  } },
  clawLaunch: { gap: 0.1, fn: (A, t) => {
    A.osc({ type: 'sawtooth', f0: 280, f1: 950, dur: 0.18, gain: 0.08, bus: 'hero', filter: { f: 2500 } });
    for (let i = 0; i < 7; i++) A.noise({ type: 'bandpass', f0: rnd(2600, 3600), q: 4, dur: 0.025, gain: 0.16, at: t + i * 0.024, bus: 'hero' });
  } },
  clawGrab: { gap: 0.1, fn: (A) => {
    A.noise({ type: 'bandpass', f0: 1800, q: 5, dur: 0.28, gain: 0.3, bus: 'hero' });
    A.osc({ type: 'square', f0: 92, dur: 0.26, gain: 0.07, bus: 'hero', filter: { f: 900 } });
    A.osc({ type: 'sine', f0: 320, f1: 110, dur: 0.22, gain: 0.2, bus: 'hero' });
  } },
  clawLand: { gap: 0.1, fn: (A, t) => A.boom(t, { f0: 150, f1: 42, dur: 0.32, gain: 0.7, bus: 'hero', noise: 0.35 }) },
  thrust: { gap: 0.1, fn: (A) => {
    A.osc({ type: 'sawtooth', f0: 200, f1: 1700, dur: 0.12, gain: 0.12, bus: 'hero', filter: { f: 3000 } });
    A.noise({ type: 'bandpass', f0: 900, f1: 5200, q: 1.2, dur: 0.16, gain: 0.36, bus: 'hero' });
    A.osc({ type: 'sine', f0: 520, f1: 80, dur: 0.22, gain: 0.22, bus: 'hero' });
  } },
  slash: { gap: 0.045, fn: (A) => {
    A.noise({ type: 'bandpass', f0: rnd(2300, 3600), f1: 800, q: 1.5, dur: 0.07, gain: 0.18, bus: 'hero' });
  } },
  // Zero Hour
  ultRaise: { gap: 0.5, fn: (A) => A.osc({ type: 'sawtooth', f0: 110, f1: 420, dur: 0.22, gain: 0.08, bus: 'hero', filter: { f: 1200 } }) },
  ultStab: { gap: 0.5, fn: (A, t) => {
    A.boom(t, { f0: 95, f1: 28, dur: 1.1, gain: 1, bus: 'hero', noise: 0.6 });
    A.osc({ type: 'sine', f0: 220, dur: 2.2, gain: 0.16, bus: 'hero', attack: 0.002 });
    A.osc({ type: 'sine', f0: 220 * 2.76, dur: 1.4, gain: 0.07, bus: 'hero', attack: 0.002 });
    A.osc({ type: 'square', f0: 640, dur: 0.12, gain: 0.08, bus: 'hero' });
    A.osc({ type: 'sine', f0: 55, dur: 1.6, gain: 0.25, bus: 'hero', attack: 0.3 });
  } },
  plate: { gap: 0.06, fn: (A) => A.note(undefined, rnd(1200, 2100), { dur: 0.07, gain: 0.06, type: 'triangle', bus: 'hero' }) },
  ultReturn: { gap: 0.5, fn: (A) => {
    A.noise({ type: 'bandpass', f0: 300, f1: 4200, q: 1, dur: 0.42, gain: 0.35, attack: 0.36, bus: 'hero' });
    A.osc({ type: 'sine', f0: 180, f1: 820, dur: 0.42, gain: 0.12, attack: 0.36, bus: 'hero' });
  } },
  ultRelease: { gap: 0.5, fn: (A, t) => {
    A.boom(t, { f0: 120, f1: 30, dur: 0.9, gain: 1, bus: 'hero', noise: 0.7 });
    A.osc({ type: 'sine', f0: 440, dur: 1.6, gain: 0.12, bus: 'hero', attack: 0.002 });
    A.osc({ type: 'sine', f0: 440 * 2.76, dur: 1, gain: 0.05, bus: 'hero', attack: 0.002 });
    A.noise({ type: 'highpass', f0: 4000, dur: 0.18, gain: 0.3, bus: 'hero' });
  } },
  // Enemies and bosses
  spawn: { gap: 0.15, fn: (A) => {
    A.osc({ type: 'sine', f0: 180, f1: 420, dur: 0.45, gain: 0.07, attack: 0.15, filter: { f: 900 } });
    A.noise({ type: 'bandpass', f0: 400, f1: 1600, dur: 0.45, gain: 0.06, attack: 0.2 });
  } },
  shot: { gap: 0.06, fn: (A) => {
    A.osc({ type: 'square', f0: 1300, f1: 320, dur: 0.1, gain: 0.05 });
    A.noise({ type: 'highpass', f0: 2500, dur: 0.06, gain: 0.08 });
  } },
  warn: { gap: 0.22, fn: (A, t) => {
    A.osc({ type: 'triangle', f0: 760, f1: 600, dur: 0.12, gain: 0.07 });
    A.osc({ type: 'triangle', f0: 760, f1: 600, dur: 0.12, gain: 0.05, at: t + 0.13 });
  } },
  slam: { gap: 0.12, fn: (A, t) => A.boom(t, { f0: 110, f1: 30, dur: 0.5, gain: 0.7, noise: 0.45 }) },
  bossIntro: { gap: 2, fn: (A, t) => {
    for (const [f, d] of [[55, 0], [82.4, 6]]) {
      A.osc({ type: 'sawtooth', f0: f, dur: 1.9, gain: 0.16, attack: 0.25, detune: d, at: t, filter: { f: 700 } });
    }
    A.boom(t, { f0: 90, f1: 34, dur: 0.8, gain: 0.95, noise: 0.5 });
    A.boom(t + 0.5, { f0: 80, f1: 30, dur: 0.8, gain: 0.85, noise: 0.4 });
  } },
  // Waves and rewards (UI bus)
  waveStart: { gap: 0.5, fn: (A, t) => {
    A.boom(t, { f0: 100, f1: 40, dur: 0.45, gain: 0.7, bus: 'ui', noise: 0.3 });
    A.boom(t + 0.2, { f0: 100, f1: 40, dur: 0.5, gain: 0.8, bus: 'ui', noise: 0.3 });
  } },
  waveClear: { gap: 0.5, fn: (A, t) => ARP(A, t, [784, 988, 1175, 1568], 0.07, { dur: 0.6, gain: 0.09 }) },
  flawless: { gap: 0.5, fn: (A, t) => ARP(A, t, [1047, 1319, 1568, 2093, 2637], 0.05, { dur: 0.5, gain: 0.08, type: 'sine' }) },
  rankUp: { gap: 0.2, fn: (A, t, { rank = 1 }) => {
    const base = 440 * Math.pow(2, (rank * 2) / 12);
    A.note(t, base, { dur: 0.12, gain: 0.08, type: 'square' });
    A.note(t + 0.08, base * 1.5, { dur: 0.22, gain: 0.08, type: 'square' });
    if (rank >= 6) A.noise({ type: 'highpass', f0: 6000, dur: 0.5, gain: 0.08, at: t + 0.1, bus: 'ui' });
  } },
  rankDown: { gap: 0.3, fn: (A) => A.osc({ type: 'triangle', f0: 400, f1: 220, dur: 0.2, gain: 0.06, bus: 'ui' }) },
  death: { gap: 1, fn: (A, t) => {
    A.osc({ type: 'sawtooth', f0: 320, f1: 40, dur: 1.4, gain: 0.16, bus: 'ui', filter: { f: 900 } });
    A.boom(t, { f0: 80, f1: 25, dur: 1.2, gain: 0.8, bus: 'ui', noise: 0.4 });
  } },
  victory: { gap: 1, fn: (A, t) => {
    ARP(A, t, [523, 659, 784, 1047], 0.12, { dur: 0.5, gain: 0.12 });
    ARP(A, t + 0.5, [784, 988, 1175, 1568], 0.06, { dur: 0.9, gain: 0.1 });
  } },
  newBest: { gap: 1, fn: (A, t) => {
    ARP(A, t, [659, 784, 988, 1319, 1568, 1976], 0.07, { dur: 0.4, gain: 0.1, type: 'square' });
    A.noise({ type: 'highpass', f0: 7000, dur: 0.8, gain: 0.08, at: t + 0.3, bus: 'ui', attack: 0.1 });
  } },
  achievement: { gap: 0.4, fn: (A, t) => {
    A.note(t, 1319, { dur: 0.2, gain: 0.09 });
    A.note(t + 0.1, 1976, { dur: 0.4, gain: 0.09 });
    A.noise({ type: 'highpass', f0: 7000, dur: 0.3, gain: 0.05, at: t + 0.1, bus: 'ui' });
  } },
  uiHover: { gap: 0.04, fn: (A) => A.osc({ type: 'sine', f0: 2500, dur: 0.025, gain: 0.03, bus: 'ui' }) },
  uiClick: { gap: 0.05, fn: (A) => A.osc({ type: 'square', f0: 900, f1: 1350, dur: 0.05, gain: 0.05, bus: 'ui' }) },
  cardReveal: { gap: 0.02, fn: (A, t, { i = 0, rarity = 'common' }) => {
    A.noise({ type: 'bandpass', f0: 800, f1: 3600, q: 1, dur: 0.13, gain: 0.1, bus: 'ui' });
    A.note(t + 0.02, 587 * Math.pow(2, (i * 3) / 12), { dur: 0.12, gain: 0.05 });
    if (rarity === 'epic' || rarity === 'legendary') A.noise({ type: 'highpass', f0: 6500, dur: 0.5, gain: rarity === 'legendary' ? 0.12 : 0.06, at: t + 0.05, bus: 'ui' });
  } },
  cardPick: { gap: 0.2, fn: (A, t, { rarity = 'common' }) => {
    const chords = {
      common: [659, 988],
      rare: [659, 988, 1319],
      epic: [523, 784, 1047, 1568],
      legendary: [523, 659, 784, 1047, 1319, 1568, 2093],
    };
    A.boom(t, { f0: 140, f1: 60, dur: 0.25, gain: 0.35, bus: 'ui', noise: 0.15 });
    ARP(A, t, chords[rarity] || chords.common, rarity === 'legendary' ? 0.05 : 0.04, { dur: 0.6, gain: 0.1 });
    if (rarity !== 'common') A.noise({ type: 'highpass', f0: 6000, dur: 0.6, gain: 0.07, at: t + 0.08, bus: 'ui', attack: 0.05 });
  } },
  reroll: { gap: 0.2, fn: (A, t) => {
    for (let i = 0; i < 5; i++) A.noise({ type: 'bandpass', f0: 2000 + i * 400, q: 3, dur: 0.03, gain: 0.12, at: t + i * 0.035, bus: 'ui' });
  } },
  buy: { gap: 0.1, fn: (A, t) => {
    A.note(t, 1760, { dur: 0.12, gain: 0.08 });
    A.note(t + 0.06, 2349, { dur: 0.25, gain: 0.08 });
    A.boom(t, { f0: 160, f1: 70, dur: 0.18, gain: 0.25, bus: 'ui', noise: 0 });
  } },
  denied: { gap: 0.15, fn: (A) => A.osc({ type: 'square', f0: 190, f1: 150, dur: 0.14, gain: 0.06, bus: 'ui' }) },
};

export const audio = new AudioEngine();
