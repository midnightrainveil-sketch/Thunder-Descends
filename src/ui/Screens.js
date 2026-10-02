import { CONFIG } from '../config.js';
import { SPLASH_ART } from './art.js';
import { ICONS } from './icons.js';
import { audio } from '../audio/Audio.js';
import { save } from '../game/Save.js';
import { meta } from '../game/Meta.js';

// Full-screen UI (spec §11, real time): title over the live arena, pause, level-up cards,
// game over and demo clear. Buttons are `.interactive` (the UI root ignores the pointer otherwise).
const CSS = `
  .k-title { isolation: isolate; }
  .k-lock { background: rgba(5,7,15,0.35); }
  .k-lock h2 { font-size: 28px; }
  .k-title .splash { position: absolute; inset: 0; z-index: -1; background-position: center; background-size: cover; background-repeat: no-repeat; }
  .k-scr { position: absolute; inset: 0; display: none; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; font-family: var(--font-text); color: #e6e1d3; }
  .k-scr.on { display: flex; }
  .k-scr.dim { background: radial-gradient(ellipse at center, rgba(14,20,38,0.55), rgba(5,7,15,0.85)); }
  .k-title { background: linear-gradient(to bottom, rgba(5,7,15,0.0) 30%, rgba(5,7,15,0.75)); justify-content: flex-end; padding-bottom: 9vh; }
  .k-title h1 { margin: 0; font: 700 min(7.2vw, 92px) var(--font-text); letter-spacing: .22em; padding-left: .22em; text-align: center; color: #f4f1ea;
    text-shadow: 0 0 28px rgba(53,224,255,0.6), 0 4px 0 rgba(0,0,0,0.6); }
  .k-title .sub { font: 500 14px var(--font-text); letter-spacing: .5em; color: rgba(143,244,255,0.9); margin-top: 2px; }
  .k-title .ctl { display: grid; grid-template-columns: auto auto; gap: 4px 18px; margin: 26px 0 22px; padding: 12px 20px; font-size: 13px; }
  .k-title .ctl b { font: 400 11px var(--font-num); color: #35e0ff; text-align: right; }
  .k-title .go { font: 600 18px var(--font-text); letter-spacing: .3em; color: #fff; animation: kblink 1.4s ease-in-out infinite; }
  @keyframes kblink { 50% { opacity: .35; } }
  .k-box { padding: 26px 40px; min-width: 320px; text-align: center; background: rgba(14,20,38,0.88); border: 1px solid rgba(53,224,255,0.5);
    clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px); }
  .k-box h2 { margin: 0 0 6px; font: 700 40px var(--font-text); letter-spacing: .24em; }
  .k-box .stats { font: 400 12px var(--font-num); color: rgba(236,232,222,0.8); line-height: 1.9; margin: 12px 0 18px; }
  .k-box .hint { font: 500 13px var(--font-text); letter-spacing: .2em; color: rgba(143,244,255,0.9); margin-top: 14px; }
  .k-btn { display: block; width: 240px; margin: 8px auto; padding: 9px 0; font: 600 14px var(--font-text); letter-spacing: .18em; color: #e6e1d3; cursor: pointer;
    background: rgba(53,224,255,0.08); border: 1px solid rgba(53,224,255,0.55); clip-path: polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px); }
  .k-sl { display: block; width: 240px; margin: 10px auto; font: 600 12px var(--font-text); letter-spacing: .12em; color: #e6e1d3; text-align: left; }
  .k-sl b { float: right; font: 400 11px var(--font-num); color: #8ff4ff; }
  .k-sl input { width: 100%; accent-color: #35e0ff; margin-top: 4px; }
  .k-btn:hover { background: rgba(53,224,255,0.22); color: #fff; }
  .k-over h2 { color: #ff3a4f; text-shadow: 0 0 20px rgba(215,38,61,0.6); }
  .k-clear h2 { color: #8ff4ff; text-shadow: 0 0 20px rgba(53,224,255,0.6); }
  .k-cards-h { text-align: center; margin-bottom: 26px; }
  .k-cards-h h2 { margin: 0; font: 700 50px var(--font-text); letter-spacing: .3em; color: #f4f1ea; text-shadow: 0 0 22px rgba(53,224,255,0.7); }
  .k-cards-h div { font: 500 12px var(--font-text); letter-spacing: .5em; color: rgba(143,244,255,0.85); }
  .k-cards { display: flex; gap: 26px; }
  .k-card { width: 230px; height: 320px; padding: 22px 18px; box-sizing: border-box; cursor: pointer; display: flex; flex-direction: column; align-items: center; text-align: center;
    background: linear-gradient(rgba(14,20,38,0.94), rgba(8,12,26,0.94)); border: 1px solid rgba(53,224,255,0.6); position: relative;
    clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px); transition: transform .12s, box-shadow .12s; }
  .k-card:hover, .k-card.sel { transform: translateY(-6px); box-shadow: inset 0 0 26px rgba(53,224,255,0.35); border-color: #8ff4ff; }
  .k-card .n { position: absolute; left: 10px; top: 8px; font: 400 11px var(--font-num); color: rgba(143,244,255,0.8); }
  .k-card .kind { position: absolute; right: 12px; top: 8px; font: 500 10px var(--font-text); letter-spacing: .2em; color: rgba(255,90,110,0.85); }
  .k-card .ic { width: 96px; height: 96px; color: #35e0ff; margin: 18px 0 16px; filter: drop-shadow(0 0 8px rgba(53,224,255,0.6)); }
  .k-card .ic svg { width: 100%; height: 100%; }
  .k-card h3 { margin: 0; font: 700 19px var(--font-text); letter-spacing: .08em; }
  .k-card .line { width: 60%; height: 1px; background: rgba(53,224,255,0.5); margin: 12px 0; }
  .k-card p { margin: 0; font: 500 13px var(--font-text); line-height: 1.45; color: rgba(236,232,222,0.88); flex: 1; }
  .k-card .pips { display: flex; gap: 8px; margin-top: 8px; }
  .k-card .pips i { width: 10px; height: 10px; transform: rotate(45deg); border: 1px solid #35e0ff; }
  .k-card .pips i.on { background: #35e0ff; }
  .k-card .pips i.nx { background: rgba(255,255,255,0.9); box-shadow: 0 0 8px #fff; }
  .k-cards-f { margin-top: 22px; font: 500 12px var(--font-text); letter-spacing: .25em; color: rgba(236,232,222,0.6); display: flex; flex-direction: column; align-items: center; gap: 8px; }
  /* Card rarity, deal-in, pick. */
  .k-card { --rc: #35e0ff; border-color: var(--rc); opacity: 0; animation: k-deal .42s cubic-bezier(.2,.9,.3,1.3) forwards; }
  .k-card .ic { color: var(--rc); filter: drop-shadow(0 0 8px var(--rc)); }
  .k-card .line { background: var(--rc); }
  .k-card .rar { position: absolute; left: 0; right: 0; bottom: 0; padding: 4px 0; font: 700 10px var(--font-text); letter-spacing: .4em; color: #0b1020; background: var(--rc); }
  .k-card .kind { color: var(--rc); }
  .k-card:hover, .k-card.sel { box-shadow: inset 0 0 30px color-mix(in srgb, var(--rc) 45%, transparent), 0 0 24px color-mix(in srgb, var(--rc) 40%, transparent); border-color: var(--rc); }
  .k-card.r-rare { --rc: #5fa8ff; }
  .k-card.r-epic { --rc: #c07aff; }
  .k-card.r-legendary { --rc: #ffc94d; background: linear-gradient(160deg, rgba(60,44,10,0.95), rgba(14,12,26,0.95) 55%); }
  .k-card.r-legendary::after { content: ''; position: absolute; inset: 0; background: linear-gradient(110deg, transparent 35%, rgba(255,240,190,0.35) 50%, transparent 65%); background-size: 250% 100%; animation: k-shine 2.2s linear infinite; pointer-events: none; }
  .k-card.r-epic .ic, .k-card.r-legendary .ic { animation: k-float 1.6s ease-in-out infinite alternate; }
  .k-card.picked { animation: k-pick .45s ease-out forwards; z-index: 2; }
  .k-card.faded { animation: k-fade .3s ease-in forwards; }
  @keyframes k-deal { from { opacity: 0; transform: translateY(40px) rotateY(80deg) scale(.9); } to { opacity: 1; transform: none; } }
  @keyframes k-pick { 0% { opacity: 1; transform: scale(1); } 40% { transform: scale(1.12); box-shadow: 0 0 60px var(--rc); filter: brightness(1.6); } 100% { opacity: 0; transform: scale(1.05) translateY(-30px); } }
  @keyframes k-fade { to { opacity: 0; transform: translateY(30px) scale(.94); } }
  @keyframes k-shine { from { background-position: 150% 0; } to { background-position: -100% 0; } }
  @keyframes k-float { from { transform: translateY(-3px); } to { transform: translateY(3px); } }
  .k-reroll { width: auto; padding: 7px 22px; margin: 0; }
  .k-btn[disabled] { opacity: .35; pointer-events: none; }
  /* Title extras. */
  .k-title .menu { display: flex; gap: 14px; margin-top: 14px; pointer-events: auto; }
  .k-title .menu .k-btn { width: 170px; margin: 0; }
  .k-title .wallet { margin-top: 10px; font: 400 13px var(--font-num); color: #ffd166; text-shadow: 0 1px 3px #000; }
  .k-title .wallet span { color: #8ff4ff; margin-left: 16px; }
  /* Results. */
  .k-res { min-width: 420px; }
  .k-res .sc { font: 400 46px var(--font-num); color: #fff; margin: 4px 0 2px; text-shadow: 0 0 18px rgba(53,224,255,0.6); }
  .k-res .lbl { font: 600 11px var(--font-text); letter-spacing: .4em; color: rgba(143,244,255,0.85); }
  .k-res .best { font: 700 14px var(--font-text); letter-spacing: .3em; color: #ffd166; height: 20px; }
  .k-res .best.new { animation: k-newbest .5s ease-in-out infinite alternate; text-shadow: 0 0 14px #ffd166; }
  @keyframes k-newbest { from { transform: scale(1); } to { transform: scale(1.12); } }
  .k-res table { margin: 10px auto 6px; border-collapse: collapse; font: 400 12px var(--font-num); }
  .k-res td { padding: 3px 12px; color: rgba(236,232,222,0.85); }
  .k-res td:first-child { text-align: left; font: 600 11px var(--font-text); letter-spacing: .16em; color: rgba(143,244,255,0.85); }
  .k-res td:last-child { text-align: right; color: #fff; }
  .k-res .rk { font: 800 22px var(--font-text); font-style: italic; }
  .k-res .cores { margin: 10px 0 4px; font: 400 16px var(--font-num); color: #ffd166; }
  .k-res .ach { font: 600 11px var(--font-text); letter-spacing: .12em; color: #ffd166; margin-bottom: 6px; }
  /* Armory. */
  .k-arm .k-box { max-width: 980px; padding: 22px 30px; }
  .k-arm .cols { display: flex; gap: 26px; align-items: flex-start; text-align: left; }
  .k-arm .wallet { font: 400 18px var(--font-num); color: #ffd166; margin-bottom: 12px; }
  .k-arm .grid { display: grid; grid-template-columns: repeat(2, 250px); gap: 10px; }
  .k-tile { position: relative; padding: 10px 12px 10px 58px; min-height: 64px; background: rgba(8,12,26,0.85); border: 1px solid rgba(53,224,255,0.35);
    clip-path: polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px); cursor: pointer; transition: border-color .1s, box-shadow .1s; }
  .k-tile:hover { border-color: #8ff4ff; box-shadow: inset 0 0 18px rgba(53,224,255,0.25); }
  .k-tile.maxed { border-color: rgba(255,209,102,0.6); cursor: default; }
  .k-tile.poor { opacity: .6; }
  .k-tile.bought { animation: k-bought .35s ease-out; }
  @keyframes k-bought { 40% { box-shadow: inset 0 0 40px rgba(255,209,102,0.7); border-color: #ffd166; } }
  .k-tile .ic { position: absolute; left: 10px; top: 12px; width: 38px; height: 38px; color: #35e0ff; }
  .k-tile .ic svg { width: 100%; height: 100%; }
  .k-tile h4 { margin: 0; font: 700 13px var(--font-text); letter-spacing: .08em; }
  .k-tile p { margin: 2px 0 6px; font: 500 11px var(--font-text); color: rgba(236,232,222,0.75); }
  .k-tile .lv { display: flex; gap: 5px; }
  .k-tile .lv i { width: 8px; height: 8px; transform: rotate(45deg); border: 1px solid #35e0ff; }
  .k-tile .lv i.on { background: #35e0ff; }
  .k-tile .cost { position: absolute; right: 10px; bottom: 8px; font: 400 12px var(--font-num); color: #ffd166; }
  .k-arm .rec { width: 300px; }
  .k-arm .rec h3 { margin: 0 0 6px; font: 700 13px var(--font-text); letter-spacing: .3em; color: #8ff4ff; }
  .k-arm .rec .bests { font: 400 12px var(--font-num); line-height: 1.8; margin-bottom: 12px; }
  .k-arm .rec .bests b { color: #fff; float: right; }
  .k-arm .achs { max-height: 300px; overflow-y: auto; pointer-events: auto; }
  .k-arm .achs div { font: 500 11px var(--font-text); padding: 4px 0; border-bottom: 1px solid rgba(53,224,255,0.12); color: rgba(236,232,222,0.5); }
  .k-arm .achs div.on { color: #e6e1d3; }
  .k-arm .achs div b { display: block; font: 700 12px var(--font-text); letter-spacing: .06em; }
  .k-arm .achs div.on b { color: #ffd166; }
  .k-arm .achs div span { float: right; font: 400 11px var(--font-num); color: #ffd166; }
`;

