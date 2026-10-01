import { CONFIG } from '../config.js';
import { ICONS } from './icons.js';
import { SKILL_ICONS } from './skillIcons.js';

// Game HUD (spec §11, real time). Dark translucent indigo panels with cut corners and 1 px cyan
// edges; crimson for HP and danger. Top-left: portrait, segmented HP bar, level badge, EXP bar.
// Top-center: wave counter + enemies left, boss bar during boss fights. Bottom-center: skill bar
// (basic attack, Q, E, R: icon, key, conic cooldown sweep + seconds, rank pips, ready glow; R buff
// ring; Shift dash: one pip per stack, sweep + seconds while out of stacks). Bottom-left: passive icon with crit %. Center banners (wave / boss / level).
const CSS = `
  .k-hud { position: absolute; inset: 0; pointer-events: none; font-family: var(--font-text); color: #e6e1d3; transition: opacity .3s; }
  .k-hud.hidden { opacity: 0; }
  .k-panel { background: rgba(14, 20, 38, 0.75); border: 1px solid rgba(53, 224, 255, 0.45);
    clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px); }
  .k-tl { position: absolute; left: 16px; top: 14px; display: flex; gap: 10px; align-items: stretch; padding: 8px 12px 8px 8px; }
  .k-portrait { width: 52px; height: 52px; border: 1px solid rgba(53,224,255,0.6); }
  .k-portrait svg { width: 100%; height: 100%; display: block; }
  .k-bars { display: flex; flex-direction: column; justify-content: center; gap: 6px; min-width: 250px; }
  .k-row { display: flex; align-items: center; gap: 8px; }
  .k-lvl { font: 400 12px var(--font-num); color: #0e1426; background: #35e0ff; padding: 2px 6px; clip-path: polygon(5px 0,100% 0,100% 100%,0 100%,0 5px); }
  .k-lvl.flash { background: #fff; box-shadow: 0 0 12px #35e0ff; }
  .k-hp { display: flex; gap: 2px; flex: 1; height: 12px; }
  .k-hp i { flex: 1; background: rgba(215, 38, 61, 0.18); transform: skewX(-18deg); }
  .k-hp i.on { background: linear-gradient(#ff5a6e, #d7263d); box-shadow: 0 0 6px rgba(215,38,61,0.5); }
  .k-hp i.part { background: linear-gradient(90deg, #d7263d var(--k), rgba(215,38,61,0.18) var(--k)); }
  .k-nm { font: 400 11px var(--font-num); color: rgba(236,232,222,0.85); min-width: 76px; text-align: right; }
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
      <div class="k-tl k-panel">
        <div class="k-portrait">${ICONS.portrait}</div>
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
      <div class="k-banner"><div class="big"></div><div class="small"></div></div>`;
    root.appendChild(this.el);
    const q = (s) => this.el.querySelector(s);
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

  update(realDt, game) {
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
    const dMax = CONFIG.hero.dash.charges;
    const empty = dash.charges <= 0;
    this._set('dp', empty ? Math.round((1 - dash.recharge01) * 100) : 0, (v) => dEl.style.setProperty('--p', v / 100));
    const dLeft = empty ? Math.ceil((1 - dash.recharge01) * CONFIG.hero.dash.recharge * 10) / 10 : 0;
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
