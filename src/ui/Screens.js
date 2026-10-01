import { CONFIG } from '../config.js';
import { ICONS } from './icons.js';

// Full-screen UI (spec §11, real time): title over the live arena, pause, level-up cards,
// game over and demo clear. Buttons are `.interactive` (the UI root ignores the pointer otherwise).
const CSS = `
  .k-scr { position: absolute; inset: 0; display: none; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; font-family: var(--font-text); color: #e6e1d3; }
  .k-scr.on { display: flex; }
  .k-scr.dim { background: radial-gradient(ellipse at center, rgba(14,20,38,0.55), rgba(5,7,15,0.85)); }
  .k-title { background: linear-gradient(to bottom, rgba(5,7,15,0.0) 30%, rgba(5,7,15,0.75)); justify-content: flex-end; padding-bottom: 9vh; }
  .k-title h1 { margin: 0; font: 700 min(12vw, 108px) var(--font-text); letter-spacing: .32em; padding-left: .32em; color: #f4f1ea;
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
  .k-cards-f { margin-top: 22px; font: 500 12px var(--font-text); letter-spacing: .25em; color: rgba(236,232,222,0.6); }
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
    this.title = mk('k-title', `
      <h1>KUROGANE</h1><div class="sub">THUNDER DESCENDS</div>
      <div class="ctl k-panel">
        <b>WASD</b><span>move</span><b>MOUSE</b><span>turn camera · aim at screen center</span><b>V</b><span>third-person ⇄ fixed camera</span><b>HOLD LMB</b><span>attack (crits become whip strikes)</span><b>SHIFT</b><span>dash — invulnerable, 2 stacks</span>
        <b>Q</b><span>Thunderclaw — aim, click to fire</span><b>E</b><span>Shatter → Overdrive</span><b>R</b><span>Demontime</span>
        <b>ESC / P</b><span>pause</span>
      </div>
      <div class="go">CLICK TO START</div>`);
    this.pause = mk('dim', `<div class="k-box"><h2>PAUSED</h2>
      <button class="k-btn interactive" data-a="resume">Resume</button>
      <button class="k-btn interactive" data-a="restart">Restart</button>
      <button class="k-btn interactive" data-a="shake">Screen shake: on</button>
      <label class="k-sl interactive">Mouse sensitivity <b data-v="sens"></b><input type="range" data-s="sens" min="0.001" max="0.02" step="0.0005"></label>
      <label class="k-sl interactive">Camera distance <b data-v="dist"></b><input type="range" data-s="dist" min="4" max="16" step="0.25"></label>
      <label class="k-sl interactive">Brightness <b data-v="light"></b><input type="range" data-s="light" min="0.5" max="3" step="0.05"></label>
      <div class="hint">ESC TO RESUME</div></div>`);
    this.over = mk('dim k-over', `<div class="k-box"><h2>DEFEATED</h2><div class="stats"></div>
      <button class="k-btn interactive" data-a="restart">Retry</button><div class="hint">PRESS ENTER TO RETRY</div></div>`);
    this.clear = mk('dim k-clear', `<div class="k-box"><h2>DEMO CLEAR</h2><div class="stats"></div>
      <button class="k-btn interactive" data-a="continue">Continue (endless)</button>
      <button class="k-btn interactive" data-a="restart">Restart</button></div>`);
    this.cardsEl = mk('dim', `<div class="k-cards-h"><h2>LEVEL UP</h2><div>CHOOSE YOUR UPGRADE</div></div><div class="k-cards"></div><div class="k-cards-f">CLICK OR PRESS 1 · 2 · 3</div>`);
    for (const el of [this.pause, this.over, this.clear]) {
      el.addEventListener('click', (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (a) this.onAction?.(a);
      });
    }
    this.cardsEl.addEventListener('click', (e) => {
      const c = e.target.closest('.k-card');
      if (c) this.onPick?.(+c.dataset.i);
    });
    // Settings sliders (saved per browser).
    const SET = {
      sens: { obj: CONFIG.camera.follow, key: 'sensitivity', fmt: (v) => (v * 1000).toFixed(1) },
      dist: { obj: CONFIG.camera.follow, key: 'distance', fmt: (v) => `${v.toFixed(1)} m` },
      light: { obj: CONFIG.lighting, key: 'brightness', fmt: (v) => `${Math.round(v * 100)}%`, apply: () => game.map.lighting.applySettings() },
    };
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('kurogane.settings') || '{}'); } catch { /* storage blocked */ }
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
        try { localStorage.setItem('kurogane.settings', JSON.stringify(saved)); } catch { /* ignore */ }
      });
    }
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
    try { localStorage.setItem('kurogane.settings', JSON.stringify(saved)); } catch { /* ignore */ }
  }

  show(name) {
    this.current = name;
    if (name && name !== 'title') this.game.hud.clearBanner(); // menus sit over a clean HUD
    const map = { title: this.title, pause: this.pause, over: this.over, clear: this.clear, cards: this.cardsEl };
    for (const k in map) map[k].classList.toggle('on', k === name);
  }

  setShakeLabel(on) {
    this.pause.querySelector('[data-a="shake"]').textContent = `Screen shake: ${on ? 'on' : 'off'}`;
  }

  setStats(which, lines) {
    (which === 'over' ? this.over : this.clear).querySelector('.stats').innerHTML = lines.join('<br>');
  }

  showCards(cards) {
    const wrap = this.cardsEl.querySelector('.k-cards');
    wrap.innerHTML = cards
      .map((c, i) => {
        const pips = Array.from({ length: c.maxRank }, (_, k) => `<i class="${k < c.rank ? 'on' : k === c.rank ? 'nx' : ''}"></i>`).join('');
        const kind = c.kind === 'skill' ? 'SKILL' : c.kind === 'passive' ? 'PASSIVE' : 'STAT';
        return `<div class="k-card interactive" data-i="${i}"><span class="n">${i + 1}</span><span class="kind">${kind}</span><div class="ic">${ICONS[c.icon]}</div><h3>${c.title}</h3><div class="line"></div><p>${c.desc}</p><div class="pips">${pips}</div></div>`;
      })
      .join('');
    this.show('cards');
  }
}
