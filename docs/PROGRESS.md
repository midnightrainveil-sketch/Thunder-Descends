# KUROGANE — Progress log

One section per stage. Spec: [GAME_SPEC.md](GAME_SPEC.md).

---

## Stage 0 — Setup, engine, camera, post, time, voxel builder

### What was built
- **Project**: Vite + vanilla JS + three.js (0.186) + lil-gui, `vite-plugin-singlefile` → `npm run build` emits one self-contained `dist/index.html` (runs from `file://`). Full-window canvas in `#game`, `#ui` overlay (pointer-events off except `.interactive`), Google Fonts Chakra Petch + Silkscreen with fallbacks, no scrollbars, context menu disabled.
- **Engine** (`src/core/Engine.js`): WebGLRenderer (antialias, ACES filmic, sRGB, PCF shadows, pixel ratio ≤ 2), scene, subtle FogExp2 in night indigo, placeholder gradient sky, resize dispatch.
- **Camera** (`src/core/CameraRig.js`): fixed pose from `elevationDeg` / `yawDeg` / `fov` / `target`. Auto-fit binary-searches the distance so the arena circle + margin (and the foundation drop below the rim) fit at any aspect ratio. Framing uses a **lens shift** (off-axis projection) so the arena sits low with `headroomTop` free above it without changing the viewing angle. `shake(intensity, duration)` (trauma-based, decays, real time) and `punch(zoomAmount, duration)` (short FOV zoom around the optical axis). A separate unshaken `pickCamera` is used for mouse picking.
- **Post** (`src/core/PostFX.js`, `src/core/GradePass.js`): RenderPass (MSAA ×4 half-float target) → UnrealBloomPass → GradePass → OutputPass. GradePass has saturation, tint (color + strength), vignette, chromatic aberration, additive flash and the time-stop ring (ringCenter UV, ringRadius, ringActive; grayscale inside, cyan boundary line, slight refraction at the front). **Hero mask is implemented, not just stubbed**: while the ring is active, a depth prepass of the whole scene plus a white pass of `MASK_LAYER` objects is rendered into `maskTarget`, so opted-in objects stay in color and occluders still cover them. API: `setSaturation`, `setTint`, `setChromatic`, `setVignette` (all with optional tween duration), `flash(strength, duration)`, `setTimeRing(worldPos, radius, active)` (world → screen UV internally; radius in meters, screen-parallel), `addToMask(obj)` / `removeFromMask(obj)`.
- **Time** (`src/core/GameTime.js`): `realDt` (clamped 1/20 s), `worldScale`, `heroScale`, `debugScale` (T hotkey), `paused`, `hitstop(duration)` (with a `hitstopLocked` flag for the ult cast), `tweenScale(layer, target, duration)` (`'world' | 'hero' | 'both'`), accumulated `worldTime` / `heroTime` / `realTime`.
- **Input** (`src/core/Input.js`): key down/pressed/released by `KeyboardEvent.code`, mouse px + NDC, mouse ground point (ray ∩ y = 0), mouse buttons with edges, focus loss / tab hide clears held state.
- **Loop** (`src/main.js`, `src/core/Loop.js`): input → time → game update → FX update → camera → render → UI.
- **Voxel builder** (`src/voxel/VoxelBuilder.js`): `buildPart(boxes, palette, {voxelSize, jitter, seed, cullHidden, origin, material, ...})` → `{group, opaqueMesh, emissiveMesh, boxes, voxelSize, triangles}`. Boxes snap to integer grid; deterministic per-box brightness jitter (`j` overrides per box); emissive boxes (`e`) go to a MeshBasicMaterial mesh with vertex colors × e (> 1 → bloom). `cullHidden` removes every face covered by a neighbour (fully hidden boxes vanish, overlaps resolve last-box-wins so no z-fighting). `mirrorX(boxes, axis)` / `withMirrorX`. Box list kept on `group.userData.part` for Stage 3 death shatter. `BoxBatch` for thin non-grid boxes (glow seams). `palettes.js` holds hero, enemy, map and boss palettes from spec §3.
- **Block-edge material** (`src/voxel/blockEdgeMaterial.js`): procedural darkening along block boundaries (world-space, no textures) so the big coplanar floor blocks read as chunky blocks while the floor stays perfectly flat.
- **Placeholder arena** (`src/world/PlaceholderArena.js`): stepped pixel circle of 1 m basalt blocks that fully covers the true r = 11 circle, alternating 2-block ring bands, cyan glow lines on the stepped edges of rings r = 4 and r = 8, two-tier stepped foundation wall. **Arena helpers** (`src/world/ArenaBounds.js`, re-exported from PlaceholderArena): `clampToArena(pos, radius)`, `isInsideArena(pos, radius)`, `randomRimPoint(minDistFrom, minDist)`. Here `radius` means the body radius; the clamp is `ARENA_RADIUS − radius`.
- **Lighting** (`src/world/Lighting.js`): dim blue hemisphere fill, cool moonlight (only shadow caster) with an orthographic shadow frustum fitted to the light-space bounds of the arena cylinder, subtle cool back/rim light.
- **Placeholder hero** (`src/voxel/models/PlaceholderHero.js`, `src/entities/Hero.js`): 20-block (2.4 m) mannequin at VOXEL scale (3-block head, 10-block legs, 9-block pauldron span, 3-block waist), hero palette, cyan visor row and chest core, oversized left gauntlet, crimson sash, nodachi (hilt, square guard, 8 two-block segments with a cyan edge row) held low and outward. Screen-relative WASD with acceleration/deceleration, exponential turn toward the mouse ground point, clamped to the circle (sliding along the rim), casts shadows, small forward lean. Opted into the hero mask.
- **Mouse reticle** (`src/fx/MouseReticle.js`): subtle segmented cyan ring on the floor under the cursor.
- **Debug** (`src/debug/DebugPanel.js`, `src/debug/Stats.js`): lil-gui panel toggled with `` ` `` and an FPS / worst-frame / draw-call / triangle counter. Folders: Camera, Post, Time, Hero, Lighting, Voxel, Hotkeys. Hotkeys (only while debug is on): **T** cycles time scale 1 / 0.25 / 0.05, **O** orbit camera (returns to the fixed camera when toggled off), **F** photo mode (hides the hero, the reticle and the UI). All other spec §14 hotkeys are stubbed and log "not implemented yet" with the stage they arrive in.
- **UI** (`src/ui/UI.js`): only a small controls hint for now (`CONFIG.ui.showHint`).

### Files
`index.html`, `vite.config.js`, `package.json`, `.gitignore`, `CLAUDE.md`, `docs/GAME_SPEC.md`, `docs/PROGRESS.md`,
`src/main.js`, `src/config.js`,
`src/core/{Engine,CameraRig,GameTime,Input,Loop,PostFX,GradePass}.js`,
`src/world/{ArenaBounds,PlaceholderArena,Lighting}.js`,
`src/voxel/{VoxelBuilder,palettes,blockEdgeMaterial}.js`, `src/voxel/models/{PlaceholderHero,VoxelTest}.js`,
`src/entities/Hero.js`, `src/fx/MouseReticle.js`, `src/game/Game.js`, `src/ui/UI.js`, `src/debug/{DebugPanel,Stats}.js`
(empty `src/anim`, `src/combat`, `src/skills` hold `.gitkeep`).

### Key tunables (`src/config.js`)
| Path | Default | What |
|---|---|---|
| `CONFIG.camera.elevationDeg` / `yawDeg` / `fov` | 38 / 0 / 32 | Fixed camera pose |
| `CONFIG.camera.fitMargin` | 1.5 | m of extra radius kept in frame around the arena |
| `CONFIG.camera.headroomTop` | 0.2 | Fraction of frame height kept free above the arena |
| `CONFIG.camera.fitDepth` | 1.2 | m of foundation wall kept in frame below the rim |
| `CONFIG.post.bloom.{strength,radius,threshold}` | 0.6 / 0.35 / 0.92 | Bloom (threshold keeps it on emissives only) |
| `CONFIG.arena.seamIntensity` | 1.9 | Glow-line brightness |
| `CONFIG.lighting.moonIntensity` / `hemiIntensity` / `rimIntensity` | 3.6 / 2.8 / 1.6 | Light balance |
| `CONFIG.hero.{moveSpeed,accel,decel,turnRate}` | 6 / 42 / 55 / 16 | Movement feel |
| `CONFIG.arena.edgeDarken` / `edgeWidth` | 0.45 / 0.035 | Block-boundary shading on the floor/walls |

### Known issues / notes
- `PCFSoftShadowMap` has been removed from three.js 0.186 (it logs a warning and falls back). The renderer uses `PCFShadowMap` with `shadow.radius` for softness instead.
- Composer MSAA (4 samples) is used because the renderer's `antialias` flag doesn't apply to post-processing render targets.
- The moonlight comes from high on the right, slightly in front, so the hero and the front foundation are modelled. The visible moon (Stage 1) sits behind the arena. That's a deliberate cinematic cheat and can be changed with `CONFIG.lighting.moonDir`.
- Bloom spread depends on resolution. It looks a little stronger at 1080p than in small windows.
- Performance could only be checked with headless software rendering (SwiftShader), which is not representative. A frame has ~27 draw calls and ~6.5k triangles, so 60 fps on real hardware should be easy, but it has not been measured on a GPU yet.
- Grading happens in linear HDR before OutputPass, so `toneMapped: false` on emissive materials has no effect inside the composer. Emissives are simply HDR values that bloom and then get compressed by ACES in OutputPass.

### How to test
1. `npm install`, then `npm run dev` and open the URL. The console should show no errors.
2. The whole stepped arena is visible as a wide ellipse, with headroom above it and the foundation wall at the front. Resize the window to narrow / 4:3 / 16:10 / ultrawide: it refits every time.
3. Move with WASD (W = away from camera). Movement has smooth acceleration and stopping, the hero turns to face the mouse, slides along the rim without leaving the circle, and casts a shadow. A subtle cyan ring follows the mouse on the floor.
4. Press `` ` `` to open the debug panel + stats.
5. Post: try *Test flash*, *Test tint (Q slow-mo)*, *Test desaturate*, *Test chromatic*, *Test vignette* and *Test time-stop ring*. During the ring, everything inside turns gray except the hero, and the edge has a bright cyan line.
6. Camera: *Shake small / big*, *Zoom punch*. Each returns to the fixed pose. Edit elevation / yaw / fov / margin / headroom live. Press **O** to orbit, and **O** again to go back.
7. Time: drag *worldScale* and *heroScale* separately (the hero only follows heroScale, and the stats line shows both). Try *Hitstop 0.07 s / 0.5 s*, the *Slow-mo tween test*, and **T** to cycle 1 / 0.25 / 0.05.
8. Voxel: tick *Voxel test* to see the same totem at 0.12 / 0.18 / 0.25 m blocks. It shows the snapped off-grid slab, the jittered plate and emissive bloom in cyan, ember, magenta and yellow.
9. Press **F** for photo mode (hero, reticle and UI hidden).
10. Run `npm run build`, then open `dist/index.html` directly by double-clicking it.

