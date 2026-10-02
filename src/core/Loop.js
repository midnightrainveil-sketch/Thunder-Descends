// requestAnimationFrame loop. The frame callback receives the raw delta in seconds;
// GameTime does the clamping and scaling.
export class Loop {
  constructor(frame) {
    this.frame = frame;
    this.running = false;
    this._last = 0;
    this._tick = this._tick.bind(this);
    this.errors = 0; // frames that threw (shown in the debug stats)
    this.onError = null;
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
    // Schedule the next frame first: an error in one frame must never freeze the game.
    requestAnimationFrame(this._tick);
    const rawDt = (now - this._last) / 1000;
    this._last = now;
    try {
      this.frame(rawDt);
    } catch (err) {
      this.errors++;
      if (this.errors <= 20) console.error('[frame error]', err);
      this.onError?.(err);
    }
  }
}
