// requestAnimationFrame loop. The frame callback receives the raw delta in seconds;
// GameTime does the clamping and scaling.
export class Loop {
  constructor(frame) {
    this.frame = frame;
    this.running = false;
    this._last = 0;
    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
  }

  _tick(now) {
    if (!this.running) return;
    const rawDt = (now - this._last) / 1000;
    this._last = now;
    this.frame(rawDt);
    requestAnimationFrame(this._tick);
  }
}
