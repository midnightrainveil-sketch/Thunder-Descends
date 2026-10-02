import { CONFIG } from '../config.js';
import { ICONS } from './icons.js';
import { SKILL_ICONS } from './skillIcons.js';
import { PORTRAIT_ART } from './art.js';

// Game HUD (spec §11, real time). Dark translucent indigo panels with cut corners and 1 px cyan
// edges; crimson for HP and danger. Top-left: portrait, segmented HP bar, level badge, EXP bar.
// Top-center: wave counter + enemies left, boss bar during boss fights. Bottom-center: skill bar
// (basic attack, Q, E, R: icon, key, conic cooldown sweep + seconds, rank pips, ready glow; R buff
// ring; Shift dash: one pip per stack, sweep + seconds while out of stacks). Bottom-left: passive icon with crit %. Center banners (wave / boss / level).
const CSS = `
  .k-cross { position: absolute; left: 50%; top: 50%; width: 0; height: 0; opacity: 0; transition: opacity .12s; }
  .k-cross.on { opacity: 1; }
  .k-cross i { position: absolute; background: var(--k-cross-color); box-shadow: 0 0 2px rgba(0,0,0,.9); }
  .k-cross .dot { width: 3px; height: 3px; left: -1.5px; top: -1.5px; border-radius: 50%; }
  .k-cross .h { height: 2px; top: -1px; width: var(--k-cross-len); }
  .k-cross .v { width: 2px; left: -1px; height: var(--k-cross-len); }
  .k-cross .l { right: var(--k-cross-gap); } .k-cross .r { left: var(--k-cross-gap); }
  .k-cross .t { bottom: var(--k-cross-gap); } .k-cross .b { top: var(--k-cross-gap); }
  .k-hud { position: absolute; inset: 0; pointer-events: none; font-family: var(--font-text); color: #e6e1d3; transition: opacity .3s; }
  .k-hud.hidden { opacity: 0; }
  .k-panel { background: rgba(14, 20, 38, 0.75); border: 1px solid rgba(53, 224, 255, 0.45);
    clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px); }
  .k-tl { position: absolute; left: 16px; top: 14px; display: flex; gap: 10px; align-items: stretch; padding: 8px 12px 8px 8px; }
  .k-portrait { width: 52px; height: 52px; border: 1px solid rgba(53,224,255,0.6); }
  .k-portrait svg { width: 100%; height: 100%; display: block; }
  .k-bars { display: flex; flex-direction: column; justify-content: center; gap: 6px; min-width: 280px; }
  .k-row { display: flex; align-items: center; gap: 8px; }
  .k-lvl { font: 400 12px var(--font-num); color: #0e1426; background: #35e0ff; padding: 2px 6px; clip-path: polygon(5px 0,100% 0,100% 100%,0 100%,0 5px); }
  .k-lvl.flash { background: #fff; box-shadow: 0 0 12px #35e0ff; }
  .k-hp { display: flex; gap: 2px; flex: 1; height: 16px; }
  .k-hp i { flex: 1; background: rgba(215, 38, 61, 0.18); transform: skewX(-18deg); }
  .k-hp i.on { background: linear-gradient(#ff5a6e, #d7263d); box-shadow: 0 0 6px rgba(215,38,61,0.5); }
  .k-hp i.part { background: linear-gradient(90deg, #d7263d var(--k), rgba(215,38,61,0.18) var(--k)); }
  .k-nm { font: 400 11px var(--font-num); color: rgba(236,232,222,0.85); min-width: 76px; text-align: right; }
  .k-nm.hpn { font: 400 14px var(--font-num); color: #f4f1ea; min-width: 84px; }
  /* Big health bar above the skill bar (always in view) + damage-lag trail. */
  .k-hpb { position: absolute; left: 50%; bottom: 102px; transform: translateX(-50%); width: min(520px, 70vw); display: flex; align-items: center; gap: 10px; }
  .k-hpb .bar { position: relative; flex: 1; height: 14px; background: rgba(40, 8, 14, 0.75); border: 1px solid rgba(255, 90, 110, 0.55); transform: skewX(-18deg); overflow: hidden; }
  .k-hpb .bar u { position: absolute; inset: 0; background: rgba(255,255,255,0.75); transform-origin: left; }
  .k-hpb .bar b { position: absolute; inset: 0; background: linear-gradient(#ff6a7c, #d7263d 60%, #9a1528); transform-origin: left; box-shadow: 0 0 10px rgba(215,38,61,0.6); }
  .k-hpb .bar.mid b { background: linear-gradient(#ffb36a, #e0702a 60%, #a24a14); }
  .k-hpb .n { font: 400 16px var(--font-num); color: #fff; text-shadow: 0 1px 3px #000; min-width: 92px; }
  .k-hpb.low .bar { animation: k-hp-pulse .6s ease-in-out infinite alternate; }
  .k-hpb.hit .bar { box-shadow: 0 0 16px rgba(255,255,255,0.8); }
  @keyframes k-hp-pulse { from { border-color: rgba(255,90,110,0.55); } to { border-color: #fff; box-shadow: 0 0 18px rgba(255,58,79,0.9); } }
  /* Score, style rank, combo, feed (top right). */
  .k-tr { position: absolute; right: 18px; top: 14px; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; text-align: right; }
  .k-score { font: 400 26px var(--font-num); color: #f4f1ea; text-shadow: 0 2px 6px rgba(0,0,0,0.8); letter-spacing: .04em; }
  .k-score small { display: block; font: 600 10px var(--font-text); letter-spacing: .3em; color: rgba(143,244,255,0.85); }
  .k-rank { display: flex; align-items: center; gap: 10px; margin-top: 6px; }
  .k-rank .ltr { font: 800 58px var(--font-text); line-height: .9; font-style: italic; text-shadow: 0 0 18px currentColor, 0 3px 0 rgba(0,0,0,0.7); transition: transform .12s; }
  .k-rank .ltr.pop { transform: scale(1.35) rotate(-4deg); }
  .k-rank .side { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
  .k-rank .nm { font: 700 12px var(--font-text); letter-spacing: .25em; text-transform: uppercase; }
  .k-rank .mtr { width: 130px; height: 5px; background: rgba(255,255,255,0.12); transform: skewX(-20deg); }
  .k-rank .mtr b { display: block; height: 100%; background: currentColor; transform-origin: left; box-shadow: 0 0 8px currentColor; }
  .k-rank .mul { font: 400 11px var(--font-num); color: rgba(236,232,222,0.8); }
  .k-combo { font: 700 22px var(--font-text); color: #fff; text-shadow: 0 0 10px rgba(53,224,255,0.7), 0 2px 0 rgba(0,0,0,0.7); transition: opacity .3s; }
  .k-combo small { font: 600 11px var(--font-text); letter-spacing: .2em; color: #8ff4ff; margin-left: 6px; }
  .k-feed { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; margin-top: 4px; min-height: 80px; }
  .k-feed div { font: 700 13px var(--font-text); letter-spacing: .14em; text-shadow: 0 2px 4px rgba(0,0,0,0.8); animation: k-feed 1.6s ease-out forwards; }
  .k-feed div b { font: 400 12px var(--font-num); margin-left: 8px; color: #fff; }
  @keyframes k-feed { 0% { opacity: 0; transform: translateX(14px); } 10% { opacity: 1; transform: none; } 75% { opacity: 1; } 100% { opacity: 0; transform: translateY(-6px); } }
  /* Achievement toast (top centre, under the wave box). */
  .k-toast { position: absolute; left: 50%; top: 74px; transform: translateX(-50%); padding: 8px 18px; display: flex; gap: 12px; align-items: center; opacity: 0; transition: opacity .3s, transform .3s; }
  .k-toast.on { opacity: 1; transform: translate(-50%, 6px); }
  .k-toast .ic { width: 26px; height: 26px; color: #ffd166; }
  .k-toast .ic svg { width: 100%; height: 100%; }
  .k-toast .t { font: 600 10px var(--font-text); letter-spacing: .3em; color: #ffd166; }
  .k-toast .n { font: 700 15px var(--font-text); letter-spacing: .08em; }
  .k-toast .r { font: 400 12px var(--font-num); color: #8ff4ff; }
  /* Low-HP warning vignette. */
  .k-lowhp { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .25s;
    background: radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(210,10,30,0.75) 100%); box-shadow: inset 0 0 60px rgba(255,30,50,0.6); }
  .k-lowhp.on { animation: k-low-pulse 1s ease-in-out infinite; }
  @keyframes k-low-pulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }
  .k-exp { flex: 1; height: 4px; background: rgba(53,224,255,0.15); position: relative; }
  .k-exp b { position: absolute; inset: 0; background: linear-gradient(90deg, #1aa6c4, #35e0ff); transform-origin: left; }
  .k-tc { position: absolute; left: 50%; top: 12px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .k-wave { padding: 5px 18px; font: 600 14px var(--font-text); letter-spacing: .14em; text-align: center; }
  .k-wave small { display: block; font: 400 10px var(--font-num); letter-spacing: .05em; color: rgba(143,244,255,0.85); margin-top: 2px; }
  .k-boss { width: min(560px, 60vw); padding: 6px 12px 8px; display: none; }
  .k-boss .nm { font: 600 13px var(--font-text); letter-spacing: .2em; text-align: center; color: #ffd0d6; margin-bottom: 4px; }
  .k-boss .bar { height: 10px; background: rgba(215,38,61,0.15); position: relative; border: 1px solid rgba(215,38,61,0.5); }
  .k-boss .bar b { position: absolute; inset: 0; background: linear-gradient(90deg, #8e1a2a, #ff3a4f); transform-origin: left; transition: transform .15s; }
  .k-boss .bar u { position: absolute; inset: 0; background: rgba(255,255,255,0.5); transform-origin: left; transition: transform .6s .2s; }
  .k-boss .hpn { font: 400 10px var(--font-num); text-align: right; margin-top: 3px; color: rgba(236,232,222,0.7); }
  .k-boss.enraged .nm { color: #ff5a6e; text-shadow: 0 0 8px rgba(255,58,79,0.7); }
  .k-skills { position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%); display: flex; gap: 10px; padding: 8px 12px; }
  .k-slot { position: relative; width: 58px; height: 58px; border: 1px solid rgba(53,224,255,0.4); background: rgba(8, 12, 26, 0.8); color: #35e0ff;
    clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px); }
  .k-slot svg { position: absolute; inset: 9px; width: 40px; height: 40px; }
  .k-slot .art { position: absolute; inset: 1px; width: calc(100% - 2px); height: calc(100% - 2px); object-fit: cover; opacity: 0.85; }
  .k-slot.ready .art, .k-slot.active .art { opacity: 1; }
  .k-slot .key { z-index: 1; text-shadow: 0 1px 2px #000; }
  .k-slot .sweep { position: absolute; inset: 0; background: conic-gradient(rgba(5,8,18,0.82) calc(var(--p) * 1turn), transparent 0); }
  .k-slot .sec { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font: 700 16px var(--font-num); color: #f4f1ea; text-shadow: 0 1px 2px #000; }
  .k-slot .key { position: absolute; left: 3px; top: 1px; font: 400 10px var(--font-num); color: #e6e1d3; }
  .k-slot .pips { position: absolute; left: 0; right: 0; bottom: 3px; display: flex; justify-content: center; gap: 3px; }
  .k-slot .pips i { width: 6px; height: 6px; transform: rotate(45deg); border: 1px solid rgba(53,224,255,0.7); }
  .k-slot .pips i.on { background: #35e0ff; }
  .k-slot.ready { box-shadow: inset 0 0 14px rgba(53,224,255,0.45); border-color: rgba(53,224,255,0.9); }
  .k-slot.active { color: #fff; box-shadow: inset 0 0 18px rgba(255,255,255,0.5); }
  .k-slot .buff { position: absolute; inset: 2px; border-radius: 50%; display: none;
    background: conic-gradient(#ff3a4f calc(var(--b) * 1turn), transparent 0); -webkit-mask: radial-gradient(circle, transparent 58%, #000 60%); mask: radial-gradient(circle, transparent 58%, #000 60%); }
  .k-slot.buffing .buff { display: block; }
  .k-slot.buffing { color: #ff6a7c; }
  .k-bl { position: absolute; left: 16px; bottom: 16px; display: flex; gap: 10px; align-items: center; padding: 8px 14px 8px 10px; }
  .k-bl .ic { width: 30px; height: 30px; color: #ffe14a; }
  .k-bl .ic svg { width: 100%; height: 100%; }
  .k-bl .t { font: 600 11px var(--font-text); letter-spacing: .2em; color: rgba(143,244,255,0.9); }
  .k-bl .v { font: 400 16px var(--font-num); }
  .k-banner { position: absolute; left: 50%; top: 28%; transform: translate(-50%, -50%); text-align: center; opacity: 0; transition: opacity .3s; }
  .k-banner .big { font: 700 52px var(--font-text); letter-spacing: .3em; color: #f4f1ea; text-shadow: 0 0 18px rgba(53,224,255,0.55), 0 3px 0 rgba(0,0,0,0.7); }
  .k-banner .small { font: 500 14px var(--font-text); letter-spacing: .24em; color: rgba(143,244,255,0.9); margin-top: 4px; }
  .k-banner.boss .big { color: #ffd0d6; font-size: 58px; text-shadow: 0 0 22px rgba(255,58,79,0.8), 0 3px 0 rgba(0,0,0,0.7); }
  .k-banner.boss .small { color: #ff8a98; }
`;