---

## Stage 1 — Circular sakura shrine arena

### What was built
- **Map orchestrator** (`src/world/ArenaMap.js`): owns every map piece, runs them on the world clock, exposes `groundHeightAt(x, z)`, the petal API passthroughs, `countDrawCalls()` and rebuild hooks (trees, petals, mist). Replaces the Stage 0 `PlaceholderArena` (deleted). Map lighting now lives here (`game.lighting` still points to it).
- **Floor** (`src/world/ArenaFloor.js`): 1 m basalt tiles on a grid centered on the origin. Tiles whose **center lies inside r = 11** are the play floor (stepped pixel circle), with 2-block ring bands in alternating shades, per-tile jitter and per-tile height 4–18 mm (≤ 2 cm; thin lips between tiles). Tiles out to 13.2 m form the rim ledge. Tile borders are darkened procedurally (tile-UV shader, no textures). A few moss tiles toward the rim. Merged into one mesh.
- **Seams** (same file): thin emissive strips on the stepped edges of rings r = 6 and r = 10, plus 4 radial lines (3 → 11 m) along the axes. At rest they sit just at the bloom threshold. Every 8 s a soft pulse travels outward (shader on `worldTime`).
- **Crest**: an original 10 × 10 emblem of 0.5 m blocks (5 m across): a ring, a lightning bolt, and a blade passing behind the bolt, in dark stone. Four faint cyan ring blocks sit on the seam mesh, so they pulse too.
- **Rim** (`src/world/Rim.js`):
  - Foundation: a stepped wall of 1 m blocks following the pixel circle, 2 blocks deep plus an inset tier below, with moss blocks.
  - Balustrade: instanced posts (0.75 m) and rails (0.5 m, feet with openings), built from 0.25 m blocks on a ring at r = 11.8. The 4 gate gaps are at 45 / 135 / 225 / 315°.
  - Lanterns: 8 stone tōrō (13 boxes, 0.25 m blocks, 2 m tall), evenly spaced at 22.5° + k·45° so each gate sits between a pair. Fire-box flicker runs on the world clock.
  - Lights: 2 real point lights on the two front lanterns. All 8 lanterns get additive light-pool decals, clipped to the platform.
  - Embers: a pooled InstancedMesh (`src/world/Embers.js`).
