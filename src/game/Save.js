// Persistent player data (localStorage): Thunder Cores, Armory levels, achievements, personal bests.
// Reads and writes are wrapped so a blocked storage (private mode, file:// quirks) never breaks play.
const KEY = 'thunder.save';

function blank() {
  return {
    cores: 0,
    totalCores: 0,
    upgrades: {},
    achievements: {},
    best: { score: 0, wave: 0, combo: 0, rank: 0, clearTime: 0 },
    runs: 0,
  };
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') {
      const b = blank();
      return { ...b, ...raw, best: { ...b.best, ...(raw.best || {}) }, upgrades: { ...(raw.upgrades || {}) }, achievements: { ...(raw.achievements || {}) } };
    }
  } catch {
    /* storage blocked or corrupt */
  }
  return blank();
}

export const save = {
  data: load(),
  write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* ignore */
    }
  },
  addCores(n) {
    n = Math.max(0, Math.floor(n));
    this.data.cores += n;
    this.data.totalCores += n;
    this.write();
    return n;
  },
  // Debug: wipe progress.
  reset() {
    this.data = blank();
    this.write();
  },
};