const SLOTS = [
  { id: 'lmb', key: 'LMB', icon: 'attack' },
  { id: 'q', key: 'Q', icon: 'claw' },
  { id: 'e', key: 'E', icon: 'shatter' },
  { id: 'r', key: 'R', icon: 'demontime' },
  { id: 'dash', key: 'SHIFT', icon: 'dash' },
];

export class HUD {
  constructor(root) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    const N = CONFIG.ui.hpSegments;
    this.el = document.createElement('div');
    this.el.className = 'k-hud hidden';
    this.el.innerHTML = `
      <div class="k-lowhp"></div>
      <div class="k-cross"><i class="dot"></i><i class="h l"></i><i class="h r"></i><i class="v t"></i><i class="v b"></i></div>
      <div class="k-tl k-panel">
        <div class="k-portrait"><img src="${PORTRAIT_ART}" alt="" style="width:100%;height:100%;display:block;object-fit:cover"></div>
        <div class="k-bars">
          <div class="k-row"><span class="k-lvl">Lv 1</span><span class="k-hp">${'<i></i>'.repeat(N)}</span><span class="k-nm hpn"></span></div>
          <div class="k-row"><span class="k-nm" style="min-width:0;text-align:left;color:#8ff4ff">EXP</span><span class="k-exp"><b></b></span><span class="k-nm exn"></span></div>
        </div>
      </div>
      <div class="k-tc">
        <div class="k-wave k-panel"><span class="wv">Wave 1</span><small class="wl"></small></div>
        <div class="k-boss k-panel"><div class="nm"></div><div class="bar"><u></u><b></b></div><div class="hpn"></div></div>
      </div>
      <div class="k-skills k-panel">${SLOTS.map((s) => `<div class="k-slot" data-id="${s.id}"><img class="art" src="${SKILL_ICONS[s.icon]}" alt=""><div class="buff"></div><div class="sweep"></div><div class="sec"></div><span class="key">${s.key}</span><div class="pips">${s.id === 'lmb' ? '' : '<i></i>'.repeat(s.id === 'dash' ? CONFIG.hero.dash.charges : 4)}</div></div>`).join('')}</div>
      <div class="k-bl k-panel"><div class="ic">${ICONS.passive}</div><div><div class="t">CRIT</div><div class="v cr">50%</div></div></div>
      <div class="k-banner"><div class="big"></div><div class="small"></div></div>
      <div class="k-hpb"><div class="bar"><u></u><b></b></div><div class="n"></div></div>
      <div class="k-tr">
        <div class="k-score"><small>SCORE</small><span class="sv">0</span></div>
        <div class="k-rank"><div class="side"><span class="nm"></span><span class="mtr"><b></b></span><span class="mul"></span></div><span class="ltr">D</span></div>
        <div class="k-combo"><span class="cv"></span><small>HITS</small></div>
        <div class="k-feed"></div>
      </div>
      <div class="k-toast k-panel"><div class="ic">${ICONS.core}</div><div><div class="t">ACHIEVEMENT</div><div class="n"></div></div><div class="r"></div></div>`;
    root.appendChild(this.el);
    const q = (s) => this.el.querySelector(s);
    const X = CONFIG.ui.crosshair;
    this.cross = q('.k-cross');
    this.cross.style.setProperty('--k-cross-color', X.color);
    this.cross.style.setProperty('--k-cross-len', `${X.length}px`);
    this.cross.style.setProperty('--k-cross-gap', `${X.gap}px`);
    this.cross.style.top = `${50 - CONFIG.camera.follow.crosshairY * 50}%`; // on the aim ray
    this._crossOn = false;
    this.lvl = q('.k-lvl');
    this.hpSegs = [...this.el.querySelectorAll('.k-hp i')];
    this.hpn = q('.hpn');
    this.exBar = q('.k-exp b');
    this.exn = q('.exn');
    this.wv = q('.wv');
    this.wl = q('.wl');
    this.bossEl = q('.k-boss');
    this.bossName = q('.k-boss .nm');
    this.bossBar = q('.k-boss .bar b');
    this.bossLag = q('.k-boss .bar u');
    this.bossHp = q('.k-boss .hpn');
    this.slots = Object.fromEntries(SLOTS.map((s) => [s.id, this.el.querySelector(`.k-slot[data-id="${s.id}"]`)]));
    this.cr = q('.cr');
    this.bannerEl = q('.k-banner');
    this.scoreEl = q('.k-score .sv');
    this.rankEl = q('.k-rank');
    this.rankLtr = q('.k-rank .ltr');
    this.rankNm = q('.k-rank .nm');
    this.rankMtr = q('.k-rank .mtr b');
    this.rankMul = q('.k-rank .mul');
    this.comboEl = q('.k-combo');
    this.comboV = q('.k-combo .cv');
    this.feedEl = q('.k-feed');
    this.toastEl = q('.k-toast');
    this.shownScore = 0;
    this.toastQ = [];
    this.toastT = 0;
    this.hpb = q('.k-hpb');
    this.hpbBar = q('.k-hpb .bar');
    this.hpbFill = q('.k-hpb .bar b');
    this.hpbLag = q('.k-hpb .bar u');
    this.hpbNum = q('.k-hpb .n');
    this.lowEl = q('.k-lowhp');
    this.hpLag = 1; // trailing white "damage taken" segment (0..1)
    this.hpPrev = 1;
    this.hitT = 0;
    this.bannerT = 0;
    this._lvlT = 0;
    this._cache = {};
  }

  setVisible(on) {
    this.el.classList.toggle('hidden', !on);
  }

  banner(text, sub = '', duration = CONFIG.waves.bannerTime, boss = false) {
    this.bannerEl.querySelector('.big').textContent = text;
    this.bannerEl.querySelector('.small').textContent = sub;
    this.bannerEl.classList.toggle('boss', boss);
    this.bannerEl.style.opacity = '1';
    this.bannerT = duration;
  }

  clearBanner() {
    this.bannerT = 0;
    this.bannerEl.style.opacity = '0';
  }

  bossBanner(name) {
    this.banner(name, 'boss', 2.2, true);
  }

  flashLevel() {
    this._lvlT = 1.2;
  }

  _set(key, value, fn) {
    if (this._cache[key] === value) return;
    this._cache[key] = value;
    fn(value);
  }

  // Callout in the feed under the rank ("DODGE", "WAVE 2 CLEAR +800").
  feed(text, color = '#8ff4ff', points = 0) {
    const d = document.createElement('div');
    d.style.color = color;
    d.textContent = text;
    if (points > 0) {
      const b = document.createElement('b');
      b.textContent = `+${points.toLocaleString('en-US')}`;
      d.appendChild(b);
    }
    this.feedEl.prepend(d);
    while (this.feedEl.children.length > 5) this.feedEl.lastChild.remove();
    setTimeout(() => d.remove(), 1700);
  }

  rankPop() {
    this.rankLtr.classList.add('pop');
    setTimeout(() => this.rankLtr.classList.remove('pop'), 140);
  }

  toast(def) {
    this.toastQ.push(def);
  }

  // Screen-center crosshair (follow camera): where the view, and so the aim, points.
  setCrosshair(on) {
    if (on === this._crossOn) return;
    this._crossOn = on;
    this.cross.classList.toggle('on', on);
  }

  update(realDt, game) {
    // Score (counts up), style rank, combo.
    const sc = game.score;
    if (sc) {
      this.shownScore += (sc.score - this.shownScore) * Math.min(1, realDt * 10);
      if (Math.abs(sc.score - this.shownScore) < 1) this.shownScore = sc.score;
      this._set('sv', Math.round(this.shownScore), (v) => (this.scoreEl.textContent = v.toLocaleString('en-US')));
      const R = sc.rankDef;
      this._set('rk', sc.rank, () => {
        this.rankLtr.textContent = R.id;
        this.rankNm.textContent = R.name;
        this.rankEl.style.color = R.color;
      });
      this._set('rp', Math.round(sc.rankProgress * 100), (v) => (this.rankMtr.style.transform = `scaleX(${v / 100})`));
      this._set('rm', `×${sc.mult.toFixed(2)}`, (v) => (this.rankMul.textContent = v));
      this._set('cb', sc.combo, (v) => (this.comboV.textContent = v));
      this.comboEl.style.opacity = sc.combo >= 3 ? 1 : 0;
      this.rankEl.style.opacity = sc.style > 0 || sc.rank > 0 ? 1 : 0.45;
    }
    // Achievement toasts, one at a time.
    this.toastT -= realDt;
    if (this.toastT <= 0 && this.toastQ.length) {
      const d = this.toastQ.shift();
      this.toastEl.querySelector('.n').textContent = d.name;
      this.toastEl.querySelector('.r').textContent = `+${d.reward} ◆`;
      this.toastEl.classList.add('on');
      this.toastT = CONFIG.ui.toastTime;
    } else if (this.toastT <= 0) this.toastEl.classList.remove('on');

    const S = game.hero.stats;
    const P = game.progression;
    const W = game.waves;
    const N = this.hpSegs.length;
    // HP (segmented), level, EXP
    const hpK = Math.max(0, S.hp / S.maxHp);
    this._set('hp', Math.round(hpK * 400), () => {
      const f = hpK * N;
      this.hpSegs.forEach((el, i) => {
        el.className = i < Math.floor(f) ? 'on' : i < f ? 'part' : '';
        if (i === Math.floor(f)) el.style.setProperty('--k', `${((f % 1) * 100).toFixed(0)}%`);
      });
    });
    this._set('hpn', `${Math.ceil(S.hp)} / ${Math.round(S.maxHp)}${game.godMode ? ' god' : ''}`, (v) => (this.hpn.textContent = v));
    // Big bar: fill, damage-lag trail (holds, then drains), colour by level, low-HP warning.
    const U = CONFIG.ui;
    if (hpK < this.hpPrev - 1e-4) this.hitT = U.hpHitFlash;
    if (hpK > this.hpLag) this.hpLag = hpK;
    this._lagHold = hpK < this.hpPrev - 1e-4 ? U.hpLagHold : Math.max(0, (this._lagHold || 0) - realDt);
    if (this._lagHold <= 0) this.hpLag = Math.max(hpK, this.hpLag - U.hpLagDrain * realDt);
    this.hpPrev = hpK;
    this.hitT = Math.max(0, this.hitT - realDt);
    this._set('hpbf', Math.round(hpK * 1000), (v) => (this.hpbFill.style.transform = `scaleX(${v / 1000})`));
    this._set('hpbl', Math.round(this.hpLag * 1000), (v) => (this.hpbLag.style.transform = `scaleX(${v / 1000})`));
    this._set('hpbn', `${Math.ceil(S.hp)} / ${Math.round(S.maxHp)}`, (v) => (this.hpbNum.textContent = v));
    const low = hpK > 0 && hpK <= U.hpLow;
    this.hpbBar.classList.toggle('mid', hpK > U.hpLow && hpK <= U.hpMid);
    this.hpb.classList.toggle('low', low);
    this.hpb.classList.toggle('hit', this.hitT > 0);
    this.lowEl.classList.toggle('on', low && !game.hero.dead);
    this._set('lvl', P.level, (v) => (this.lvl.textContent = `Lv ${v}`));
    this._set('ex', Math.round((P.exp / P.expToNext) * 200), (v) => (this.exBar.style.transform = `scaleX(${v / 200})`));
    this._set('exn', `${Math.floor(P.exp)} / ${P.expToNext}`, (v) => (this.exn.textContent = v));
    this._lvlT = Math.max(0, this._lvlT - realDt);
    this.lvl.classList.toggle('flash', this._lvlT > 0);
    // Wave
    const boss = game.boss;
    this._set('wv', W.wave, (v) => (this.wv.textContent = v > 0 ? `Wave ${v}` : 'Wave —'));
    const left = boss ? boss.name : W.state === 'break' ? 'next wave incoming' : `${Math.max(0, W.remaining)} enemies left`;
    this._set('wl', left, (v) => (this.wl.textContent = v));
    // Boss bar
    this.bossEl.style.display = boss ? 'block' : 'none';
    if (boss) {
      const k = Math.max(0, boss.hp / boss.maxHp);
      this._set('bn', boss.name, (v) => (this.bossName.textContent = v));
      this._set('bk', Math.round(k * 500), (v) => {
        this.bossBar.style.transform = `scaleX(${v / 500})`;
        this.bossLag.style.transform = `scaleX(${v / 500})`;
      });
      this._set('bh', `${Math.ceil(boss.hp)} / ${Math.round(boss.maxHp)}`, (v) => (this.bossHp.textContent = v));
      this.bossEl.classList.toggle('enraged', !!boss.enraged);
    }
    // Skills
    const SK = game.hero.skills;
    for (const id of ['q', 'e', 'r']) {
      const sk = SK[id];
      const el = this.slots[id];
      const p = sk.cd > 0 ? sk.cd / sk.cooldownMax : 0;
      this._set(`${id}p`, Math.round(p * 100), (v) => el.style.setProperty('--p', v / 100));
      this._set(`${id}s`, sk.cd > 0 ? Math.ceil(sk.cd * 10) / 10 : 0, (v) => (el.querySelector('.sec').textContent = v > 0 ? (v >= 10 ? Math.ceil(v) : v.toFixed(1)) : ''));
      this._set(`${id}r`, sk.rank, (v) => el.querySelectorAll('.pips i').forEach((pip, i) => pip.classList.toggle('on', i < v)));
      el.classList.toggle('ready', sk.cd <= 0 && !sk.active);
      el.classList.toggle('active', sk.active);
    }
    const R = SK.r;
    const rel = this.slots.r;
    rel.classList.toggle('buffing', R.buffActive);
    if (R.buffActive) rel.style.setProperty('--b', (R.buffT / R.buffMax).toFixed(3));
    const dash = game.hero.dash;
    const dEl = this.slots.dash;
    const dMax = dash.maxCharges;
    const empty = dash.charges <= 0;
    this._set('dp', empty ? Math.round((1 - dash.recharge01) * 100) : 0, (v) => dEl.style.setProperty('--p', v / 100));
    const dLeft = empty ? Math.ceil((1 - dash.recharge01) * dash.rechargeTime * 10) / 10 : 0;
    this._set('ds', dLeft, (v) => (dEl.querySelector('.sec').textContent = v > 0 ? v.toFixed(1) : ''));
    this._set('dc', `${dash.charges}/${dMax}`, () => {
      const pips = dEl.querySelectorAll('.pips i');
      if (pips.length !== dMax) dEl.querySelector('.pips').innerHTML = '<i></i>'.repeat(dMax);
      dEl.querySelectorAll('.pips i').forEach((pip, i) => pip.classList.toggle('on', i < dash.charges));
    });
    dEl.classList.toggle('ready', !empty && !dash.active);
    dEl.classList.toggle('active', dash.active);
    const lmb = this.slots.lmb;
    lmb.classList.toggle('active', game.hero.combo.active);
    lmb.classList.toggle('ready', !game.hero.combo.active);
    lmb.style.setProperty('--p', 0);
    // Crit
    this._set('cr', Math.round(game.hero.critChance * 100), (v) => (this.cr.textContent = `${v}%`));
    // Banner
    if (this.bannerT > 0) {
      this.bannerT -= realDt;
      if (this.bannerT <= 0) this.bannerEl.style.opacity = '0';
    }
  }
}
