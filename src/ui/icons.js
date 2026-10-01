// Inline SVG icons (no external assets). 48×48 viewBox, cyan strokes by default (currentColor).
const svg = (body) => `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="miter" stroke-linecap="square">${body}</svg>`;

export const ICONS = {
  // Basic attack: crescent slash with a blade.
  attack: svg('<path d="M10 36 C 16 18, 30 10, 40 10" stroke-width="4"/><path d="M8 40 L20 28"/><path d="M14 26 L22 34"/>'),
  // Thunderclaw: three claws and chain links.
  claw: svg('<path d="M14 12 L20 24 M22 10 L26 24 M30 12 L30 25"/><path d="M16 26 H32 V32 H16 Z"/><rect x="21" y="34" width="6" height="4"/><rect x="21" y="40" width="6" height="4"/><path d="M34 16 L40 10" stroke-width="2"/>'),
  // Shatter: a spear thrust with a burst.
  shatter: svg('<path d="M6 38 L34 14" stroke-width="4"/><path d="M34 14 L42 6 M36 20 L44 18 M28 12 L30 4" stroke-width="2"/><path d="M6 38 L12 38 L10 44 Z" fill="currentColor"/>'),
  // Demontime: planted sword in a time ring.
  demontime: svg('<circle cx="24" cy="26" r="16" stroke-width="2"/><path d="M24 4 V36" stroke-width="4"/><path d="M18 12 H30"/><path d="M24 36 L20 44 H28 Z" fill="currentColor"/>'),
  // Dash: double chevron with speed lines.
  dash: svg('<path d="M20 12 L32 24 L20 36" stroke-width="4"/><path d="M30 12 L42 24 L30 36" stroke-width="2.5"/><path d="M4 18 H14 M7 24 H17 M4 30 H14" stroke-width="2"/>'),
  // Passive: lightning bolt.
  passive: svg('<path d="M28 4 L12 28 H24 L18 44 L38 18 H26 Z" fill="currentColor" stroke-width="1.5"/>'),
  atk: svg('<path d="M24 4 V34" stroke-width="4"/><path d="M16 34 H32"/><path d="M24 34 V44"/><path d="M14 16 L24 6 L34 16" stroke-width="2"/>'),
  hp: svg('<path d="M24 6 L40 15 V33 L24 42 L8 33 V15 Z" stroke-width="2"/><path d="M24 16 V32 M16 24 H32" stroke-width="4"/>'),
  aspd: svg('<path d="M8 12 L20 24 L8 36 M20 12 L32 24 L20 36 M32 12 L44 24 L32 36"/>'),
  // Hero portrait: kabuto with fin, jaw mask and cyan visor row.
  portrait: `<svg viewBox="0 0 48 48"><rect width="48" height="48" fill="#0b1020"/><path d="M24 2 L30 12 H18 Z" fill="#8a8f99"/><rect x="12" y="12" width="24" height="10" fill="#2a2f3a"/><rect x="8" y="18" width="6" height="12" fill="#1e222b"/><rect x="34" y="18" width="6" height="12" fill="#1e222b"/><rect x="14" y="22" width="20" height="16" fill="#2a2f3a"/><rect x="16" y="25" width="16" height="3" fill="#35e0ff"/><rect x="16" y="31" width="16" height="7" fill="#e6e1d3"/><rect x="20" y="33" width="8" height="2" fill="#1e222b"/><rect x="14" y="38" width="20" height="6" fill="#1e222b"/><rect x="22" y="40" width="4" height="4" fill="#d7263d"/></svg>`,
};