- **Terrain** (`src/world/Terrain.js`): 1 m block columns around the back and sides (±106° from the back) on the floor's grid. It steps down away from the rim and ends in cliffs into the mist. It includes a flat torii landing, a cut for the steps, and a lower path that climbs in 1 m steps to the shrine terrace. Nothing sits in the front arc.
- **Structures** (`src/world/Structures.js`, models in `src/voxel/models/ShrineProps.js`):
  - Torii: 8 m wide, 6.5 m tall, 0.5 m blocks split per block for jitter, 8% darker worn blocks, black kasagi with upturned ends. Placed at x = 0.8, z = −14.4, slightly right to balance the hero tree.
  - Steps: 4 stone steps descending behind the torii.
  - Shrine hall: a stepped roof with warm windows on a terrace behind; the roof peeks over the kasagi between the canopies.
  - Pagoda: a distant five-tier silhouette with lit windows, placed at a screen position, on its own flat-topped far peak.
  - Torii, steps and shrine are merged into one opaque mesh and one emissive mesh.
- **Sakura** (`src/world/SakuraTree.js`), seeded generator:
  - Trunk: a stair-stepped leaning, tapering trunk of 0.25 m blocks with a root flare and a rock mound.
  - Branches: 2–4, depth 2.
  - Canopy: 3–5 noisy ellipsoid clusters on a 0.5 m grid with outliers and gaps; shell only (interior cubes are dropped).
  - Colors: more pale pink and white than saturated pink, whiter on top, per-cluster patches, 1–3 green cubes. Bark has lighter tops and some lighter/moss blocks.
  - Cube counts are about 160–570 per tree.
  - Sway: a vertex shader where each block moves rigidly with its pivot. It's stronger toward the canopy top and edges, phased by world position, and driven by `worldTime`. Matching depth material, so shadows sway too.
  - Placement: 9 trees, with the hero tree behind-left (205°) and none in the front arc.
