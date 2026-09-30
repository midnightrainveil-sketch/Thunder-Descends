// KUROGANE — every tunable number lives here, grouped by system (spec §13).
// Systems read these objects live, so the debug panel can edit them at runtime.

// ── Block scales (spec §2) ────────────────────────────────────────────────
export const VOXEL = 0.12; // m, character block size (hero ≈ 20 blocks tall)
export const BOSS_VOXEL = 0.18; // m, large boss block size
export const ENV_VOXEL = 0.25; // m, environment prop block size
export const ENV_BIG_VOXEL = 0.5; // m, canopy cubes, big structures, crest
export const FLOOR_BLOCK = 1.0; // m, floor block size

// ── World (spec §2) ───────────────────────────────────────────────────────
export const ARENA_RADIUS = 11; // m, play circle radius centered at origin

export const CONFIG = {
  camera: {
    elevationDeg: 38, // look-down angle from horizontal
    yawDeg: 0, // 0 = looking straight from the front (+Z → −Z)
    fov: 32, // vertical FOV, degrees
    target: { x: 0, y: 0, z: 0 }, // look-at point (optical axis)
    fitMargin: 1.5, // m, extra radius around the arena kept in frame
    fitHeight: 0, // m, character height kept inside the fit band at the rim (0: heads at the back rim may use the headroom)
    fitDepth: 1.2, // m, foundation drop kept in frame below the rim
    headroomTop: 0.2, // fraction of frame height kept free above the arena (torii, canopies)
    bottomPad: 0.02, // fraction of frame height kept free below the arena
    sidePad: 0.02, // fraction of frame width kept free left/right
    near: 0.5, // m
    far: 1200, // m
    fitSamples: 96, // points sampled around the rim for auto-fit
    shake: {
      maxOffset: 0.45, // m at trauma 1
      maxRollDeg: 1.1, // degrees at trauma 1
      frequency: 22, // noise speed, Hz-ish
      exponent: 2, // shake = trauma^exponent
    },
    punch: {
      attack: 0.18, // fraction of the duration spent zooming in
    },
  },

  arena: {
    radius: ARENA_RADIUS,
    bandWidth: 2, // blocks per concentric ring band
    seamRings: [4, 8], // placeholder: radii (m) of stepped ring edges that get cyan lines
    seamWidth: 0.07, // m, glow line width
    seamHeight: 0.006, // m, glow line top above the floor (keeps the floor flat)
    seamIntensity: 1.9, // emissive multiplier (low intensity, just above bloom threshold)
    foundationDepth: 3, // blocks, first foundation tier below the floor slab
    foundationTier2Depth: 3, // blocks, second, inset tier
    foundationInset: 1, // blocks, inset of the second tier
    floorJitter: 0.08, // ±brightness jitter per floor block
    edgeWidth: 0.035, // m, darkened band along block boundaries (procedural, keeps the floor flat)
    edgeDarken: 0.45, // 0..1 darkening at block boundaries
    wallJitter: 0.07, // ±brightness jitter per foundation block
    rimInset: 0.6, // m, randomRimPoint() distance inside the radius
    rimTries: 32, // attempts for randomRimPoint()
  },

  lighting: {
    hemiSky: '#6c7396', // hemisphere sky color
    hemiGround: '#2a2e44', // hemisphere ground color
    hemiIntensity: 2.8,
    moonColor: '#d3daf5',
    moonIntensity: 3.6,
    moonDir: { x: 0.6, y: 1.0, z: 0.12 }, // direction toward the moon (normalized at runtime)
    moonDistance: 40, // m, light position distance from origin
    shadowMapSize: 2048,
    shadowMargin: 1.8, // m, shadow frustum margin around the arena circle
    shadowHeight: 8, // m, tallest shadow caster height considered for fitting
    shadowBias: -0.0004,
    shadowNormalBias: 0.02,
    shadowRadius: 2.5, // PCF softness (texels)
    rimColor: '#6fb7ff',
    rimIntensity: 1.6,
    rimDir: { x: -0.25, y: 0.45, z: -1.0 }, // direction toward the back/rim light
  },

  render: {
    pixelRatioMax: 2,
    msaaSamples: 4, // composer MSAA samples (renderer antialias doesn't apply to render targets)
    exposure: 1.0, // ACES tone mapping exposure
    fogColor: '#0e1426',
    fogDensity: 0.0065, // FogExp2 density (subtle)
    skyTop: '#05080f', // placeholder gradient sky (replaced in Stage 1)
    skyHorizon: '#1a2447',
  },

  post: {
    bloom: {
      strength: 0.6,
      radius: 0.35,
      threshold: 0.92, // high: only emissive parts (vertex colors > 1) glow
    },
    grade: {
      saturation: 1.0, // 1 = neutral
      vignette: 0.32, // 0 = off
      vignetteSoftness: 0.55,
      chromatic: 0.0, // chromatic aberration amount (0 = off)
      tintColor: '#7fb2ff', // Q slow-mo cold blue
      tintStrength: 0.0, // 0 = off
    },
    timeRing: {
      lineWidth: 0.012, // fraction of screen height
      lineColor: '#35e0ff',
      lineIntensity: 3.0,
      distort: 0.006, // UV refraction near the ring line
    },
    preview: {
      flashStrength: 0.9,
      flashDuration: 0.25, // s
      tintStrength: 0.55,
      tintSaturation: 0.8,
      chromatic: 1.0,
      previewHold: 1.2, // s, how long timed previews stay on
      ringExpand: 0.4, // s, time-ring preview expand (spec §7 R timing)
      ringHold: 1.2, // s
      ringCollapse: 0.4, // s
      ringMaxRadius: 60, // m, world radius the preview ring grows to (past the screen edge)
    },
  },

  time: {
    maxDt: 1 / 20, // s, realDt clamp
    debugScales: [1, 0.25, 0.05], // T hotkey cycle
    hitstopTest: 0.07, // s, debug hitstop button (crit hitstop in spec §6)
    slowTest: 0.15, // Q targeting scale (spec §7), used by the debug tween test
    slowTestTween: 0.12, // s
  },

  hero: {
    // Base stats (spec §5). Combat uses these from Stage 3.
    maxHp: 600,
    moveSpeed: 6, // m/s
    attackMoveMul: 0.45, // move speed multiplier while attacking
    atk: 30,
    attackInterval: 0.55, // s
    critRate: 0.5,
    critDamage: 2.0,
    hurtIFrames: 0.4, // s
    // Movement feel
    radius: 0.4, // m, body radius for arena clamping
    accel: 42, // m/s², towards the input velocity
    decel: 55, // m/s², when no input
    turnRate: 16, // 1/s, exponential turn smoothing toward the mouse
    leanDeg: 4, // forward lean at full speed (placeholder)
    leanRate: 10, // 1/s
    spawn: { x: 0, z: 2 },
  },

  voxel: {
    jitter: 0.05, // default ±brightness jitter per box (spec §3: 4–6%)
    emissiveDefault: 2.5, // emissive multiplier when a box sets e: true
    roughness: 0.82, // opaque voxel material
    metalness: 0.08,
    test: {
      enabled: false, // debug "voxel test" toggle
      position: { x: 4.5, z: -3.5 },
    },
  },

  reticle: {
    radius: 0.42, // m
    width: 0.05, // m
    segments: 4, // arcs
    gapFrac: 0.28, // fraction of each arc slot that is empty
    color: '#35e0ff',
    intensity: 0.9, // below bloom threshold: subtle
    opacity: 0.55,
    spinSpeed: 0.8, // rad/s (real time)
    height: 0.015, // m above floor
  },

  ui: {
    showHint: true, // small controls hint (placeholder until the Stage 5 HUD)
  },

  debug: {
    startOpen: false, // lil-gui panel visible at start (toggle with `)
    statsInterval: 0.5, // s, FPS counter refresh
  },
};
