import { CONFIG } from '../config.js';

/**
 * Dynamic resolution (real time). Averages the frame time over `aqWindow` seconds; when frames
 * run slower than `aqSlowMs` the internal render scale steps down, and after `aqUpAfter` seconds
 * of headroom (below `aqFastMs`) it steps back up toward 1. Resolution changes are rare and small,
 * so motion stays smooth instead of stuttering when the GPU is busy (bloom, MSAA, high-DPI).
 * Long gaps (tab hidden, breakpoints) are ignored.
 */
export class AutoQuality {
  constructor(engine) {
    this.engine = engine;
    this.acc = 0;
    this.frames = 0;
    this.fastT = 0;
    this.avgMs = 16.7;
  }

  update(rawDt) {
    const R = CONFIG.render;
    if (rawDt <= 0 || rawDt > 0.25) return;
    this.acc += rawDt;
    this.frames++;
    if (this.acc < R.aqWindow) return;
    this.avgMs = (this.acc / this.frames) * 1000;
    const span = this.acc;
    this.acc = 0;
    this.frames = 0;
    if (!R.autoQuality) {
      if (this.engine.renderScale !== 1) this.engine.setRenderScale(1);
      return;
    }
    const s = this.engine.renderScale;
    if (this.avgMs > R.aqSlowMs && s > R.aqMinScale + 1e-3) {
      this.engine.setRenderScale(Math.max(R.aqMinScale, +(s - R.aqStep).toFixed(2)));
      this.fastT = 0;
    } else if (this.avgMs < R.aqFastMs && s < 1) {
      this.fastT += span;
      if (this.fastT >= R.aqUpAfter) {
        this.engine.setRenderScale(Math.min(1, +(s + R.aqStep / 2).toFixed(2)));
        this.fastT = 0;
      }
    } else this.fastT = 0;
  }
}