- **Canopy check**: ray–cylinder test from the fixed camera against the play volume (r = 11 + 0.45 m, 0–2.6 m high). Trees are nudged outward at build time until no blossom cluster covers it. The debug toggle highlights offending clusters in red and re-checks on resize. Current result: 0 violations, 0 nudges.
- **Petals** (`src/world/Petals.js`): one InstancedMesh (one draw call) holding 800 falling petals, 260 floor-carpet petals and 900 static tree-carpet petals (layout under *Petal API* below).
  - Falling petals spawn inside canopies (weighted by cube count), or 18% upwind off-screen.
  - They drift with wind and gusts, flutter, tumble, get occasional lifts, land on the floor or terrain, rest 4–8 s, shrink out and recycle.
  - The floor carpet (movable, never fades) is denser toward the trees; there's a static carpet under the trees.
  - World clock throughout; no per-frame allocations; only the pool's matrix range is uploaded each frame.
- **Wind** (`src/world/Wind.js`): base direction and strength plus smooth gusts on the world clock. It feeds the petals, sway, mist and embers.
- **Sky** (`src/world/Sky.js`):
  - Gradient dome mapped onto the view elevations inside the frame (the camera looks down 38°, so the "sky" is a stage set).
  - Faint twinkling stars.
  - Pixel-art moon at a fixed screen position (behind-left), with a soft additive halo and 4 pixelated cloud wisps drifting across it.
- **Mountains** (`src/world/Mountains.js`): 3 layers of stepped karst cones (3 / 5 / 8 m blocks) rising out of the mist sea. Farther layers are lighter, bluer and hazier. Lower blocks fade toward the mist color; tops are moonlit.
- **Mist** (`src/world/Mist.js`): 4 transparent annuli with scrolling fbm noise (world clock) around the rim, below the platform edge, and as a far mist sea. The inner radii keep all of them off the play floor.
- **Lighting** (`src/world/Lighting.js`):
  - Moonlight azimuth follows the sky moon (behind-left) at 58° elevation, with PCF shadows fitted to a 20 m cylinder covering the arena and the nearest trees.
  - Violet-blue hemisphere fill and a subtle back rim light.
  - Bloom threshold is 1.0: seams, lanterns, visor and crest glow gently; lit blossoms and ivory don't.
