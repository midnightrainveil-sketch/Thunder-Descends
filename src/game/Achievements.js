import { CONFIG } from '../config.js';
import { save } from './Save.js';
import { audio } from '../audio/Audio.js';

/**
 * One-time achievements. `unlock(id)` saves it, pays its Thunder Core reward and raises a toast.
 * The game calls it from the events that complete each goal.
 */
export class Achievements {
  constructor() {
    this.onToast = null; // (def) => void
    this.unlockedThisRun = [];
  }

  get defs() {
    return CONFIG.achievements;
  }

  has(id) {
    return !!save.data.achievements[id];
  }

  unlock(id) {
    if (this.has(id)) return false;
    const def = this.defs.find((a) => a.id === id);
    if (!def) return false;
    save.data.achievements[id] = Date.now();
    save.addCores(def.reward);
    this.unlockedThisRun.push(def);
    audio.play('achievement');
    this.onToast?.(def);
    return true;
  }

  count() {
    return this.defs.filter((a) => this.has(a.id)).length;
  }
}
