import { CONFIG } from '../config.js';

// FPS + draw-call counter overlay (spec §14). Shown while debug is on.
export class Stats {
  constructor(root) {
    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      position: 'absolute',
      left: '12px',
      top: '10px',
      padding: '6px 9px',
      font: '11px/1.45 var(--font-num)',
      color: '#bff4ff',
      background: 'rgba(14, 20, 38, 0.75)',
      border: '1px solid rgba(53, 224, 255, 0.35)',
      whiteSpace: 'pre',
      pointerEvents: 'none',
    });
    root.appendChild(this.el);
    this._frames = 0;
    this._acc = 0;
    this._worst = 0;
    this.fps = 0;
    this.setVisible(false);
  }

  setVisible(v) {
    this.visible = v;
    this.el.style.display = v ? '' : 'none';
  }

  update(rawDt, renderer, time, extra = '') {
    this._frames++;
    this._acc += rawDt;
    this._worst = Math.max(this._worst, rawDt);
    if (this._acc < CONFIG.debug.statsInterval) return;
    this.fps = this._frames / this._acc;
    const worstMs = this._worst * 1000;
    this._frames = 0;
    this._acc = 0;
    this._worst = 0;
    if (!this.visible) return;
    const info = renderer.info.render;
    this.el.textContent =
      `fps ${this.fps.toFixed(0)}  worst ${worstMs.toFixed(1)}ms\n` +
      `calls ${info.calls}  tris ${(info.triangles / 1000).toFixed(1)}k\n` +
      `world x${(time.worldScale * time.debugScale).toFixed(2)}  hero x${(time.heroScale * time.debugScale).toFixed(2)}` +
      (extra ? `\n${extra}` : '');
  }
}