- **Voxel builder additions** (`src/voxel/VoxelBuilder.js`):
  - `split` (per-block jitter on big boxes).
  - `faceShade` ({top, bottom, side}).
  - Per-box vertex `attributes` (used for the sway pivots).
  - `occluders` (hide faces without rendering).
  - Exported `QuadSink`, `makeRng` and `splitCells`.
  - `getBlockEdgeMaterial()` takes a grid offset.
- **Debug**:
  - Map folder with subfolders Wind, Petals, Trees, Lanterns, Seams and Atmosphere. It covers wind strength/direction, gust frequency, petal pool / spawn rate / carpet, impulse / sweep / vortex tests, tree seed and re-roll, canopy density, pink ↔ pale balance, sway, blossom lift, tree shadows, canopy check, lantern flicker / glow / point light / pools, seam intensity and pulse, mist density / layers / color, fog, moon screen position / size / brightness, and clouds.
  - Lighting folder: moon follows sky, moon elevation, hemisphere color.
  - Stats show env draw calls (and canopy violations when the check is on).
  - **F** photo mode now also hides the debug overlay. New hotkey **I** fires a petal impulse at the mouse.
- **Camera framing retuned** for the back composition: `headroomTop` 0.35, `fitDepth` 0.4, `bottomPad` 0, `fitMargin` 1.4.

### Arena helper API (`src/world/ArenaBounds.js`)
- `clampToArena(pos, radius = 0)`: clamps XZ in place so a body of `radius` stays inside `ARENA_RADIUS`. Returns true if it clamped.
- `isInsideArena(pos, radius = 0)`.
- `randomRimPoint(minDistFrom = null, minDist = 0, out?, rng?)`: a point just inside the rim, at least `minDist` from `minDistFrom`.
- `spawnGates`: 4 gates `{ name, angleDeg, dir, rim, spawn, inward, halfAngle }`. `name` is `frontRight` / `backRight` / `backLeft` / `frontLeft`; `spawn` is 0.9 m inside the play circle. Also `getSpawnGate(name)`, `isInGate(angleDeg)` and `arenaDir(angleDeg)`.
- `map.groundHeightAt(x, z)`: top of the platform or terrain, or `null` over the void.
- Angles are in degrees from +Z (front) toward +X (right).

### Petal API (`game.map.petals`, also passthroughs on `game.map`)
- `impulse(center, radius, strength)`: pushes airborne and resting petals outward, falling off from the center. Resting petals hop up (`petals.hop` share).
- `sweep(origin, dir, arcDeg, reach, strength, spin = 1)`: whip arcs. Hits petals within `reach` and ±arcDeg/2 of `dir`, pushing them tangentially in the sweep direction plus slightly outward.
- `vortex(center, radius, strength)`: swirl with an inward and upward pull.
- Layout: `[0, pool)` falling, `[pool, pool + floorCarpet)` floor carpet, then the static tree carpet. `build()` rebuilds it (pool = `CONFIG.quality.petalCount`).

### Decal height layers (for Stage 3)
- Tiles: 4–18 mm.
- Seams: top at 22 mm.
- Lantern pools: 30 mm.
- Gameplay decals should go at ≥ 40 mm.

### Performance
- Environment draw calls (fixed camera, all quality on): **31 main + 6 shadow = 37**. Total per frame including hero and post passes: about 59.
- About 157 k triangles per frame.
- Tree rebuild takes about 120 ms (debug only).

### Files
- New: `src/world/{ArenaMap,ArenaFloor,Rim,Embers,Terrain,Structures,SakuraTree,Petals,Wind,Sky,Mountains,Mist,mapMaterials}.js`, `src/voxel/models/ShrineProps.js`.
- Changed: `src/world/{ArenaBounds,Lighting}.js`, `src/voxel/{VoxelBuilder,blockEdgeMaterial}.js`, `src/core/Engine.js`, `src/game/Game.js`, `src/main.js`, `src/debug/DebugPanel.js`, `src/config.js`.
- Removed: `src/world/PlaceholderArena.js`.

