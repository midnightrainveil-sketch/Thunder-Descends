import * as THREE from 'three';
import { CONFIG } from '../config.js';

const _v = new THREE.Vector3();

// Floating damage numbers / short labels (DOM, pooled, real time). Styles:
//  'normal' white · 'crit' big white-cyan with a pop and jitter · 'hero' crimson (damage taken)
//  'blocked' small muted orange · 'label' free text (e.g. LEVEL UP), color via opts.
export class DamageNumbers {
  constructor(root) {
    const style = document.createElement('style');
    style.textContent = `
      .k-num { position: absolute; left: 0; top: 0; pointer-events: none; white-space: nowrap;
        font: 400 18px var(--font-num); color: #f4f1ea; will-change: transform, opacity;
        text-shadow: 0 2px 0 rgba(0,0,0,0.75), 0 0 6px rgba(0,0,0,0.5); }
      .k-num.crit { font-size: 30px; color: #ffffff;
        text-shadow: 0 0 10px rgba(53,224,255,0.95), 0 0 22px rgba(53,224,255,0.6), 0 3px 0 rgba(0,20,40,0.9); }
      .k-num.hero { color: #ff3a4f; font-size: 20px; text-shadow: 0 2px 0 rgba(40,0,5,0.9), 0 0 8px rgba(215,38,61,0.6); }
      .k-num.blocked { color: #d9a066; font-size: 13px; letter-spacing: 0.08em; }
      .k-num.label { font: 700 20px var(--font-text); letter-spacing: 0.18em; }
    `;
    document.head.appendChild(style);
    this.layer = document.createElement('div');
    this.layer.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;';
    root.appendChild(this.layer);
    const N = CONFIG.fx.numbers.pool;
    this.items = [];
    for (let i = 0; i < N; i++) {
      const el = document.createElement('div');
      el.className = 'k-num';
      el.style.display = 'none';
      this.layer.appendChild(el);
      this.items.push({ el, active: false, t: 0, pos: new THREE.Vector3(), kind: 'normal', jx: 0, jy: 0, life: 1 });
    }
    this.next = 0;
  }

  // pos: world position (the number floats up from its projection).
  show(pos, value, kind = 'normal', { color, life } = {}) {
    const it = this.items[this.next];
    this.next = (this.next + 1) % this.items.length;
    it.active = true;
    it.t = 0;
    it.kind = kind;
    it.life = life ?? CONFIG.fx.numbers.life * (kind === 'crit' ? 1.25 : kind === 'label' ? 1.6 : 1);
    it.pos.copy(pos);
    it.jx = (Math.random() - 0.5) * 36;
    it.jy = (Math.random() - 0.5) * 10;
    it.el.className = `k-num ${kind}`;
    it.el.textContent = typeof value === 'number' ? String(Math.round(value)) : value;
    it.el.style.color = color || '';
    it.el.style.display = '';
  }

  clear() {
    for (const it of this.items) {
      it.active = false;
      it.el.style.display = 'none';
    }
  }

  update(realDt, camera, width, height) {
    const N = CONFIG.fx.numbers;
    for (const it of this.items) {
      if (!it.active) continue;
      it.t += realDt;
      const k = it.t / it.life;
      if (k >= 1) {
        it.active = false;
        it.el.style.display = 'none';
        continue;
      }
      _v.copy(it.pos).project(camera);
      if (_v.z > 1) {
        it.el.style.display = 'none';
        continue;
      }
      it.el.style.display = '';
      let x = (_v.x * 0.5 + 0.5) * width + it.jx;
      let y = (-_v.y * 0.5 + 0.5) * height + it.jy - N.rise * it.t;
      let scale = 1;
      if (it.kind === 'crit') {
        // Pop (overshoot) then settle, with a short jitter.
        const p = Math.min(1, it.t / 0.12);
        scale = N.critScale - (N.critScale - 1) * p + 0.25 * Math.sin(p * Math.PI);
        if (it.t < 0.18) {
          x += (Math.random() - 0.5) * 6;
          y += (Math.random() - 0.5) * 6;
        }
      } else if (it.kind === 'label') {
        scale = 1 + 0.3 * Math.max(0, 1 - it.t / 0.15);
      }
      const alpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      it.el.style.opacity = alpha.toFixed(3);
      it.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
    }
  }
}
