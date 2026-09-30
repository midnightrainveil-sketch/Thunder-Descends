import * as THREE from 'three';

// Palettes from spec §3. Keys are what voxel boxes reference in `c`.
export const HERO_PALETTE = {
  gunmetal: '#2A2F3A',
  darkSteel: '#1E222B',
  ivory: '#E6E1D3',
  worn: '#8A8F99',
  crimson: '#D7263D',
  cyan: '#35E0FF',
  core: '#E8FDFF',
  steelDark: '#6E7480', // second blade shade (alternating segments)
  crimsonDark: '#8E1A2A', // sash hem
};

export const ENEMY_PALETTE = {
  rust: '#8C2F1F',
  black: '#15151A',
  bronze: '#8A6A3A',
  ember: '#FF7A1A',
  rustDark: '#5E2016', // shading blocks
  steel: '#3A3B42', // dark blade / barrel steel
};

export const MAP_PALETTE = {
  basalt1: '#3A3D46',
  basalt2: '#2E3038',
  basalt3: '#26282F',
  moss: '#3E5A3A',
  vermilion: '#B8452F',
  beamBlack: '#141418',
  sakura1: '#F6CADB',
  sakura2: '#EFA3BF',
  sakura3: '#FFE8F0',
  sakuraWhite: '#FFF6F8',
  bark: '#2B2123',
  lantern: '#FFB25A',
  seam: '#35E0FF',
  night: '#0E1426',
  moon: '#E9EEF7',
};

export const BOSS_PALETTE = {
  juggernaut: '#FF7A1A',
  kitsune: '#FF3FD2',
  raiju: '#FFE14A',
};

// Everything in one lookup, for mixed-palette parts (tests, props).
export const ALL_PALETTE = { ...MAP_PALETTE, ...ENEMY_PALETTE, ...BOSS_PALETTE, ...HERO_PALETTE };

// Palette key → linear THREE.Color (cached per palette object).
const cache = new WeakMap();
export function resolveColor(palette, key) {
  let table = cache.get(palette);
  if (!table) {
    table = new Map();
    cache.set(palette, table);
  }
  let col = table.get(key);
  if (!col) {
    const hex = palette[key] ?? (typeof key === 'string' && key.startsWith('#') ? key : null);
    if (hex == null) {
      console.warn(`[voxel] unknown palette key "${key}"`);
      col = new THREE.Color(1, 0, 1);
    } else {
      col = new THREE.Color(hex); // sRGB hex → linear working space
    }
    table.set(key, col);
  }
  return col;
}
