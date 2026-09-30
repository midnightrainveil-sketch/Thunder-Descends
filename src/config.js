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
    fitMargin: 1.4, // m, extra radius around the arena kept in frame
    fitHeight: 0, // m, character height kept inside the fit band at the rim (0: heads at the back rim may use the headroom)
    fitDepth: 0.4, // m, foundation drop kept in frame below the rim
    headroomTop: 0.35, // fraction of frame height kept free above the arena (torii, canopies)
    bottomPad: 0.0, // fraction of frame height kept free below the arena
    sidePad: 0.02, // fraction of frame width kept free left/right
    near: 0.5, // m
    far: 1200, // m
    fitSamples: 96, // points sampled around the rim for auto-fit
    shake: {
      maxOffset: 0.45, // m at trauma 1
      maxRollDeg: 1.1, // degrees at trauma 1
      frequency: 22, // noise speed, Hz-ish
      exponent: 2, // shake = trauma^exponent
      maxTrauma: 0.75, // overlapping shakes never exceed this (polish)
      perHitCap: 0.5, // a single shake call adds at most this much trauma
      enabled: true, // pause-menu toggle
    },
    punch: {
      attack: 0.18, // fraction of the duration spent zooming in
    },
  },

  arena: {
    radius: ARENA_RADIUS,
    rimInset: 0.6, // m, randomRimPoint() distance inside the radius
    rimTries: 32, // attempts for randomRimPoint()
    // Spawn gates = the 4 balustrade gaps (spec §4). Angles in degrees from +Z (front) toward +X (right).
    gates: [
      { name: 'frontRight', angleDeg: 45 },
      { name: 'backRight', angleDeg: 135 },
      { name: 'backLeft', angleDeg: 225 },
      { name: 'frontLeft', angleDeg: 315 },
    ],
    gateWidth: 2.6, // m, gap chord in the balustrade
    gateSpawnInset: 0.9, // m, gate spawn point distance inside the play radius
  },

  lighting: {
    hemiSky: '#7471a6', // hemisphere sky color
    hemiGround: '#2a2c40', // hemisphere ground color
    hemiIntensity: 2.3,
    moonColor: '#c9d4ff',
    moonIntensity: 3.1,
    moonFollowsSky: true, // light azimuth follows the sky moon's position (behind-left by default)
    moonElevationDeg: 58, // light elevation when following the sky moon (higher = shorter tree shadows on the floor)
    moonDir: { x: -0.55, y: 1.0, z: -0.65 }, // direction toward the moon when not following the sky
    moonDistance: 60, // m, light position distance from origin
    shadowMapSize: 2048,
    shadowRadiusFit: 20, // m, shadow frustum radius (arena + nearest trees)
    shadowHeight: 10, // m, tallest shadow caster height considered for fitting
    shadowBias: -0.0005,
    shadowNormalBias: 0.025,
    shadowRadius: 2.2, // PCF softness (texels)
    rimColor: '#7fb4ff',
    rimIntensity: 1.2,
    rimDir: { x: 0.35, y: 0.5, z: -1.0 }, // direction toward the back/rim light
  },

  render: {
    pixelRatioMax: 2,
    msaaSamples: 4, // composer MSAA samples (renderer antialias doesn't apply to render targets)
    exposure: 1.0, // ACES tone mapping exposure
    fogColor: '#2c2d5e', // FogExp2 haze: farther = lighter, bluer (atmospheric perspective)
    fogDensity: 0.0034, // FogExp2 density
  },

  post: {
    bloom: {
      strength: 0.6,
      radius: 0.35,
      threshold: 1.0, // high: only emissive parts (vertex colors > 1) glow; lit ivory/blossom tops stay below
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
    hitstopMax: 0.12, // s, a single freeze never exceeds this
    hitstopGap: 0.05, // s (real) after a hitstop before another may start (no chained freezes)
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
    leanDeg: 7, // forward lean at full speed
    leanRate: 8, // 1/s
    spawn: { x: 0, z: 4.5 },
    // Animation (Stage 2)
    anim: {
      idleDuration: 3.2, // s per breathing idle loop
      runDuration: 0.62, // s per run cycle (2 steps)
      runSpeedRef: 6, // m/s at which the run clip plays at 1×
      runBlendRate: 10, // 1/s, idle ↔ run blend smoothing
      attackDurations: [0.55, 0.55, 0.72], // s per combo step (spec: 0.55 s interval, heavier finisher)
      hitWindows: [[0.36, 0.5], [0.36, 0.5], [0.5, 0.62]], // normalized hitStart/hitEnd per step
      hurtDuration: 0.4, // s
      deathDuration: 1.6, // s
      attackFade: 0.07, // s, crossfade into an attack
      upperFadeOut: 0.2, // s, upper layer fade back to locomotion
      legTurnRate: 9, // 1/s, legs turn toward the move/aim direction
      aimTurnRate: 22, // 1/s, upper body follows the aim
      twistMaxDeg: 60, // max upper-body twist relative to the legs
      twistSplit: [0.3, 0.5, 0.2], // share of the twist on spine / chest / head
      backpedalDeg: 110, // moving more than this away from the aim → legs face aim, run backwards
      breathRate: 0.3, // Hz
      breathDeg: 1.4, // chest breathing amplitude
      bankDeg: 5, // roll into turns
      sashLag: { gain: 0.07, stiffness: 55, damping: 8, maxDeg: 28 }, // sash panels trail the body
      pauldronLag: { gain: 0.035, stiffness: 90, damping: 11, maxDeg: 10 },
    },
    combo: {
      resetTime: 0.9, // s without attacking → combo back to step 1 (spec §5)
      damage: [1.0, 1.0, 1.4], // ×ATK per step (Stage 3)
      range: 2.4, // m (Stage 3)
      arcDeg: 120, // (Stage 3)
    },
    trail: {
      samples: 16, // ribbon history length
      lifetime: 0.16, // s, a sample fades out over this (hero clock)
      color: '#35e0ff',
      intensity: 2.4, // HDR multiplier (blooms)
      opacity: 0.85,
      baseInset: 0.25, // m from the guard where the ribbon starts
    },
  },

  // ── Enemies (spec §8 base values; AI arrives in Stage 3) ────────────────────
  enemies: {
    // Base values at wave 1 (spec §8) + per-type AI (Stage 3).
    ronin: {
      hp: 120, damage: 18, speed: 3.2, exp: 10, radius: 0.45, walkAnimSpeedRef: 1.9,
      engageRange: 1.9, // m, starts the windup when the hero is this close
      holdRange: 1.4, // m, approaches no closer than this
      slashRange: 1.6, // m, sector hitbox reach
      slashArcDeg: 100, // sector hitbox arc
      cooldown: 1.4, // s between attacks
      lunge: 2.6, // m/s forward burst on the strike
      knockback: 4, // m/s pushed into the hero
    },
    teppo: {
      hp: 90, damage: 22, speed: 2.8, exp: 12, radius: 0.45, walkAnimSpeedRef: 1.9,
      keepMin: 6, keepMax: 8, // m, preferred distance band from the hero
      strafe: 0.5, // × speed while inside the band
      fireRange: 11, // m, only aims when the hero is within this
      cooldown: 2.4, // s between shots
      aimTrack: 0.6, // share of the aim telegraph during which it still tracks the hero, then locks
      boltSpeed: 9, // m/s
      boltRadius: 0.18, // m
      boltLife: 3, // s
      lineLength: 12, // m, aim telegraph line length
      lineWidth: 0.35, // m
      knockback: 3,
    },
    tate: {
      hp: 260, damage: 35, speed: 2.2, exp: 20, radius: 0.6, walkAnimSpeedRef: 1.7,
      engageRange: 2.4, // m, starts the slam when the hero is this close
      holdRange: 1.5,
      slamRadius: 2.2, // m (spec §8)
      slamOffset: 0.9, // m in front of the Tate where the slam circle is centered
      cooldown: 2.6, // s between slams
      blockArcDeg: 120, // frontal shield arc
      blockReduction: 0.8, // damage blocked from the front unless stunned
      knockback: 7,
    },
    stopDistance: 2, // m, legacy walker stop distance (debug walkers)
    stunImmuneAfter: 0.4, // s after a stun ends before another stun can land
    knockbackDrag: 9, // 1/s, knockback velocity decay
    hurtFlash: 0.08, // s white hit flash (spec §8)
    eyeFlareDecay: 1.6, // 1/s
    spawnBeam: 1.0, // s spawn telegraph (orange beam + ring)
    turnRate: 7, // 1/s
    accel: 12, // m/s²
    spawnMinDist: 5, // m from the hero (spec §9)
    separation: 1.3, // m, enemies push apart below this distance
    walkDuration: 1.0, // s per walk cycle
    anim: {
      windupDuration: 0.45, // s (Ronin slash windup, spec §8)
      strikeDuration: 0.45, // s
      aimDuration: 0.7, // s (Teppo aim telegraph)
      fireDuration: 0.35, // s
      slamDuration: 1.3, // s (0.9 s telegraph + slam)
      blockDuration: 0.3, // s to raise the shield
      hurtDuration: 0.35,
      stunnedDuration: 1.4, // s per stunned sway loop
      eyeFlare: 3.2, // eye glow multiplier during telegraphs
      shieldBrace: 0.85, // Tate shield counter-rotation vs. left-arm pitch (1 = always vertical)
    },
  },

  // ── Combat (Stage 3) ────────────────────────────────────────────────────
  combat: {
    heroHitstop: 0.035, // s, normal hit
    heroShake: 0.14, // trauma per normal hit
    finisherShake: 0.22,
    heroKnockback: [2.2, 2.2, 4.5], // m/s per combo step
    comboStun: [0, 0, 0.35], // s stagger per combo step (finisher interrupts windups)
    damageJitter: 0.1, // ±10% damage variance
    hurtKnockback: 5, // m/s pushed away when the hero is hit
    hurtShake: 0.35,
    hurtHitstop: 0.05,
    blockedKnockback: 0.6, // × knockback when the Tate blocks
    deathSlowmo: 0.2, // time scale after the hero dies
    deathSlowmoTween: 0.35, // s
    deathOverlayDelay: 1.4, // s (real) before "Press Enter to retry"
  },

  // Passive — whip strike on crit (spec §6).
  whip: {
    reach: 5.5, // m
    arcDeg: 170, // sweep + hitbox arc
    sweep: 0.28, // s extend + sweep
    extend: 0.08, // s of the sweep spent reaching full length
    retract: 0.15, // s snap back
    lag: 0.055, // s the segment nearest the hand trails the tip
    height: 1.05, // m, chain height above the floor at the tip
    sag: 0.18, // m, wave amplitude along the chain
    hitstop: 0.07, // s
    shake: 0.42, // trauma
    punch: 0.035, // camera zoom punch
    knockback: 6, // m/s
    petalStrength: 5, // petal sweep strength along the arc
    snapFlash: 4, // blade glow multiplier at the snap
    segScale: 2.2, // segments grow into chunky plates while flying (reads from the game camera)
    bladeGlow: 2.2, // blade edge glow multiplier while extended
    linkWidth: 0.13, // m, lightning between segments
    linkIntensity: 4.5,
    tipTrail: { samples: 28, lifetime: 0.16, color: '#aef3ff', intensity: 2.6, opacity: 0.9, inner: 1.1 }, // inner = m inward from the tip
  },

  // ── Skills (Stage 4, spec §7) ───────────────────────────────────────────
  // Rank values are arrays indexed by rank − 1 (ranks 1–4; rank-ups come from Stage 5 cards).
  skills: {
    startRank: 1,
    thunderclaw: {
      cooldown: [6, 6, 5, 5], // s (rank III: −1 s)
      range: 9, // m, max target distance
      radius: [2.5, 3, 3, 3], // m, grab radius
      maxTargets: [3, 4, 4, 4],
      aimScale: 0.15, // world + hero time scale while aiming
      aimTween: 0.12, // s (real) into / out of the slow-mo
      aimTimeout: 2.5, // s (real) → auto-fire at the cursor
      aimTint: '#3f6dff', aimTintStrength: 0.5, aimSaturation: 0.6,
      launch: 0.18, grab: 0.2, pull: 0.25, reattach: 0.12, // s (hero clock)
      grabMult: 1.2, grabStun: 1.5, // ×ATK, s
      stunnedBonus: [0, 0, 0, 0.3], // extra damage vs grabbed enemies while stunned (rank IV card)
      landRadius: 2, landMult: 0.8, // impact on landing
      landStop: 1.1, // m short of the grab center where the hero lands
      clusterSpacing: 0.75, // m between yanked enemies
      chainLinks: 60, // instanced link pool
      linkSpacing: 0.21, // m between links
      linkSize: [0.18, 0.1, 0.27], // m (w, h, length) — chunky so it reads from the fixed camera
      sag: 0.08, // chain sag per meter of length
      afterimageEvery: 0.03, // s
      ringColor: '#35e0ff',
    },
    shatter: {
      cooldown: [10, 10, 10, 10],
      windup: 0.12, // s
      thrust: 0.32, // s thrust clip (hit at its start)
      recover: 0.22, // s after a miss
      length: [3.5, 3.5, 5, 5], width: [1.2, 1.2, 1.6, 1.6], // m rectangle
      mult: 1.8, stun: 1.0, lunge: 1.4, // ×ATK, s, m forward during the thrust
      overdrive: [1.0, 1.4, 1.4, 1.4], // s
      slashEvery: 0.08, // s
      slashRange: 3.2, slashArcDeg: 120, slashMult: 0.45,
      finalMult: 1.2, finalHitstop: 0.06, finalShake: 0.35,
      drift: 1.5, // m/s toward the aim
      afterimageEvery: 0.05,
      chain: [false, false, false, true], // rank IV: slashes chain lightning to one nearby enemy
      chainRange: 4, chainMult: 0.3,
    },
    demontime: {
      cooldown: [30, 30, 30, 30],
      cast: 2.2, // s total (hero clock, invulnerable, input locked)
      freezeAt: 0.4, nanoEnd: 1.6, restoreAt: 2.0, // phase boundaries (s)
      ringMax: 45, // m: past the screen edge
      buff: [7, 9, 9, 9], // s (hero clock)
      pulseRadius: [5, 5, 7, 7], pulseMult: [2.0, 2.0, 4.0, 4.0],
      attackSpeed: 1.6, cooldownRate: 2, // buff multipliers
      bladeThick: 1.6, // blade segments' cross-section scale during the buff
      nanobots: 420, nanoRate: 380, // pool / spawned per second during 0.4–1.6 s
      nanoFlight: [0.28, 0.5], // s
      auraEvery: 0.06, // s between aura crackles
      killExtend: [0, 0, 0, 0.5], killExtendMax: 4, // rank IV card
    },
    afterimages: { pool: 8, life: 0.22, color: '#35e0ff', opacity: 0.45 },
  },

  // ── FX pools (Stage 3) ──────────────────────────────────────────────────
  fx: {
    particles: { glow: 700, solid: 300, gravity: 14 }, // cube particle pools
    shatter: { max: 260, life: 2.2, fade: 0.5, bounce: 0.35, friction: 0.7, speed: 4.5, up: 4, spin: 9 },
    slashArcs: 10, // crescent pool
    lightningBolts: 48, // bolt pool
    lightningPoints: 9, // points per bolt
    decals: 16, // telegraph decal pool
    rings: 12, // shockwave ring pool
    beams: 4, // spawn beam pool
    decalY: 0.045, // m, gameplay decals above tiles / seams / lantern pools
    decalColor: '#ff4a1f', // telegraph red-orange
    slashColor: '#7feaff',
    critColor: '#e8fdff',
    sparkColor: '#6fe8ff',
    emberColor: '#ff8a2a',
    exp: { size: 0.1, pop: 3.2, delay: 0.35, magnetRange: 3, accel: 40, maxSpeed: 16, pickup: 0.5, pool: 120, color: '#35e0ff', value: 4 }, // value = EXP per shard
    numbers: { pool: 40, life: 0.85, rise: 55, critScale: 1.7 }, // DOM damage numbers (px/s rise)
  },

  // ── Waves & progression (spec §9–10) ───────────────────────────────────
  waves: {
    maxAlive: 2,
    countBase: 3, countPerWave: 1.2, // 3 + floor(1.2·w)
    hpGrowth: 1.14, dmgGrowth: 1.07, // per wave
    speedPerWave: 0.015, speedMax: 0.3,
    breakTime: 2.5, // s between waves
    breakHeal: 0.2, // share of max HP healed at a break
    firstDelay: 1.2, // s before wave 1 spawns
    spawnInterval: 0.6, // s minimum between spawns
    unlock: { ronin: 1, teppo: 2, tate: 3 }, // first wave per type
    weights: { ronin: 3, teppo: 2, tate: 1.4 },
    bannerTime: 1.8, // s
  },
  progression: {
    expBase: 40, expPerLevel: 25, // EXP to next = 40 + 25·(L−1)
    atkGain: 0.08, hpGain: 0.05, levelHeal: 0.25,
  },
  hud: {
    corner: 'top-left',
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

  // ── Map (Stage 1, spec §4) ────────────────────────────────────────────────
  map: {
    floor: {
      rimOuterRadius: 13.2, // m, tiles with center ≤ this form the rim ledge (play tiles: center < ARENA_RADIUS)
      bandWidth: 2, // blocks per concentric ring band
      heightMin: 0.004, // m, lowest tile top (keeps tiles above the foundation tops)
      heightJitter: 0.014, // m, extra random tile height (total ≤ 2 cm)
      jitter: 0.07, // ±brightness per play tile
      rimJitter: 0.09, // ±brightness per rim tile
      edgeWidth: 0.04, // m, darkened band along tile borders
      edgeDarken: 0.42, // 0..1
      mossFrom: 8.5, // m, play tiles beyond this radius can be moss
      mossChance: 0.05, // per play tile beyond mossFrom
      rimMossChance: 0.14, // per rim tile
      crestHalf: 2, // tiles: crest replaces the (2·crestHalf+1)² center tiles with 0.5 m blocks
    },
    seams: {
      rings: [6, 10], // m, ring-band edges that carry cyan lines (band edges are every 2 m)
      radialAngles: [0, 90, 180, 270], // degrees, 4 radial lines on the block grid (IMG-01)
      radialFrom: 3, // m
      radialTo: 11, // m
      width: 0.07, // m
      height: 0.004, // m above the highest tile top (below future decals)
      rest: 1.6, // emissive multiplier at rest (low, just blooms)
      pulse: 2.4, // extra multiplier at the pulse front
      pulsePeriod: 8, // s (world clock)
      pulseSpeed: 6.5, // m/s outward
      pulseWidth: 1.4, // m
      crestCyan: 0.5, // emissive multiplier of the crest's cyan blocks
    },
    foundation: {
      depth: 2, // blocks below the rim edge (~2 m drop)
      tier2Depth: 3, // blocks, inset lower tier (mostly in mist)
      inset: 1, // blocks
      jitter: 0.08,
      mossChance: 0.1,
    },
    balustrade: {
      radius: 11.8, // m, ring just outside the play radius
      postSpacing: 2.3, // m, target spacing between posts
      railLength: 7, // blocks, modelled rail segment length (instances stretch ±10%)
      jitter: 0.07, // ±brightness per instance
    },
    lanterns: {
      radius: 12.55, // m, on the rim ledge outside the balustrade
      angleOffsetDeg: 22.5, // first lantern angle; 8 lanterns evenly spaced (gates sit between pairs)
      count: 8,
      emissive: 3.0, // fire box glow multiplier
      flickerAmount: 0.22, // ± fraction
      flickerSpeed: 7.5, // noise speed (world clock)
      pointLights: [7, 0], // lantern indices that carry a real point light (max 2)
      lightColor: '#ffb25a',
      lightIntensity: 5.5,
      lightDistance: 10, // m
      lightDecay: 1.6,
      lightHeight: 1.4, // m
      poolRadius: 2.7, // m, fake light-pool decal radius
      poolIntensity: 0.32,
      poolColor: '#ffb25a',
      poolHeight: 0.03, // m above y = 0 (decal layer; gameplay decals go above 0.04)
    },
    embers: {
      perLantern: 5,
      size: 0.045, // m
      rise: [0.45, 0.9], // m/s
      life: [1.3, 2.6], // s
      wobble: 0.22, // m/s side drift amplitude
      color: '#ff9a3a',
      intensity: 3.2,
    },
    terrain: {
      backArcDeg: 106, // half-angle of the terrain arc measured from the back (−Z)
      sideRadius: 19, // m, terrain outer radius at the arc ends
      backRadius: 24, // m, terrain outer radius at the back
      bottom: -14, // m, cliff bottom (hidden in mist)
      nearHeight: -1.4, // m, terrain height next to the rim
      slope: -0.12, // m per m of distance from the rim
      noise: 1.0, // m, height noise amplitude
      jitter: 0.08,
      mossChance: 0.12, // top blocks that are moss
    },
    torii: { x: 0.8, z: -14.4, worn: 0.08 }, // m position (pillar center line), fraction of darker worn blocks
    steps: { count: 4, width: 8, rise: 1, depth: 2, offset: 1.5, cutDepth: -4 }, // steps behind the torii (0.5 m blocks; offset/cutDepth in m)
    shrine: { x: 0.8, z: -27, y: 0 }, // m, shrine hall base (raised terrace: roof peeks over the kasagi)
    pagoda: { screen: { x: 0.87, y: 0.68 }, layer: 2, y: -64, block: 0.8, plateau: 8 }, // base at an NDC position in the fixed camera, on its own flat-topped peak
    trees: {
      seed: 20240,
      density: 1.0, // canopy cluster size multiplier
      colorBalance: 0.62, // 0 = pale/white, 1 = saturated pink
      greenCubes: [1, 3], // min/max green cubes per tree
      emissiveLift: 0.07, // very low self-light so blossoms read in moonlight (never blooms)
      topShade: 1.07, // brighter top faces (moonlit tops)
      bottomShade: 0.72,
      barkTopShade: 1.45, // lighter bark top faces
      swayAmp: 0.075, // m at full weight
      swaySpeed: 1.15,
      nearRadius: 21, // m, trees closer than this go in the shadow-casting group
      check: { margin: 0.45, height: 2.6, nudgeStep: 0.5, nudgeMax: 14 }, // play-area occlusion check
      // Placement: angle (deg from +Z toward +X), radius (m), height (m), hero flag. None in the front arc.
      placement: [
        { angleDeg: 205, radius: 16.5, height: 9.0, hero: true }, // hero tree, behind-left, frames the torii
        { angleDeg: 148, radius: 17.5, height: 7.2 },
        { angleDeg: 236, radius: 20.5, height: 7.6 },
        { angleDeg: 125, radius: 21.5, height: 8.2 },
        { angleDeg: 262, radius: 16.8, height: 6.0 },
        { angleDeg: 98, radius: 16.5, height: 6.4 },
        { angleDeg: 290, radius: 16.8, height: 5.2 },
        { angleDeg: 72, radius: 17.2, height: 5.4 },
        { angleDeg: 166, radius: 23.5, height: 7.4 },
      ],
    },
    petals: {
      size: 0.08, // m cube (petals may be smaller than the block scale)
      spawnRate: 34, // petals per second
      offscreenFrac: 0.18, // share spawned upwind outside the frame
      fall: [0.42, 0.8], // m/s terminal fall speed
      drag: 1.7, // 1/s, velocity relaxation toward wind + flutter
      flutterAmp: 0.55, // m/s side-to-side sway
      flutterFreq: [1.1, 2.6], // Hz
      spin: [2.0, 6.0], // rad/s tumble
      liftChance: 0.12, // per second, occasional upward lift
      liftStrength: 0.9, // m/s
      rest: [4, 8], // s lying on the ground
      fade: 1.0, // s shrink-out
      floorCarpet: 260, // resting petals on the play floor (movable)
      treeCarpet: 900, // static carpet under the trees
      voidY: -6, // m, petals below this recycle
      hop: 0.55, // upward share of an impulse for resting petals
    },
    wind: {
      strength: 1.1, // m/s
      dirDeg: 250, // blow direction, degrees from +Z toward +X (250 ≈ toward left-back)
      gustFreq: 0.11, // Hz
      gustStrength: 0.9, // extra fraction of strength during gusts
    },
    sky: {
      top: '#050818', // deep indigo at the top of the frame
      horizon: '#262a58', // lighter blue-violet toward the mist
      bottom: '#2c3462', // below the "horizon" (matches fog)
      topElevDeg: -19.5, // view elevation mapped to the top color (the frame top is ≈ −19° at 16:9)
      horizonElevDeg: -27, // elevation mapped to the horizon color (≈ mountain tops)
      starDensity: 0.012,
      starBrightness: 1.1,
      starTwinkle: 1.6, // speed (world clock)
      moon: {
        screen: { x: -0.66, y: 0.8 }, // NDC position in the fixed camera (behind-left)
        distance: 700, // m
        size: 0.1, // fraction of frame height
        color: '#e9eef7',
        intensity: 1.05,
        pixels: 18, // pixel-art resolution across the disc
        halo: 3.4, // halo size relative to the disc
        haloIntensity: 0.42,
      },
      clouds: { count: 4, speed: 4.5, opacity: 0.55, width: 2.8, height: 0.28 }, // width/height relative to moon size
    },
    mountains: {
      arcDeg: [55, 305], // angular range (deg from +Z toward +X) through the back
      // The camera looks down on the ridges, so they are sparse, steep karst spires rising out of
      // the mist sea; tops are chosen to land in the frame's top band and side margins.
      layers: [
        { radius: 58, block: 3, base: -46, low: -30, high: -13, slope: 1.35, spacing: 6, color: '#141730' },
        { radius: 100, block: 5, base: -72, low: -50, high: -28, slope: 1.2, spacing: 5, color: '#1d2244' },
        { radius: 175, block: 8, base: -118, low: -86, high: -58, slope: 1.1, spacing: 4, color: '#2a3159' },
      ],
      rows: 6, // radial rows per layer
      peakPower: 1.5, // >1: fewer tall peaks
    },
    mist: {
      color: '#8a95c8',
      density: 1.0, // global opacity multiplier
      layers: [
        { y: -0.7, inner: 13.4, outer: 27, opacity: 0.22, scale: 0.08, speed: 0.35 },
        { y: -2.2, inner: 11, outer: 34, opacity: 0.34, scale: 0.05, speed: 0.25 },
        { y: -4.8, inner: 9, outer: 44, opacity: 0.3, scale: 0.035, speed: 0.18 },
        { y: -34, inner: 0, outer: 520, opacity: 0.32, scale: 0.012, speed: 0.12 },
      ],
    },
    debug: {
      canopyCheck: false, // highlight blossom clusters that cover the play area from the game camera
    },
    debugTests: {
      impulseRadius: 3.5, // m, debug petal impulse (I / button)
      impulseStrength: 6, // m/s
    },
  },

  // ── Quality (Stage 1) ─────────────────────────────────────────────────────
  quality: {
    treeShadows: true, // near trees cast shadows onto the rim
    petalCount: 800, // falling petal pool size
    mistLayers: 4, // 0–4
  },

  ui: {
    showHint: false, // Stage 0 controls hint (replaced by the title screen)
    cardDelay: 0.7, // s (real) after a level-up before the cards open
    hpSegments: 12, // segmented HP bar
    flashMax: 0.45, // cap on full-screen flashes (polish)
  },

  // ── Bosses (Stage 5, spec §9) ───────────────────────────────────────────
  bosses: {
    stunQ: 0.6, stunE: 0.4, // reduced stuns (s) from Thunderclaw / Shatter; others ignored
    introDrop: 0.7, // s falling in
    introHold: 1.0, // s after landing before the first attack
    deathTime: 1.6, // s (real) of slow-mo explosions before the shatter
    deathSlowmo: 0.3,
    enrageAt: 0.5, // HP fraction
    loopHp: 0.6, // endless: +60% HP per repeat
    expBurst: 1, // EXP multiplier on the boss's exp value
    recover: [0.7, 1.2], // s between attacks (random range)
    juggernaut: {
      name: 'Oni Juggernaut', hp: 3000, exp: 150, radius: 1.3, speed: 2.1, keepDist: 3.2,
      slam: { damage: 40, radius: 2.2, first: 0.85, next: 0.45, spacing: [2.4, 4.6, 6.8] },
      charge: { damage: 55, telegraph: 0.9, speed: 15, width: 2.6, stun: 1.2, knockback: 12 },
      stomp: { damage: 35, radius: 4.5, telegraph: 0.8 },
      enrage: { speed: 1.3, chestGlow: 2.6 },
      weights: { slam: 3, charge: 2, stomp: 2 },
    },
    kitsune: {
      name: 'Kage Kitsune', hp: 4500, exp: 220, radius: 0.55, speed: 4.2, keepDist: 4.5,
      blink: { damage: 30, flash: 0.5, behind: 1.4, reach: 2.2, arcDeg: 150 },
      dash: { damage: 28, telegraph: 0.8, speed: 26, width: 1.3, count: 3, length: 7 },
      fan: { damage: 18, telegraph: 0.6, count: 11, arcDeg: 90, speed: 11, range: 12 },
      enrage: { speed: 1.3, clones: 2, cloneDamage: 0.5 },
      weights: { blink: 3, dash: 2, fan: 2 },
      tailSway: { amp: 22, speed: 2.4 }, // degrees, Hz-ish
    },
    raiju: {
      name: 'Raiju Serpent', hp: 7000, exp: 320, segments: 16, spacing: 0.95, radius: 0.75, headMult: 1.5,
      orbitRadius: 13.2, height: [2, 4], orbitSpeed: 0.32, // rad/s
      crossChance: 0.3, // chance a move phase crosses over the arena (figure-8)
      beam: { damage: 12, tick: 0.12, telegraph: 0.9, sweep: 1.0, arcDeg: 70, length: 16, width: 1.4 },
      pillars: { damage: 35, count: [5, 8], enragedCount: [8, 11], radius: 1.3, telegraph: 0.95, spread: 4.5 },
      dive: { damage: 45, telegraph: 1.0, speed: 17, width: 2.4, height: 1.0 },
      enrage: { speed: 1.3 },
      weights: { beam: 2, pillars: 3, dive: 2 },
    },
  },

  // Level-up cards (spec §10).
  cards: {
    statMax: 5, // each stat card at most 5 times
    atk: 0.1, hp: 0.12, attackSpeed: 0.08,
    passiveCritDamage: 0.3, passiveWhipReach: 1.5, passiveHeal: 0.01,
  },

  debug: {
    startOpen: false, // lil-gui panel visible at start (toggle with `)
    statsInterval: 0.5, // s, FPS counter refresh
    clawTest: { distance: 6, out: 0.2, hold: 0.25, back: 0.3, height: 0.9 }, // "test claw" flight (hero clock)
    bladeSplitTest: { extend: 0.28, hold: 0.35, retract: 0.15, gap: 0.3, arcDeg: 70 }, // "test blade split"
    modelViewer: { position: { x: 0, z: 0 }, distance: 6.5, height: 1.4 }, // M: model viewer framing
  },
};
