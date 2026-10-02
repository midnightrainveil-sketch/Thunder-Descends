// Thunder Descends — every tunable number lives here, grouped by system (spec §13).
// Systems read these objects live, so the debug panel can edit them at runtime.

// ── Block scales (spec §2) ────────────────────────────────────────────────
export const VOXEL = 0.12; // m, character block size (enemies)
export const HERO_VOXEL = 0.06; // m, the hero alone uses half-size blocks so his detailed design reads (≈ 42 blocks tall)
export const BOSS_VOXEL = 0.18; // m, large boss block size
export const ENV_VOXEL = 0.25; // m, environment prop block size
export const ENV_BIG_VOXEL = 0.5; // m, canopy cubes, big structures, crest
export const FLOOR_BLOCK = 1.0; // m, floor block size

// ── World (spec §2) ───────────────────────────────────────────────────────
export const ARENA_RADIUS = 11; // m, play circle radius centered at origin

export const CONFIG = {
  // Player-facing names (title screen, cards, HUD, banners). Internal ids stay q / e / r.
  names: {
    game: 'Thunder Descends',
    q: 'Storm Grapple', // pull-chain claw (was Thunderclaw)
    e: 'Lightning Lance', // aimed thrust (was Shatter)
    overdrive: 'Blade Storm', // E phase 2 (was Overdrive)
    r: 'Zero Hour', // time-stop ultimate (was Demontime)
    dash: 'Flash Step',
    passive: 'Chain Blade', // crits become whip strikes
  },
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
    // Third-person follow camera (default in play; the fixed pose above frames the title
    // screen, the map composition and the V toggle). Mouse look via pointer lock.
    mode: 'follow', // 'follow' | 'fixed' (V toggles in play)
    // Cinematic close-up during the Zero Hour cast (follow camera only).
    cine: {
      sideDeg: -38, // camera in front of the hero, swung this far toward his sword side
      distance: 5.6, // m
      height: 1.05, // m, pivot above the feet (low, so the planted sword clears the skill bar)
      pitchDeg: 6, // look-down angle
      blendIn: 0.35, // s (real)
      blendOut: 0.55, // s (real)
    },
    follow: {
      fov: 56, // vertical FOV, degrees
      distance: 9.5, // m, boom length from the pivot (scroll wheel / pause-menu slider)
      zoomStep: 0.1, // scroll wheel: ×1.1 distance per notch
      zoomMin: 4, zoomMax: 16, // m, wheel / slider range
      zoomRate: 16, // 1/s, the boom eases to a new zoom distance (zoom only — never the look)
      height: 2.5, // m, pivot above the hero's feet (upper back / neck)
      shoulder: 0.85, // m, pivot shifted right so the hero doesn't hide the aim point
      pitchDeg: 24, // starting look-down angle
      pitchMinDeg: -10, // looking up limit
      pitchMaxDeg: 65, // looking down limit
      sensitivity: 0.006, // rad per mouse count, same on both axes (pause-menu slider)
      invertY: false,
      lookSmoothing: 0, // s, optional look smoothing time constant (0 = off: the view turns exactly with the mouse; pause-menu slider)
      aimDistPerPx: 0.035, // m per mouse count: Storm Grapple target distance while aiming (follow camera)
      keyTurnRate: 2.4, // rad/s, ← → arrow keys turn the camera (no-mouse fallback)
      followRate: 18, // 1/s, pivot catch-up (exponential smoothing of the hero's position only)
      boundRadius: ARENA_RADIUS + 4.5, // m, the camera stays inside this circle: the boom shortens along the view ray instead of turning the view (props near the camera dither out)
      minHeight: 0.9, // m, looking up shortens the boom so the camera stays above this
      minBoom: 1.5, // m, shortest boom
      aimMaxDist: 13, // m, aim point distance cap from the hero (looking at the horizon)
      aimMinDist: 1.2, // m, aim point at least this far ahead of the hero
      crosshairY: 0.2, // NDC y of the aim ray and crosshair: above the hero's head so he never hides the aim point
      blendTime: 0.7, // s, glide between fixed and follow poses
      lockRetryMs: 1100, // ms, retry a refused pointer lock after Chrome's Esc cooldown
    },
  },

  // Mouse input under pointer lock (src/core/Input.js look()).
  input: {
    rawMouse: true, // ask for raw, unaccelerated mouse counts where supported (Chrome/Edge on Windows); pause-menu toggle, applies at the next capture
    maxJump: 1500, // counts, a single event bigger than this is corrupt and dropped
    spike: {
      min: 80, // counts, a warp spike is at least this big...
      ratio: 5, // ...and this many times the current motion, pointing back against it
      movingMin: 2, // counts per event of current motion before spikes are checked (never from rest)
      avgWeight: 0.3, // per-event weight of the current-motion average
      restMs: 120, // ms without events → motion average forgotten
    },
    driftGuard: 'auto', // 'auto' = on for Linux only, true / false to force (debug panel)
    drift: {
      window: 32, // recent sideways events examined
      minDx: 3, // counts: an event is "sideways" with |dx| ≥ this and |dy| ≤ 1
      minShare: 0.25, // ±1 vertical counts on at least this share of them...
      consistency: 0.9, // ...almost all of the same sign → that ±1 is OS drift and is removed
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
    brightness: 1.4, // scene light multiplier (hemi, moon, rim; not emissive glow) — pause-menu slider
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
    minPixelRatio: 0.6, // dynamic resolution never renders below this pixel ratio
    // Auto quality: lowers the internal resolution when frames run slow and raises it back when
    // there is headroom, so motion stays smooth (debug Post folder can switch it off).
    autoQuality: true,
    aqSlowMs: 19.5, // average frame time above this (≈ below 51 fps) → step resolution down
    aqFastMs: 15.5, // average frame time below this for aqUpAfter s → step back up
    aqUpAfter: 4, // s of headroom before stepping up
    aqStep: 0.1, // render scale step
    aqMinScale: 0.55, // lowest render scale (× capped device pixel ratio)
    aqWindow: 1.0, // s, frame-time averaging window
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
    // Dash (Shift): i-frames for the whole dash, afterimages, 3 charges.
    dash: {
      charges: 3, // max stacks
      recharge: 3, // s per stack (hero clock; one stack refills at a time)
      distance: 5.2, // m
      duration: 0.2, // s
      graceIFrames: 0.12, // s of i-frames after the dash ends
      exitSpeed: 0.55, // × move speed carried out of the dash
      buffer: 0.15, // s, a Shift press is remembered this long (hitstop, end of a swing)
      afterimageEvery: 0.045, // s between ghosts (~5 per dash)
      afterimageLife: 0.28, // s
      afterimageOpacity: 0.26, // additive: overlapping ghosts add up
      ringRadius: 1.1, // m, cyan ring at the start
      // Dash strike: attacking during or shortly after a dash snaps the hero to an enemy in front of
      // the aim (long range) for one heavy hit with a big screen shake.
      strike: {
        window: 0.8, // s after the dash ends (a click during the dash counts too)
        buffer: 0.2, // s, a click is remembered this long
        range: 8.5, // m, from the hero to the enemy's edge
        coneDeg: 90, // full cone around the aim direction (enemies within 2 m count from any side)
        speed: 42, // m/s lunge
        maxLunge: 0.2, // s, the lunge never takes longer than this
        stopGap: 0.7, // m, stop this far from the enemy's edge
        mult: 2.8, // ×ATK (can crit)
        knockback: 11,
        stun: 0.35, // s (normal enemies; bosses ignore it)
        splashRadius: 2.4, splashMult: 0.6, // other enemies near the impact
        hitstop: 0.11, shake: 0.7, punch: 0.08, flash: 0.22,
        recover: 0.26, // s locked after the hit
        afterimageEvery: 0.018, // s
        glow: 1.2, // extra blade glow while the strike is ready
        markerColor: '#ff5a6e',
      },
    },
    // Base stats (spec §5). Combat uses these from Stage 3.
    maxHp: 600,
    moveSpeed: 6, // m/s
    attackMoveMul: 0.45, // move speed multiplier while attacking
    atk: 30,
    attackInterval: 0.55, // s
    critRate: 0.5,
    critDamage: 2.0,
    hurtIFrames: 0.4, // s
    lifesteal: 0.04, // share of damage dealt (not blocked) healed back
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
      aimTurnRate: 22, // 1/s, upper body turns toward the movement direction (out of combat)
      aimTurnSpeed: 40, // rad/s, while attacking / casting the body tracks the aim exactly, turning at most this fast (big flips take < 0.08 s)
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
      // Aim like Thunderclaw: slow-mo, tint, a lane on the floor; click fires, right-click / Esc cancels.
      aimScale: 0.15, aimTween: 0.12, aimTimeout: 2.5, // ×, s (real), s (real) → auto-fire
      aimTint: '#3f6dff', aimTintStrength: 0.5, aimSaturation: 0.6,
      laneColor: '#35e0ff',
      chainRange: 4, chainMult: 0.3,
    },
    demontime: {
      plantShake: 0.12, releaseShake: 0.16, pulseHitShake: 0.08, // kept small so the sword pull stays readable
      cooldown: [30, 30, 30, 30],
      cast: 2.5, // s total (hero clock, invulnerable, input locked)
      // Timeline (s): raise + two-handed stab → time-stop shockwave out of the sword at plantAt (ring
      // expands over ringOut); nanobots + plates from nanoStart to nanoEnd; the shockwave rushes back
      // into the sword until restoreAt (time resumes); Excalibur pull, the blade comes free at pullFree.
      // Spectacle (no extra shake): sky lightning into the sword, crackling arcs while time is
      // stopped, a radial lightning burst and gold ring on release, chromatic pulses.
      show: {
        skyBolts: 4, skyHeight: 16, skySpread: 1.2, // bolts from the sky into the sword at the stab (m)
        groundArcs: 8, groundArcLen: [3, 6], // radial ground arcs at the stab (m)
        holdArcEvery: 0.05, holdArcRadius: [1.5, 5.5], // s between crackles while time is stopped; m reach
        holdSparkEvery: 0.03, // s between rising cyan motes around the hero
        releaseBolts: 10, releaseSky: 5, // radial bolts out to the pulse radius + sky bolts on the release
        gold: '#ffd36b', crimson: '#ff3a4f',
        chromatic: 0.9, chromaticHold: 0.35, chromaticTime: 0.5, // aberration pulse (stab / hold / fade s)
        flashStab: 0.18, flashRelease: 0.3, // capped by ui.flashMax (kept low so the hero stays visible)
        skyIntensity: 2.6, skyWidth: [0.09, 0.05], // sky bolt brightness, main / fork width (m)
      },
      plantAt: 0.2, ringOut: 0.35, nanoStart: 0.3, nanoEnd: 1.6, restoreAt: 2.0, pullFree: 2.12,
      freezeTween: 0.08, // s, world time → 0 at the stab
      camBackAt: 2.2, // s, the cinematic close-up starts easing back to the player's camera
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
    afterimages: { pool: 14, life: 0.22, color: '#35e0ff', opacity: 0.45 },
  },

  // ── FX pools (Stage 3) ──────────────────────────────────────────────────
  fx: {
    particles: { glow: 700, solid: 300, gravity: 14 }, // cube particle pools
    shatter: { max: 260, life: 2.2, fade: 0.5, bounce: 0.35, friction: 0.7, speed: 4.5, up: 4, spin: 9 },
    slashArcs: 10, // crescent pool
    lightningBolts: 80, // bolt pool (Zero Hour sky strikes need headroom)
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
    // Boss, basic, boss, basic, boss (demo clear after wave 5), then endless keeps alternating.
    bossEvery: 2, // boss on waves 1, 3, 5, 7, …
    bossOrder: ['juggernaut', 'kitsune', 'raiju'], // repeats with loopHp / loopDamage
    demoWave: 5, // "Demo clear" after this wave (first time)
    // Basic waves are scaled as if `scaleStep` old waves passed per wave: level = 1 + (w−1)·scaleStep.
    scaleStep: 3, // wave 2 → level 4, wave 4 → level 10
    maxAlive: 3,
    countBase: 4, countPerWave: 0.6, // 4 + floor(0.6·level): wave 2 → 6, wave 4 → 10
    hpGrowth: 1.14, dmgGrowth: 1.07, // per level
    speedPerWave: 0.015, speedMax: 0.3, // per level
    expPerLevel: 0.15, // basic enemies give +15% EXP per level above 1
    breakTime: 2.5, // s between waves
    breakHeal: 0.2, // share of max HP healed at a break
    bossHeal: 0.4, // share of max HP healed after a boss wave
    firstDelay: 1.2, // s before wave 1 spawns
    spawnInterval: 0.6, // s minimum between spawns
    unlock: { ronin: 1, teppo: 2, tate: 3 }, // first level per type
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
      camFade: { near: 2.5, far: 6 }, // m from the camera: tree blocks dither out inside this range (follow camera at the rim)
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
    crosshair: { color: 'rgba(143, 244, 255, 0.85)', length: 6, gap: 4 }, // px, follow-camera screen-center crosshair (ticks + dot)
    cardDelay: 0.7, // s (real) into the break after a wave is cleared before the level-up cards open (cards wait for the end of the wave)
    hpSegments: 12, // segmented HP bar
    flashMax: 0.45, // cap on full-screen flashes (polish)
    hpLow: 0.3, // HP share: red pulsing vignette + pulsing bar at or below this
    hpMid: 0.55, // HP share: big bar turns amber at or below this
    hpLagHold: 0.45, // s the white "damage taken" trail holds before draining
    hpLagDrain: 0.8, // share of max HP per second the trail drains
    hpHitFlash: 0.15, // s the big bar glows after a hit
    toastTime: 3, // s an achievement toast stays up
    cardPickDelay: 0.45, // s the picked card glows before the screen closes
  },

  // ── Bosses (Stage 5, spec §9) ───────────────────────────────────────────
  bosses: {
    stunQ: 0.6, stunE: 0.4, // reduced stuns (s) from Thunderclaw / Shatter; others ignored
    introDrop: 0.7, // s falling in
    introHold: 1.0, // s after landing before the first attack
    deathTime: 1.6, // s (real) of slow-mo explosions before the shatter
    deathSlowmo: 0.3,
    enrageAt: 0.6, // HP fraction
    loopHp: 0.6, // endless: +60% HP per repeat
    loopDamage: 0.25, // endless: +25% damage per repeat
    hpMul: 1.15, // all bosses: HP multiplier on the base values below
    damageMul: 1.6, // all bosses: damage multiplier (melee, slams, beams, spikes)
    tempo: 1.45, // all bosses: base speed of movement, attacks and telegraphs (enrage multiplies on top)
    maxTempo: 2.1, // cap on tempo × enrage × per-attack jitter (telegraphs stay readable)
    // Unpredictability.
    attackJitter: [0.8, 1.35], // each attack runs at a random tempo multiplier (telegraph lengths vary)
    chainChance: 0.35, // chance to go straight into the next attack (no recovery)
    // Walking bosses switch movement modes at random: approach, circle-strafe, flank dash, back-step.
    moveSwitch: [0.35, 1.1], // s between mode changes
    moveWeights: { approach: 3, strafe: 3, flank: 1.6, backstep: 1 },
    flank: { speed: 3.2, duration: [0.22, 0.38], angleDeg: [60, 130] }, // × walk speed, s, around the hero
    backstep: { speed: 1.6, duration: [0.2, 0.35] }, // × walk speed, s
    expBurst: 2, // EXP multiplier on the boss's exp value (fewer waves → bosses carry the levelling)
    recover: [0.1, 0.95], // s between attacks (random range, ÷ tempo)
    juggernaut: {
      name: 'Iron Juggernaut', hp: 3000, exp: 150, radius: 1.3, speed: 2.8, keepDist: 3.2,
      slam: { damage: 40, radius: 2.2, first: 0.85, next: 0.45, spacing: [2.4, 4.6, 6.8] },
      charge: { damage: 55, telegraph: 0.9, speed: 15, width: 2.6, stun: 1.2, knockback: 12 },
      stomp: { damage: 35, radius: 4.5, telegraph: 0.8 },
      enrage: { speed: 1.3, chestGlow: 2.6 },
      weights: { slam: 3, charge: 2, stomp: 2 },
    },
    kitsune: {
      name: 'Shadow Fox', hp: 4500, exp: 220, radius: 0.55, speed: 5.0, keepDist: 4.5,
      blink: { damage: 30, flash: 0.5, behind: 1.4, reach: 2.2, arcDeg: 150 },
      dash: { damage: 28, telegraph: 0.8, speed: 26, width: 1.3, count: 3, length: 7 },
      fan: { damage: 18, telegraph: 0.6, count: 11, arcDeg: 90, speed: 11, range: 12 },
      enrage: { speed: 1.3, clones: 2, cloneDamage: 0.5 },
      weights: { blink: 3, dash: 2, fan: 2 },
      tailSway: { amp: 22, speed: 2.4 }, // degrees, Hz-ish
    },
    raiju: {
      name: 'Storm Serpent', hp: 7000, exp: 320, segments: 16, spacing: 0.95, radius: 0.75, headMult: 1.5,
      orbitRadius: 13.2, height: [2, 4], orbitSpeed: 0.42, // rad/s
      flipRate: 0.22, // per second: chance to reverse the orbit direction
      surge: { rate: 0.3, mul: 2.2, duration: 0.6 }, // random orbit speed bursts (per second, ×, s)
      crossChance: 0.45, // chance a move phase crosses over the arena (figure-8)
      beam: { damage: 12, tick: 0.12, telegraph: 0.9, sweep: 1.0, arcDeg: 70, length: 16, width: 1.4 },
      pillars: { damage: 35, count: [5, 8], enragedCount: [8, 11], radius: 1.3, telegraph: 0.95, spread: 4.5 },
      dive: { damage: 45, telegraph: 1.0, speed: 17, width: 2.4, height: 1.0 },
      enrage: { speed: 1.3 },
      weights: { beam: 2, pillars: 3, dive: 2 },
    },
  },

  // ── Audio (procedural Web Audio: no files) ─────────────────────────────
  audio: {
    master: 0.8, music: 0.45, sfx: 0.8, // volumes 0..1 (pause-menu sliders, saved)
    timeStopCutoff: 700, // Hz, lowpass on world sound + music while time is stopped
    musicBpm: 96,
    lowHpBeat: 0.85, // s between heartbeat thumps at low HP
  },

  // ── Score, combo and style rank (run goals) ─────────────────────────────
  score: {
    damageScore: 1, // score per point of damage dealt (× combo × rank multipliers)
    comboTimeout: 3, // s without landing a hit → combo ends
    comboStep: 0.02, comboMax: 2, // combo multiplier 1 + 0.02 per hit, capped at ×2
    kill: { ronin: 150, teppo: 180, tate: 240, clone: 60 }, // base kill bonus (× multipliers)
    bossKill: 6000, // × (1 + endless loop)
    waveClear: 400, // × wave number
    flawless: 800, // × wave number, cleared without taking damage
    // Style meter (0..1000): gains on good play, decays, drops when hit. Ranks multiply score.
    style: {
      hit: 9, crit: 15, kill: 40, skillHit: 14, dashStrike: 90, dodge: 70, bossHit: 6,
      hurt: -220, decay: 22, decayRank: 9, // per second (+ per rank above D)
      repeatAfter: 4, repeatMul: 0.35, // the same action more than 4 times in a row gains less
    },
    ranks: [
      { id: 'D', name: 'Dull', at: 0, mult: 1, color: '#9aa3b5' },
      { id: 'C', name: 'Charged', at: 120, mult: 1.2, color: '#8ff4ff' },
      { id: 'B', name: 'Brutal', at: 260, mult: 1.4, color: '#5fb8ff' },
      { id: 'A', name: 'Arcing', at: 420, mult: 1.7, color: '#b07aff' },
      { id: 'S', name: 'Stormborn', at: 600, mult: 2.0, color: '#ffd166' },
      { id: 'SS', name: 'Skyrender', at: 780, mult: 2.5, color: '#ff9f43' },
      { id: 'SSS', name: 'Thunder Descends', at: 920, mult: 3.0, color: '#ff4d6d' },
    ],
    coresPerScore: 1 / 250, // Thunder Cores earned per score point at the end of a run
    coresPerBoss: 15,
  },

  // ── Meta progression: Armory (permanent upgrades bought with Thunder Cores) ──
  meta: {
    costGrowth: 1.65, // each level costs this much more than the last
    upgrades: [
      { id: 'hp', name: 'Reinforced Frame', desc: '+6% max HP', icon: 'hp', max: 5, cost: 50, value: 0.06 },
      { id: 'atk', name: 'Honed Edge', desc: '+5% ATK', icon: 'atk', max: 5, cost: 50, value: 0.05 },
      { id: 'crit', name: 'Storm Heart', desc: '+2% crit chance', icon: 'passive', max: 5, cost: 60, value: 0.02 },
      { id: 'dash', name: 'Capacitor', desc: 'Dash recharge −8%', icon: 'dash', max: 5, cost: 60, value: 0.08 },
      { id: 'cd', name: 'Overclock', desc: 'Skill cooldowns −5%', icon: 'time', max: 5, cost: 70, value: 0.05 },
      { id: 'leech', name: 'Vampiric Alloy', desc: '+1% lifesteal', icon: 'leech', max: 3, cost: 90, value: 0.01 },
      { id: 'start', name: 'Head Start', desc: 'Start each run with a free upgrade card', icon: 'aspd', max: 2, cost: 150, value: 1 },
      { id: 'dash4', name: 'Fourth Charge', desc: '+1 dash charge', icon: 'dash', max: 1, cost: 600, value: 1 },
    ],
  },

  // Achievements (one-time, pay Thunder Cores).
  achievements: [
    { id: 'firstBlood', name: 'First Blood', desc: 'Destroy an enemy', reward: 10 },
    { id: 'juggernaut', name: 'Iron Breaker', desc: 'Defeat the Iron Juggernaut', reward: 40 },
    { id: 'kitsune', name: 'Fox Hunt', desc: 'Defeat the Shadow Fox', reward: 60 },
    { id: 'raiju', name: 'Storm Chaser', desc: 'Defeat the Storm Serpent', reward: 80 },
    { id: 'clear', name: 'Thunder Descends', desc: 'Clear the demo (wave 5)', reward: 120 },
    { id: 'rankS', name: 'Stormborn', desc: 'Reach style rank S', reward: 40 },
    { id: 'rankSSS', name: 'Living Storm', desc: 'Reach style rank SSS', reward: 120 },
    { id: 'combo50', name: 'Chain Reaction', desc: '50-hit combo', reward: 40 },
    { id: 'combo150', name: 'Endless Chain', desc: '150-hit combo', reward: 100 },
    { id: 'flawless', name: 'Untouchable', desc: 'Clear a wave without taking damage', reward: 40 },
    { id: 'strikes', name: 'Flash Master', desc: '10 dash strikes in one run', reward: 40 },
    { id: 'dodges', name: 'Ghost Step', desc: '15 dodges in one run', reward: 50 },
    { id: 'legendary', name: 'Legend', desc: 'Take a legendary card', reward: 40 },
    { id: 'score50', name: 'Rising Storm', desc: 'Score 50,000 in one run', reward: 60 },
    { id: 'score150', name: 'Tempest', desc: 'Score 150,000 in one run', reward: 150 },
    { id: 'wave10', name: 'Endless Thunder', desc: 'Reach wave 10', reward: 150 },
    { id: 'maxed', name: 'Fully Forged', desc: 'Max every Armory upgrade', reward: 300 },
  ],

  // Level-up cards (spec §10).
  cards: {
    // Rarity: odds (weights) and stat-card strength. Higher style rank at level-up = better odds.
    rarity: {
      common: { weight: 62, mult: 1, color: '#8ff4ff' },
      rare: { weight: 26, mult: 1.5, color: '#5fa8ff' },
      epic: { weight: 10, mult: 2.2, color: '#c07aff' },
      legendary: { weight: 2, mult: 3.5, color: '#ffc94d' },
    },
    rankLuckEpic: 2.5, rankLuckLegendary: 0.8, // extra weight per style rank above D
    rerolls: 1, // free rerolls per card screen
    leech: 0.03, strikeDmg: 0.5, thunderStepMult: 0.9, timeThief: 0.5, // special card values
    stormEvery: 6, stormMult: 2.5, stormRadius: 2.5, secondWindHp: 0.35,
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