### Key tunables (`src/config.js`)
| Path | Default | What |
|---|---|---|
| `CONFIG.camera.headroomTop` | 0.35 | Frame share above the arena for torii, shrine, trees and sky |
| `CONFIG.map.seams.rest` / `.pulse` / `.pulsePeriod` | 1.6 / 2.4 / 8 | Seam glow at rest, pulse boost, pulse interval |
| `CONFIG.map.trees.placement` | 9 entries | Angle, radius, height and hero flag per tree |
| `CONFIG.map.trees.seed` / `.density` / `.colorBalance` | 20240 / 1.0 / 0.62 | Tree shape, canopy size, pink ↔ pale |
| `CONFIG.map.wind.strength` / `.dirDeg` / `.gustStrength` | 1.1 / 250 / 0.9 | Wind for petals, sway, mist and embers |
| `CONFIG.map.petals.spawnRate` / `CONFIG.quality.petalCount` | 34 / 800 | Petal density |
| `CONFIG.map.lanterns.lightIntensity` / `.poolIntensity` / `.flickerAmount` | 5.5 / 0.32 / 0.22 | Warm light balance |
| `CONFIG.map.sky.moon.screen` | (−0.66, 0.8) | Moon NDC position (the light follows it) |
| `CONFIG.lighting.moonIntensity` / `.moonElevationDeg` / `.hemiIntensity` | 3.1 / 58 / 2.3 | Main light balance |
| `CONFIG.post.bloom.threshold` | 1.0 | Keeps blossoms and ivory below bloom |
| `CONFIG.quality.{treeShadows, petalCount, mistLayers}` | true / 800 / 4 | Quality toggles |

### Known issues / notes
- **60 fps is unverified on real hardware.** Checks ran on headless SwiftShader (1–15 fps). Draw calls and triangle counts are low, so it should be comfortable on a mid-range GPU.
- **The composition is tuned for the fixed camera.** Mountains, sky gradient, moon and pagoda are a stage set, so the orbit camera shows how it's built.
- **The pagoda is placed once at build time.** It uses the camera of the aspect ratio at load, so it shifts slightly after large resizes. The moon is re-placed on every resize.
- **Play tiles and the movement clamp don't line up exactly at the edge.** Play tiles are "center inside r = 11", as this stage asked. At a few stepped notches the colored play band ends slightly inside the 11 m movement circle. The floor continues seamlessly into the rim ledge (same height), so movement and decals stay flat.
- **Trees are merged into 4 meshes rather than 2 per tree.** The groups are near/far × bark/blossom, which saves draw calls; the near group carries the shadow toggle.
- **Three trees exceed the ~400-cube target.** The hero tree has about 570; `density` scales them down.
- **Front props barely touch characters at the edge.** Balustrade posts (0.75 m) can hide the very tip of a toe at the front edge; rails don't. The front lanterns just clear a character standing at the rim.
- **Fixed during tuning:** the ember InstancedMesh briefly showed its default identity matrices (a 1 m white cube at the origin) until the first world tick. Matrices are now written at construction.

### How to test
1. `npm run dev`. From the fixed camera, check the circular stone arena, cyan seams and crest, the balustrade with 4 gaps, 8 flickering lanterns with warm pools, the torii at the back with the shrine roof above it, sakura framing back and sides, the moon top-left, layered mountains, the pagoda top-right, and mist.
2. Wait about 8 s: a soft cyan pulse runs outward along the seams and crest blocks.
3. Watch the petals fall from the canopies and drift in from off-screen, then land, rest and fade.
4. Walk the hero around the edge: he stays clamped to the circle and nothing covers him or the floor.
5. `` ` `` → Map → Trees → *canopy check*: the stats show `canopy over play 0` and no red cubes.
6. Map → Petals → *Impulse at mouse* (or press **I** over the floor): the petals scatter and resettle. *Sweep* and *Vortex* test the other API calls.
7. Time → set *worldScale* to 0: petals hang in mid-air, and sway, mist, clouds, stars, seam pulse, embers and flicker all freeze while WASD still moves the hero.
8. Post → *Test time-stop ring*: the whole map goes gray and the hero stays in color.
9. Map → Trees → *Re-roll seed*, *canopy density*, *pink ↔ pale* rebuild the grove. *tree shadows* toggles the dappled rim shadows.
10. Map → Atmosphere: move the moon (the light direction follows) and change mist, fog and clouds.
11. Press **O** to orbit around the map, **O** again to return, and **F** for photo mode.
12. Resize to 4:3, ultrawide and portrait: the arena stays framed, with the torii and sky above it.
13. `npm run build`, then open `dist/index.html` directly.