export class Screens {
  constructor(root, game) {
    this.game = game;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    const mk = (cls, html) => {
      const el = document.createElement('div');
      el.className = `k-scr ${cls}`;
      el.innerHTML = html;
      root.appendChild(el);
      return el;
    };
    const N = CONFIG.names;
    this.title = mk('k-title', `
      <div class="splash" style="background-image:linear-gradient(to bottom, rgba(5,7,15,0) 35%, rgba(5,7,15,0.85)), url(${SPLASH_ART})"></div>
      <h1>${CONFIG.names.game.toUpperCase()}</h1>
      <div class="ctl k-panel">
        <b>WASD</b><span>move</span><b>MOUSE</b><span>turn camera · aim at screen center</span><b>V</b><span>third-person ⇄ fixed camera</span><b>HOLD LMB</b><span>attack (crits become whip strikes)</span><b>SHIFT</b><span>${N.dash} — invulnerable dash (3); attack after it to snap and strike</span>
        <b>Q</b><span>${N.q} — aim, click to fire</span><b>E</b><span>${N.e} — aim, click to thrust</span><b>R</b><span>${N.r} — stop time, upgrade the blade</span>
        <b>ESC / P</b><span>pause</span>
      </div>
      <div class="go">CLICK TO START</div>
      <div class="menu"><button class="k-btn interactive" data-a="armory">ARMORY</button></div>
      <div class="wallet"></div>`);
    this.pause = mk('dim', `<div class="k-box"><h2>PAUSED</h2>
      <button class="k-btn interactive" data-a="resume">Resume</button>
      <button class="k-btn interactive" data-a="restart">Restart</button>
      <button class="k-btn interactive" data-a="shake">Screen shake: on</button>
      <button class="k-btn interactive" data-a="raw">Raw mouse input: on</button>
      <label class="k-sl interactive">Mouse sensitivity <b data-v="sens"></b><input type="range" data-s="sens" min="0.0003" max="0.02" step="0.0001"></label>
      <label class="k-sl interactive">Mouse smoothing <b data-v="smooth"></b><input type="range" data-s="smooth" min="0" max="0.08" step="0.002"></label>
      <label class="k-sl interactive">Camera distance <b data-v="dist"></b><input type="range" data-s="dist" min="4" max="16" step="0.25"></label>
      <label class="k-sl interactive">Brightness <b data-v="light"></b><input type="range" data-s="light" min="0.5" max="3" step="0.05"></label>
      <label class="k-sl interactive">Master volume <b data-v="vmaster"></b><input type="range" data-s="vmaster" min="0" max="1" step="0.05"></label>
      <label class="k-sl interactive">Music <b data-v="vmusic"></b><input type="range" data-s="vmusic" min="0" max="1" step="0.05"></label>
      <label class="k-sl interactive">Effects <b data-v="vsfx"></b><input type="range" data-s="vsfx" min="0" max="1" step="0.05"></label>
      <div class="hint">ESC TO RESUME</div></div>`);
    this.over = mk('dim k-over', `<div class="k-box k-res"><h2>DEFEATED</h2><div class="res"></div>
      <button class="k-btn interactive" data-a="restart">Retry</button>
      <button class="k-btn interactive" data-a="armory">Armory</button><div class="hint">PRESS ENTER TO RETRY</div></div>`);
    this.clear = mk('dim k-clear', `<div class="k-box k-res"><h2>DEMO CLEAR</h2><div class="res"></div>
      <button class="k-btn interactive" data-a="continue">Continue (endless)</button>
      <button class="k-btn interactive" data-a="restart">Restart</button>
      <button class="k-btn interactive" data-a="armory">Armory</button></div>`);
    this.armory = mk('dim k-arm', `<div class="k-box"><h2>ARMORY</h2><div class="wallet"></div>
      <div class="cols"><div class="grid"></div><div class="rec"><h3>RECORDS</h3><div class="bests"></div><h3>ACHIEVEMENTS</h3><div class="achs"></div></div></div>
      <button class="k-btn interactive" data-a="back">Back</button></div>`);
    this.lockEl = mk('k-lock', `<div class="k-box"><h2>CLICK TO CONTINUE</h2><div class="hint">THE GAME HOLDS UNTIL THE MOUSE IS CAPTURED</div></div>`);
    this.cardsEl = mk('dim', `<div class="k-cards-h"><h2>LEVEL UP</h2><div>CHOOSE YOUR UPGRADE</div></div><div class="k-cards"></div>
      <div class="k-cards-f"><span>CLICK OR PRESS 1 · 2 · 3</span><button class="k-btn k-reroll interactive" data-a="reroll">REROLL (R)</button></div>`);
    for (const el of [this.title, this.pause, this.over, this.clear, this.armory, this.cardsEl]) {
      el.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-a]');
        if (btn) {
          audio.play('uiClick');
          this.onAction?.(btn.dataset.a);
        }
      });
    }
    this.cardsEl.addEventListener('click', (e) => {
      const c = e.target.closest('.k-card');
      if (c) this.onPick?.(+c.dataset.i);
    });
    // Hover ticks on buttons, cards and Armory tiles.
    root.addEventListener('mouseover', (e) => {
      const t = e.target.closest?.('.k-btn, .k-card, .k-tile');
      if (t && t !== this._hovered) audio.play('uiHover');
      this._hovered = t;
    });
    // Settings sliders (saved per browser).
    const SET = {
      sens: { obj: CONFIG.camera.follow, key: 'sensitivity', fmt: (v) => (v * 1000).toFixed(1) },
      smooth: { obj: CONFIG.camera.follow, key: 'lookSmoothing', fmt: (v) => (v > 0 ? `${Math.round(v * 1000)} ms` : 'off') },
      dist: { obj: CONFIG.camera.follow, key: 'distance', fmt: (v) => `${v.toFixed(1)} m` },
      light: { obj: CONFIG.lighting, key: 'brightness', fmt: (v) => `${Math.round(v * 100)}%`, apply: () => game.map.lighting.applySettings() },
      vmaster: { obj: CONFIG.audio, key: 'master', fmt: (v) => `${Math.round(v * 100)}%`, apply: () => audio.applyVolumes() },
      vmusic: { obj: CONFIG.audio, key: 'music', fmt: (v) => `${Math.round(v * 100)}%`, apply: () => audio.applyVolumes() },
      vsfx: { obj: CONFIG.audio, key: 'sfx', fmt: (v) => `${Math.round(v * 100)}%`, apply: () => audio.applyVolumes() },
    };
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('thunder.settings') || localStorage.getItem('kurogane.settings') || '{}'); } catch { /* storage blocked */ }
    // v2 (aim overhaul): look smoothing is off by default now, so an older saved value is dropped.
    if (saved.v !== 2) {
      delete saved.smooth;
      saved.v = 2;
      try { localStorage.setItem('thunder.settings', JSON.stringify(saved)); } catch { /* ignore */ }
    }
    if (typeof saved.raw === 'boolean') CONFIG.input.rawMouse = saved.raw;
    this._settings = { SET, saved };
    for (const [id, S] of Object.entries(SET)) {
      const input = this.pause.querySelector(`[data-s="${id}"]`);
      const out = this.pause.querySelector(`[data-v="${id}"]`);
      if (Number.isFinite(saved[id])) S.obj[S.key] = saved[id];
      input.value = S.obj[S.key];
      out.textContent = S.fmt(S.obj[S.key]);
      S.apply?.();
      input.addEventListener('input', () => {
        S.obj[S.key] = +input.value;
        out.textContent = S.fmt(+input.value);
        S.apply?.();
        saved[id] = +input.value;
        try { localStorage.setItem('thunder.settings', JSON.stringify(saved)); } catch { /* ignore */ }
      });
    }
    this.setRawLabel(CONFIG.input.rawMouse);
    this.onAction = null;
    this.onPick = null;
    this.current = null;
  }

  // A setting changed outside the menu (scroll-wheel zoom): save it and refresh its slider.
  syncSetting(id) {
    const { SET, saved } = this._settings;
    const S = SET[id];
    const v = S.obj[S.key];
    this.pause.querySelector(`[data-s="${id}"]`).value = v;
    this.pause.querySelector(`[data-v="${id}"]`).textContent = S.fmt(v);
    saved[id] = v;
    try { localStorage.setItem('thunder.settings', JSON.stringify(saved)); } catch { /* ignore */ }
  }

  showLockPrompt(on) {
    this.lockEl.classList.toggle('on', on);
  }

  show(name) {
    this.current = name;
    if (name && name !== 'title') this.game.hud.clearBanner(); // menus sit over a clean HUD
    const map = { title: this.title, pause: this.pause, over: this.over, clear: this.clear, cards: this.cardsEl, armory: this.armory };
    if (name === 'title') this.refreshTitle();
    for (const k in map) map[k].classList.toggle('on', k === name);
  }

  setRawLabel(on, save = false) {
    this.pause.querySelector('[data-a="raw"]').textContent = `Raw mouse input: ${on ? 'on' : 'off'}`;
    if (!save) return;
    const { saved } = this._settings;
    saved.raw = on;
    try { localStorage.setItem('thunder.settings', JSON.stringify(saved)); } catch { /* ignore */ }
  }

  setShakeLabel(on) {
    this.pause.querySelector('[data-a="shake"]').textContent = `Screen shake: ${on ? 'on' : 'off'}`;
  }

  showCards(cards, rerolls = 0) {
    const wrap = this.cardsEl.querySelector('.k-cards');
    const KIND = { skill: 'SKILL', passive: 'PASSIVE', stat: 'STAT', special: 'SPECIAL' };
    wrap.innerHTML = cards
      .map((c, i) => {
        const pips = Array.from({ length: c.maxRank }, (_, k) => `<i class="${k < c.rank ? 'on' : k === c.rank ? 'nx' : ''}"></i>`).join('');
        return `<div class="k-card interactive r-${c.rarity}" data-i="${i}" style="animation-delay:${i * 0.12}s"><span class="n">${i + 1}</span><span class="kind">${KIND[c.kind] || ''}</span><div class="ic">${ICONS[c.icon] || ICONS.passive}</div><h3>${c.title}</h3><div class="line"></div><p>${c.desc}</p><div class="pips">${pips}</div><div class="rar">${c.rarity.toUpperCase()}</div></div>`;
      })
      .join('');
    cards.forEach((c, i) => setTimeout(() => audio.play('cardReveal', { i, rarity: c.rarity }), i * 120));
    const rb = this.cardsEl.querySelector('.k-reroll');
    rb.textContent = `REROLL (R) · ${rerolls}`;
    rb.disabled = rerolls <= 0;
    this.show('cards');
  }

  // The chosen card flares and lifts away; the others drop.
  markPicked(i) {
    this.cardsEl.querySelectorAll('.k-card').forEach((el, k) => {
      el.style.animationDelay = '0s';
      el.classList.add(k === i ? 'picked' : 'faded');
    });
  }

  refreshTitle() {
    const d = save.data;
    const w = this.title.querySelector('.wallet');
    w.innerHTML = `◆ ${d.cores.toLocaleString('en-US')} THUNDER CORES${d.best.score > 0 ? `<span>BEST ${d.best.score.toLocaleString('en-US')}</span>` : ''}`;
  }

  /**
   * End-of-run results. data: { score, newBest, rows: [[label, value]], rank: {id, color}, cores,
   * total, achievements: [names] }. The score counts up; a new best pulses with a fanfare.
   */
  setResults(which, data) {
    const box = (which === 'over' ? this.over : this.clear).querySelector('.res');
    const rows = data.rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
    box.innerHTML = `<div class="lbl">SCORE</div><div class="sc">0</div><div class="best ${data.newBest ? 'new' : ''}">${data.newBest ? 'NEW BEST!' : `BEST ${data.best.toLocaleString('en-US')}`}</div>
      <table>${rows}<tr><td>BEST RANK</td><td class="rk" style="color:${data.rank.color}">${data.rank.id}</td></tr></table>
      <div class="cores">+${data.cores} ◆ THUNDER CORES <span style="color:#8ff4ff">(${data.total.toLocaleString('en-US')})</span></div>
      ${data.achievements.length ? `<div class="ach">UNLOCKED: ${data.achievements.join(' · ')}</div>` : ''}`;
    const el = box.querySelector('.sc');
    const t0 = performance.now();
    const dur = 1100;
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(data.score * (1 - Math.pow(1 - k, 3))).toLocaleString('en-US');
      if (k < 1) requestAnimationFrame(tick);
      else if (data.newBest) audio.play('newBest');
    };
    requestAnimationFrame(tick);
  }

  renderArmory(boughtId = null) {
    const d = save.data;
    this.armory.querySelector('.wallet').textContent = `◆ ${d.cores.toLocaleString('en-US')} THUNDER CORES`;
    this.armory.querySelector('.grid').innerHTML = meta
      .defs()
      .map((u) => {
        const lv = meta.level(u.id);
        const max = meta.maxed(u.id);
        const cost = max ? 'MAX' : `${meta.cost(u.id)} ◆`;
        const cls = `k-tile interactive${max ? ' maxed' : meta.canBuy(u.id) ? '' : ' poor'}${u.id === boughtId ? ' bought' : ''}`;
        const pips = Array.from({ length: u.max }, (_, k) => `<i class="${k < lv ? 'on' : ''}"></i>`).join('');
        return `<div class="${cls}" data-a="buy:${u.id}"><div class="ic">${ICONS[u.icon] || ICONS.core}</div><h4>${u.name}</h4><p>${u.desc}</p><div class="lv">${pips}</div><span class="cost">${cost}</span></div>`;
      })
      .join('');
    const b = d.best;
    const fmt = (t) => (t > 0 ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` : '—');
    const rank = CONFIG.score.ranks[b.rank] || CONFIG.score.ranks[0];
    this.armory.querySelector('.bests').innerHTML = [
      ['Best score', b.score.toLocaleString('en-US')],
      ['Best wave', b.wave || '—'],
      ['Best combo', b.combo || '—'],
      ['Best rank', `<span style="color:${rank.color}">${b.score ? rank.id : '—'}</span>`],
      ['Fastest clear', fmt(b.clearTime)],
      ['Runs', d.runs],
      ['Cores earned', d.totalCores.toLocaleString('en-US')],
    ].map(([k, v]) => `${k}<b>${v}</b>`).join('<br>');
    this.armory.querySelector('.achs').innerHTML = CONFIG.achievements
      .map((a) => `<div class="${d.achievements[a.id] ? 'on' : ''}"><span>${d.achievements[a.id] ? '✓' : `${a.reward} ◆`}</span><b>${a.name}</b>${a.desc}</div>`)
      .join('');
  }
}
