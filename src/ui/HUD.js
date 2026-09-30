// Minimal Stage 3 HUD (the full HUD arrives in Stage 5): a text block in the top-left corner
// (HP, level, EXP, wave, crit %, pending upgrades), a centered "Wave N" banner and the death
// overlay ("Press Enter to retry"). Real time.
export class HUD {
  constructor(root) {
    const style = document.createElement('style');
    style.textContent = `
      .k-hud { position: absolute; left: 16px; top: 14px; pointer-events: none;
        font: 500 13px var(--font-text); letter-spacing: 0.04em; color: rgba(236, 232, 222, 0.9);
        text-shadow: 0 1px 2px rgba(0,0,0,0.8); line-height: 1.55; }
      .k-hud .row { display: flex; gap: 8px; align-items: center; }
      .k-hud .lab { color: rgba(53, 224, 255, 0.85); font: 400 11px var(--font-num); width: 44px; }
      .k-hud .bar { width: 170px; height: 8px; background: rgba(10, 14, 30, 0.7); border: 1px solid rgba(255,255,255,0.15); position: relative; }
      .k-hud .fill { position: absolute; inset: 0; transform-origin: left; }
      .k-hud .hp .fill { background: linear-gradient(90deg, #d7263d, #ff5a6e); }
      .k-hud .ex .fill { background: linear-gradient(90deg, #1aa6c4, #35e0ff); }
      .k-hud .val { font: 400 11px var(--font-num); min-width: 70px; }
      .k-hud .sk b { color: #8ff4ff; font-weight: 400; }
      .k-hud .sk .rd { color: #f4f1ea; }
      .k-hud .sk .cd { color: rgba(236,232,222,0.5); }
      .k-hud .sk .on { color: #ff6a7c; }
      .k-hud .lvl.flash { color: #8ff4ff; text-shadow: 0 0 10px #35e0ff; }
      .k-banner { position: absolute; left: 50%; top: 26%; transform: translate(-50%, -50%); pointer-events: none;
        text-align: center; opacity: 0; transition: opacity 0.25s; }
      .k-banner .big { font: 700 54px var(--font-text); letter-spacing: 0.32em; color: #f4f1ea;
        text-shadow: 0 0 18px rgba(53,224,255,0.55), 0 3px 0 rgba(0,0,0,0.7); }
      .k-banner .small { font: 500 14px var(--font-text); letter-spacing: 0.2em; color: rgba(143,244,255,0.9); margin-top: 4px; }
      .k-over { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; flex-direction: column;
        background: radial-gradient(ellipse at center, rgba(40,0,8,0.35), rgba(0,0,0,0.7)); pointer-events: none; }
      .k-over .big { font: 700 58px var(--font-text); letter-spacing: 0.3em; color: #ff3a4f; text-shadow: 0 0 20px rgba(215,38,61,0.6); }
      .k-over .small { font: 500 16px var(--font-text); letter-spacing: 0.2em; color: rgba(236,232,222,0.9); margin-top: 12px; }
      .k-over .stats { font: 400 12px var(--font-num); color: rgba(236,232,222,0.7); margin-top: 18px; }
    `;
    document.head.appendChild(style);

    this.el = document.createElement('div');
    this.el.className = 'k-hud';
    this.el.innerHTML = `
      <div class="row hp"><span class="lab">HP</span><span class="bar"><span class="fill"></span></span><span class="val hpv"></span></div>
      <div class="row ex"><span class="lab lvl">LV 1</span><span class="bar"><span class="fill"></span></span><span class="val exv"></span></div>
      <div class="row"><span class="lab">WAVE</span><span class="val wv"></span></div>
      <div class="row"><span class="lab">CRIT</span><span class="val cr"></span></div>
      <div class="row up"><span class="lab">UPGR</span><span class="val upv"></span></div>
      <div class="row"><span class="lab">SKILL</span><span class="val sk"></span></div>`;
    root.appendChild(this.el);
    const q = (s) => this.el.querySelector(s);
    this.hpFill = q('.hp .fill');
    this.hpVal = q('.hpv');
    this.exFill = q('.ex .fill');
    this.exVal = q('.exv');
    this.lvl = q('.lvl');
    this.wv = q('.wv');
    this.cr = q('.cr');
    this.up = q('.up');
    this.upv = q('.upv');
    this.sk = q('.sk');

    this.bannerEl = document.createElement('div');
    this.bannerEl.className = 'k-banner';
    this.bannerEl.innerHTML = '<div class="big"></div><div class="small"></div>';
    root.appendChild(this.bannerEl);
    this.bannerT = 0;

    this.over = document.createElement('div');
    this.over.className = 'k-over';
    this.over.innerHTML = '<div class="big">DEFEATED</div><div class="small">PRESS ENTER TO RETRY</div><div class="stats"></div>';
    root.appendChild(this.over);
    this._lvlT = 0;
    this._last = '';
  }

  banner(text, sub = '', duration) {
    this.bannerEl.querySelector('.big').textContent = text;
    this.bannerEl.querySelector('.small').textContent = sub;
    this.bannerEl.style.opacity = '1';
    this.bannerT = duration ?? 1.8;
  }

  flashLevel() {
    this._lvlT = 1.2;
  }

  showDeath(on, statsText = '') {
    this.over.style.display = on ? 'flex' : 'none';
    this.over.querySelector('.stats').textContent = statsText;
  }

  update(realDt, game) {
    const S = game.hero.stats;
    const P = game.progression;
    const W = game.waves;
    const hpK = Math.max(0, S.hp / S.maxHp);
    const exK = P.exp / P.expToNext;
    const SK = game.hero.skills;
    const skillText = SK.list.map((s) => `${s.key}${s.rank}:${s.label}`).join('|');
    const key = `${skillText}|${Math.round(S.hp)}|${Math.round(S.maxHp)}|${P.level}|${Math.floor(P.exp)}|${W.wave}|${W.remaining}|${S.critRate}|${P.pendingUpgrades}|${game.godMode}`;
    if (key !== this._last) {
      this._last = key;
      this.hpFill.style.transform = `scaleX(${hpK.toFixed(3)})`;
      this.hpVal.textContent = `${Math.ceil(S.hp)} / ${Math.round(S.maxHp)}${game.godMode ? '  GOD' : ''}`;
      this.exFill.style.transform = `scaleX(${exK.toFixed(3)})`;
      this.exVal.textContent = `${Math.floor(P.exp)} / ${P.expToNext}`;
      this.lvl.textContent = `LV ${P.level}`;
      this.wv.textContent = W.wave > 0 ? `${W.wave}  ·  ${Math.max(0, W.remaining)} left` : '—';
      this.cr.textContent = `${Math.round(S.critRate * 100)}%`;
      this.up.style.display = P.pendingUpgrades > 0 ? '' : 'none';
      this.upv.textContent = `${P.pendingUpgrades} pending`;
      this.sk.innerHTML = SK.list
        .map((s) => {
          const l = s.label;
          const cls = l === 'ready' ? 'rd' : /s$/.test(l) && !/BUFF/.test(l) ? 'cd' : 'on';
          return `<b>${s.key}</b> <span class="${cls}">${l}</span>`;
        })
        .join(' &nbsp; ');
    }
    this._lvlT = Math.max(0, this._lvlT - realDt);
    this.lvl.classList.toggle('flash', this._lvlT > 0);
    if (this.bannerT > 0) {
      this.bannerT -= realDt;
      if (this.bannerT <= 0) this.bannerEl.style.opacity = '0';
    }
  }
}
