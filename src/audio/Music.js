import { CONFIG } from '../config.js';

// D "in" scale (D, Eb, G, A, Bb) over three octaves, Hz.
const SCALE = [0, 1, 5, 7, 8];
const D2 = 73.42;
const noteHz = (i) => D2 * Math.pow(2, (12 * Math.floor(i / 5) + SCALE[((i % 5) + 5) % 5]) / 12);

/**
 * Generative soundtrack (Web Audio, scheduled ~0.12 s ahead on a 16th-note grid).
 *  intensity 0 (title, menus): drone pad only.
 *  intensity 1 (waves): + taiko on the downbeats, sparse koto plucks.
 *  intensity 2 (boss): + driving taiko, shime taps, bass pulse, busier plucks an octave up.
 * Layers fade between levels; the pad breathes with a slow filter LFO.
 */
export class Music {
  constructor(audio) {
    this.a = audio;
    this.intensity = 0;
    this.step = 0;
    this.next = 0;
    this.timer = null;
  }

  start() {
    const A = this.a;
    const ctx = A.ctx;
    // Drone pad: root + fifth, slightly detuned saws through a breathing lowpass.
    this.pad = ctx.createGain();
    this.pad.gain.value = 0.0001;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    f.Q.value = 2;
    const lfo = ctx.createOscillator();
    const lfoAmt = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoAmt.gain.value = 180;
    lfo.connect(lfoAmt).connect(f.frequency);
    lfo.start();
    for (const [hz, det] of [[D2, -6], [D2, 7], [D2 * 1.5, 0], [D2 * 2, 4]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz;
      o.detune.value = det;
      o.connect(f);
      o.start();
    }
    f.connect(this.pad).connect(A.buses.music);
    this.pad.gain.setTargetAtTime(0.05, ctx.currentTime, 1.5);
    this.next = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this._schedule(), 25);
  }

  setIntensity(level) {
    if (level === this.intensity || !this.pad) return;
    this.intensity = level;
    const ctx = this.a.ctx;
    this.pad.gain.setTargetAtTime(level === 2 ? 0.035 : 0.05, ctx.currentTime, 0.8);
  }

  _schedule() {
    const A = this.a;
    const ctx = A.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const sixteenth = 60 / CONFIG.audio.musicBpm / 4;
    if (this.next < ctx.currentTime - 0.5) this.next = ctx.currentTime + 0.05; // after a stall
    while (this.next < ctx.currentTime + 0.12) {
      this._step(this.step, this.next);
      this.next += sixteenth;
      this.step = (this.step + 1) % 64; // 4 bars
    }
  }

  _step(s, t) {
    const A = this.a;
    const lvl = this.intensity;
    const b = s % 16; // position in the bar
    const bar = Math.floor(s / 16);
    if (lvl >= 1) {
      // Taiko (o-daiko): downbeats; boss adds a driving pattern.
      const taiko = lvl === 2 ? [0, 3, 6, 8, 10, 12, 14] : [0, 8, bar % 2 ? 11 : 6];
      if (taiko.includes(b)) {
        const accent = b === 0 ? 1 : 0.7;
        A.osc({ type: 'sine', f0: 105, f1: 42, dur: 0.42, gain: 0.5 * accent, at: t, bus: 'music', attack: 0.002 });
        A.noise({ type: 'lowpass', f0: 900, f1: 120, dur: 0.18, gain: 0.25 * accent, at: t, bus: 'music' });
      }
      // Koto plucks: sparse in waves, busier and higher for bosses.
      const chance = lvl === 2 ? 0.45 : 0.22;
      if (b % 2 === 0 && Math.random() < chance) {
        const i = 5 + Math.floor(Math.random() * (lvl === 2 ? 8 : 6)) + (lvl === 2 ? 3 : 0);
        const hz = noteHz(i);
        A.osc({ type: 'triangle', f0: hz, dur: 0.55, gain: 0.07, at: t, bus: 'music', attack: 0.002 });
        A.osc({ type: 'sine', f0: hz * 2, dur: 0.25, gain: 0.025, at: t, bus: 'music', attack: 0.002 });
      }
    }
    if (lvl === 2) {
      // Shime taps on the off-8ths and a bass pulse on the beats.
      if (b % 4 === 2) A.noise({ type: 'bandpass', f0: 3200, q: 3, dur: 0.05, gain: 0.12, at: t, bus: 'music' });
      if (b % 4 === 0) A.osc({ type: 'sawtooth', f0: D2 / 2, dur: 0.22, gain: 0.08, at: t, bus: 'music', filter: { f: 300 } });
    }
  }
}
