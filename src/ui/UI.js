import { CONFIG } from '../config.js';

// UI root. Stage 0 only shows a small controls hint; the HUD and screens arrive in Stage 5.
// UI runs on real time.
export class UI {
  constructor(root) {
    this.root = root;
    const style = document.createElement('style');
    style.textContent = `
      .k-hint {
        position: absolute; left: 16px; bottom: 14px;
        font: 500 12px var(--font-text); letter-spacing: 0.04em;
        color: rgba(230, 225, 211, 0.55);
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
      }
      .k-hint b { color: rgba(53, 224, 255, 0.8); font-weight: 600; }
    `;
    document.head.appendChild(style);

    this.hint = document.createElement('div');
    this.hint.className = 'k-hint';
    this.hint.innerHTML = '<b>WASD</b> move · <b>mouse</b> aim · <b>hold click</b> attack · <b>`</b> debug';
    root.appendChild(this.hint);
    this.hidden = false;
  }

  setHidden(hidden) {
    this.hidden = hidden;
    this.root.style.visibility = hidden ? 'hidden' : 'visible';
  }

  update(/* realDt */) {
    this.hint.style.display = CONFIG.ui.showHint ? '' : 'none';
  }
}
