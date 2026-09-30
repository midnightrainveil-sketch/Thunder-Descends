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

---

## Stage 2 — Character models and animation

### What was built
- **Rig** (`src/anim/Rig.js`): rigid-skinned voxel characters.
  - A rig definition is `{ joints: [[name, parent, pivotGrid]], parts: [{ name, joint, boxes, glow?, local? }], glowGroups }`.
  - Every part is built with `buildPart()` (same 0.12 m grid, jitter and face culling as before). Each vertex carries `skinIndex` (its part's joint) with weight 1, plus an `aGlow` group index.
  - All parts merge into **one opaque + one emissive SkinnedMesh per character (2 draw calls)**. Joint pivots sit at the real joints; the rest pose is the modelling pose.
  - API: `bones[name]`, `boneList`, `index`, `rest`, `parts`, `setGlow(group, k)` (per-group emissive multiplier via a `uGlow[8]` uniform), `setFlash(k, color?)` (white hit flash mixed into the opaque shader), `setBoneVisible(name, on)` (hidden = scaled to ~0), `resetPose()`, `worldPosition(name, out)`, `setShadows()`, `dispose()`.
- **Animator** (`src/anim/Animator.js`):
  - Clips are keyframed joint rotations: `{ joint: [rx, ry, rz] }` in degrees (YXZ, relative to rest) and `'joint@': [x, y, z]` position offsets in m.
  - Keys use normalized time, and each key's `ease` (`linear / in / out / inOut / smooth / snap / hold`) shapes the segment arriving at it. A joint's track only uses the keys that mention it.
  - Looping or one-shot clips, with timed events (`hitStart`, `hitEnd`, `telegraph`, `fire`, …) fired on time crossing. Events at t = 0 fire on the first update after `play()`.
  - Layers: `addLayer(name, { mask, weight })`, with masks built by `animator.mask(['spine:0.7', 'chest', …])` and inherited by descendants.
    - `layer.play(name, { fade, speed, restart, onEnd })` crossfades.
    - `layer.setBlend({ idle, run }, { run: speed })` is a manual blend space.
    - `layer.fadeOut()` and `layer.weight` / `targetWeight` control layer weight.
  - Composite: the base layer replaces, and upper layers slerp over it by `weight × mask`. `animator.on(event | '*', fn)`, `animator.timeScale`, and `animator.addRotation(joint, rx, ry, rz)` for procedural post-offsets.
- **Hero model** (`src/voxel/models/HeroModel.js`): 137 boxes, 47 joints, 1548 triangles, about 20 blocks (2.4 m) tall with ~7-head proportions.
  - Gunmetal and ivory armor, dark knees and elbows, crimson belt and sash panels, and a kabuto with a forward-swept fin.
  - Jaw mask with a cyan visor row, 2-slab pauldrons, and back fins with cyan tips.
  - An oversized left claw gauntlet (~1.4×) with 3 fingers and a wrist chain housing.
  - A nodachi in the **right** hand: pommel, crimson hilt, square guard, and 8 two-block segments in alternating steel shades with a cyan edge row.
  - Hidden `bladeUlt_*` plates and crimson cores for the Stage 4 ult. Glow groups: `default`, `visor`, `core`, `blade`, `accent`, `ult`.
- **Enemy models** (`src/voxel/models/EnemyModels.js`): same block size, rust / black / bronze with orange eyes and seams. Glow groups: `default`, `eyes`, `seams`, `weapon`. The eyes are their own glow group so they can flare for telegraphs.
  - **Ronin**: lean, wide conical hat, one eye, short katana with an ember tip. 53 boxes, 22 joints.
  - **Teppo**: scope helmet (the lens is the eye), back ammo drum with an ember ring, long rifle with a `muzzle` node. 59 boxes, 23 joints.
  - **Tate**: about 1.05× height and 1.3× width, 3-wide legs, pauldrons, tower shield on a `shield` node with an ember seam, hammer. 62 boxes, 25 joints.
- **Clips** (`src/anim/clips/heroClips.js`, `enemyClips.js`, helpers in `poseUtils.js`: `mirrorPose`, `merge`, `pick`). Motion stays weighty: small anticipation, a fast strike and a longer settle.
  - Hero:
    - `idle`: breathing loop.
    - `run`: two steps per cycle, the sword trailing low, the claw arm swinging.
    - `attack1`: diagonal cut, high right → low left.
    - `attack2`: backhand horizontal cut, left → right.
    - `attack3`: heavy overhead cleave.
    - `hurt` and `death`.
  - Each attack goes guard → windup → mid → strike → follow → guard. `hitStart` / `hitEnd` come from `CONFIG.hero.anim.hitWindows`.
  - Enemies all get `idle`, `walk`, `attackWindup` (telegraph), `attackStrike` (hit window), `hurt` and `stunned`.
    - Teppo adds `aim` (telegraph) and `fire` (fire event, recoil).
    - Tate adds `block` and `slam` (0.9 s telegraph, hammer head lands on the floor).
    - Tate's shield counter-rotates against the arm pitch so it stays near vertical.
  - Arm and weapon angles for the attacks, the Teppo aim and the Tate hammer poses were **solved offline** against the real rig (coordinate descent on joint angles to hit a grip position + blade direction + scope-up). That's why some numbers look odd.
- **Hero** (`src/entities/Hero.js`, hero clock):
  - Layers: `base` (idle ↔ run blend, hurt/death), `upper` (attacks, masked to spine 0.7 / chest / head / shoulders / weapon, so he swings while running), and `overlay` (hurt flinch).
  - The legs follow the movement direction, and the upper body twists toward the aim, up to ±60° split over spine / chest / head. Past 110° he backpedals, with the run clip playing in reverse.
  - Procedural touches: breathing, forward lean and bank into turns, sash panels and pauldrons on damped springs so they lag.
  - Hold or click the left mouse for the 3-hit combo. Input is buffered and the combo resets after 0.9 s; there's no damage yet. Movement is ×0.45 while attacking.
  - The cyan **blade trail** (`src/fx/BladeTrail.js`) is an additive ribbon between the guard and the tip, live during hit windows. It's opted into the hero mask.
- **Enemy** (`src/entities/Enemy.js`, world clock):
  - Walks toward the hero with arrival braking, **stops at 2 m**, faces him, and keeps 1.3 m from other enemies. Separation can slide enemies around the hero but never push them inside 2 m.
  - The walk speed drives the walk clip rate.
  - `playAction('attack' | 'aimFire' | 'slam' | 'block' | 'stunned')` chains clips on the base layer; this is the Stage 3 AI hook.
  - `playHurt()` plays the overlay flinch plus an 80 ms white flash. The eyes flare on `telegraph`.
- **Debug**:
  - Keys **1/2/3** spawn Ronin / Teppo / Tate at a gate ≥ 5 m from the hero (otherwise a rim point) and they walk in. **K** removes all enemies. **M** opens the model viewer.
  - Hero folder: movement and animation tunables, attack speed, **Test claw** (the claw hand detaches, flies 6 m toward the aim with its fingers open, and returns), **Test blade split** (the 8 segments fan out along an arc and snap back with a blade-glow click-flash), play hurt/death, revive, ult plates, hit flash.
  - Enemies folder: spawn buttons, remove all, attack, Teppo aim → fire, Tate block / slam, stunned, hurt, flare eyes, stop distance.
  - **Model viewer** (`src/debug/ModelViewer.js`, **M**): shows one rig on the arena with the orbit camera. Pick the model and clip, then set speed, pause, scrub, joint pivot markers, and whether one-shots loop. Attacks play on the upper layer over idle.

### Joint names
- **Hero** (child ← parent):
  - Torso: `root`, `pelvis←root`, `spine←pelvis`, `chest←spine`, `head←chest`.
  - Sash panels: `sashFront`, `sashBack`, `sashR`, `sashL` ← pelvis.
  - Legs: `thighR/L←pelvis`, `shinR/L←thigh`, `footR/L←shin`.
  - Right arm: `shoulderR←chest`, `pauldronR←shoulderR`, `upperArmR←shoulderR`, `forearmR←upperArmR`, `handR←forearmR`, `weapon←handR`, `bladeRoot←weapon`, `bladeSeg_0…7←bladeRoot`, `bladeUlt_0…7←bladeSeg_i`.
  - Left arm: `shoulderL←chest`, `pauldronL←shoulderL`, `upperArmL←shoulderL`, `forearmL←upperArmL`, `chainAnchor←forearmL` (wrist, where the chain attaches), `clawHand←forearmL`, `clawFinger_0/1/2←clawHand` (finger 2 is the thumb).
- **Enemies** (shared humanoid): `root`, `pelvis`, `spine`, `chest`, `head`, `sashFront`, `sashBack`, `thighR/L`, `shinR/L`, `footR/L`, `shoulderR/L`, `upperArmR/L`, `forearmR/L`, `handR/L`, `weapon←handR`.
  - Teppo adds `muzzle←weapon`.
  - Tate adds `pauldronR/L←shoulder` and `shield←forearmL`.

### Part names (a part is a box list bound to one joint, with the joint in parentheses when it differs)
- **Hero**:
  - Body: `footR/L`, `shinR/L`, `thighR/L`, `pelvis`, `sashFront`, `sashBack`, `sashR`, `sashL`, `spine`, `chest` (with the core, glow `core`), `finTips(chest)`, `head`, `visor(head)` (glow `visor`), `pauldronR/L`.
  - Arms: `upperArmR/L`, `forearmR`, `handR`, `forearmL` (with the chain housing), `clawHand`, `clawFinger_0/1/2`.
  - Sword: `weapon` (pommel, hilt, guard), `bladeSeg_i`, `bladeEdge_i(bladeSeg_i)` (glow `blade`), `bladeUlt_i`, `bladeUltCore_i(bladeUlt_i)` (glow `ult`, hidden until the ult).
- **Enemies**: `footR/L`, `shinR/L`, `thighR/L`, `pelvis`, `sashFront`, `sashBack`, `spine`, `chest` (glow `seams`), `head` (with the eyes, glow `eyes`), `upperArmR/L`, `forearmR/L`, `handR/L`, `weapon` (glow `weapon`). Tate adds `pauldronR/L` and `shield` (glow `seams`).

### Files
- New:
  - `src/anim/{Rig,Animator}.js`, `src/anim/clips/{heroClips,enemyClips,poseUtils}.js`
  - `src/voxel/models/{HeroModel,EnemyModels}.js`
  - `src/entities/Enemy.js`, `src/fx/BladeTrail.js`, `src/debug/ModelViewer.js`
- Changed: `src/entities/Hero.js` (rewritten), `src/game/Game.js`, `src/debug/DebugPanel.js`, `src/voxel/palettes.js`, `src/config.js`, `docs/GAME_SPEC.md` (2 one-line edits: §5 upper body faces the aim; §12 rigid-skinned characters).
- Removed: `src/voxel/models/PlaceholderHero.js`.

### Key tunables (`src/config.js`)
| Path | Default | What |
|---|---|---|
| `CONFIG.hero.anim.attackDurations` / `.hitWindows` | 0.55, 0.55, 0.72 / [.36,.5] [.36,.5] [.5,.62] | Combo timing and normalized hit windows |
| `CONFIG.hero.anim.runDuration` / `.runSpeedRef` | 0.62 / 6 | Run cycle length and the speed at which it plays at 1× |
| `CONFIG.hero.anim.twistMaxDeg` / `.twistSplit` / `.backpedalDeg` | 60 / [.3,.5,.2] / 110 | Aim twist between legs and upper body |
| `CONFIG.hero.anim.{breathDeg, bankDeg}`, `CONFIG.hero.leanDeg` | 1.4 / 5 / 7 | Procedural breathing, banking and lean |
| `CONFIG.hero.anim.sashLag` / `.pauldronLag` | springs | Secondary motion |
| `CONFIG.hero.attackMoveMul` | 0.45 | Move speed while swinging |
| `CONFIG.hero.trail.{lifetime, intensity, opacity}` | 0.16 / 2.4 / 0.85 | Blade trail |
| `CONFIG.enemies.{ronin,teppo,tate}.speed` / `.walkAnimSpeedRef` | 3.2 / 2.8 / 2.2 | Walk speed and clip rate |
| `CONFIG.enemies.stopDistance` / `.separation` / `.accel` | 2 / 1.3 / 12 | Approach behaviour |
| `CONFIG.enemies.anim.*` | see file | Windup/strike/aim/fire/slam durations, eye flare, `shieldBrace` 0.85 |
| `CONFIG.debug.clawTest` / `.bladeSplitTest` | see file | Test timings and distances |

### Known issues / notes
- **Named nodes are joints (bones), not separate meshes.** Detaching the claw or splitting the blade means moving joints (the tests set joint world transforms). Stage 4 skills will do the same. The chain between the wrist and the claw isn't drawn yet; that's Stage 4.
- **Attack arcs are keyframed, not simulated.** Slerping between solved keys can take a slight dip on the backhand (attack 2 scoops ~45° down on the left before sweeping level). It reads fine at game-camera scale.
- **Enemy actions play full-body on the base layer.** They plant their feet to attack, and hurt is a full-body overlay. Only the hero has upper-body layering.
- **The Teppo aim pose needs the rifle roll constraint.** The solved hand angles look odd in isolation (`weapon: [74, 156, 86]`) but put the rifle level with the scope up and the left hand on the barrel clamp.
- **Performance:** each character is 2 draw calls, about 0.6–1.5 k triangles, and 22–47 bones. Only headless SwiftShader was available (1–20 fps), so 60 fps with a full wave is still unverified on a GPU.

### How to test
1. `npm run dev`. The new hero stands in the arena: sword low in the right hand, claw gauntlet on the left, idle breathing.
2. WASD: idle blends into the run cycle, and he leans and banks. Move the mouse around him: the upper body twists toward the aim while the legs keep running. Move away from the aim to backpedal.
3. Hold the left mouse: the diagonal / backhand / overhead combo loops with a cyan trail during each hit window, and he still moves (slower) while swinging. Release: the combo returns to step 1 after 0.9 s.
4. `` ` `` for debug, then **1 / 2 / 3**: a Ronin / Teppo / Tate enters from a gate, walks in, and stops 2 m from the hero facing him. Walk away and they follow. **K** removes them.
5. Enemies folder: *Attack (windup → strike)* (eyes flare, then the slash), *Teppo aim → fire*, *Tate block* / *Tate slam*, *Stunned*, *Hurt + hit flash*, *Flare eyes*.
6. Hero folder: *Test claw* and *Test blade split*, *Play hurt* / *Play death* / *Revive*, *Ult blade plates*, *Hit flash (80 ms)*.
7. **M** opens the model viewer. Model → hero / ronin / teppo / tate, pick any clip, use speed / pause / scrub, and tick *pivots* to see every joint (knees, elbows and wrists sit at the joints). **M** again returns to the game.
8. Post → *Test time-stop ring*: the hero and his trail stay in color, and the enemies turn gray.
9. Run `npm run build`, then open `dist/index.html` directly.

---

## Stage 3 — Combat, whip-crit passive, FX, enemy AI, waves and EXP

### What was built
- **Combat core** (`src/combat/`):
  - `Hitbox.js`: 2D floor-plane tests `hitCircle`, `hitSector` (angular slack from the target's radius), `hitRect`, `relativeYaw`, plus `AttackInstance` (each target is hit once per attack).
  - `Combat.js` routes all damage and hit feel through one place:
    - `heroHitsEnemy(enemy, { mult, crit, knockback, stun, from, hitstop, shake })` applies crits, ±10% damage jitter, the Tate frontal block and all hit feedback.
    - `enemyHitsHero(source, damage, knockback, from)` handles i-frames, god mode, knockback, a red screen flash, crimson numbers and death.
    - `killEnemy(enemy, pushDir)` spawns the shatter and EXP shards and calls `onKill`.
    - `slamImpact(center, radius)`.
  - **Tate block**: hits from within its frontal 120° do −80% unless it's stunned. Feedback is small orange "BLOCKED n" text, orange sparks and a shield-seam flash, with reduced knockback and no stun.
  - **Stun** interrupts actions and cancels the telegraph, and there's a short immunity after it ends. The combo finisher staggers for 0.35 s.
  - **Knockback** is a decaying velocity clamped to the arena.
  - **Enemies never overlap** each other or the hero: a hard positional resolve in `Game`, on top of soft separation steering.
- **Hero combat** (`src/entities/Hero.js`):
  - `hero.stats` holds `{ maxHp, hp, atk, critRate, critDamage, attackSpeed }`.
  - Every swing rolls crit when it starts. Damage lands between the clip's `hitStart` and `hitEnd` with a sector of 2.4 m / 120°, multiplied ×1.0 / 1.0 / 1.4 per step, plus a crescent slash arc per step. Clip speed = attack speed, so the hit windows scale with it.
  - Getting hit: flash, knockback, 0.4 s i-frames and a flinch.
  - Death: death clip, both clocks tween to 0.2× slow-mo, the screen desaturates, then after 1.4 s the **DEFEATED — Press Enter to retry** overlay shows run stats. Enter resets the run (`game.restart()`).
- **Whip strike** (`src/combat/WhipStrike.js`), the crit passive:
  - The 8 real blade segments detach. Each frame they're placed on a curved chain from the sword guard to a tip that sweeps 170° in 0.28 s. The reach shoots out to 5.5 m in the first 0.08 s.
  - Each chain point samples the tip's path with a delay that grows toward the hand, so every segment trails the next like a whip, with a travelling wave along it.
  - Segments grow ×2.2 into chunky plates while flying and the blade edge glows brighter.
  - Visuals: jagged cyan lightning between consecutive segments (re-rolled every frame), a bright tip ribbon, a faint 170° crescent along the reach, and tip sparks.
  - Retract in 0.15 s (ease-in back to the animated pose), then a snap click-flash (blade glow ×4 plus a small star).
  - Hit test: enemies within the current reach whose angle the tip swept this frame. Each hit does crit damage with 0.07 s hitstop, shake, a camera zoom punch, a big white-cyan crit number and a lightning bolt to the target.
  - Petals are swept along the arc. The next swing waits for the snap.
- **FX library** (`src/fx/`, all pooled and reusable, entry point `game.fx`):
  - `Particles` is two InstancedMesh cube pools (additive glow and lit solid), each particle on the world or hero clock. Emitters: `sparks` (velocity-stretched streaks), `hitStar`, `dust`, `debris` (bouncing), `embers`.
  - `SlashArcs`: crescent arcs built in the shader with radius, thickness, span, tilt, sweep direction, a bright head and fade.
  - `RibbonTrail` (generalized from `BladeTrail`): the hero's blade trail and the whip tip trail.
  - `Lightning`: camera-facing jagged bolts with a hot core and colored halo, flickering, fire-and-forget or following their ends.
  - `Decals`: floor telegraphs (circle / sector / rect) that fill over the windup, pulse near the end, flash when they resolve, and can be cancelled. They sit at y = 0.045.
  - `Shockwaves`: expanding floor rings plus the orange spawn beam.
  - `Shatter`: a dead enemy's voxel boxes become up to 100 tumbling, bouncing cubes that shrink away. Emissive boxes become embers.
  - `ExpShards`: cyan cubes pop out, then home in on the hero.
  - `DamageNumbers`: DOM, pooled. Normal is white, crits are bigger and white-cyan with a pop and jitter, hero damage is crimson, plus "BLOCKED" and "LEVEL UP" labels.
  - Hit flash: `rig.setFlash`, 80 ms white, kept just under the bloom threshold.
- **Enemy AI** (`src/entities/Enemy.js`, world clock): a state machine of approach → attack (windup telegraph → strike) → cooldown → approach, plus stunned. Facing locks during the windup (it tracks briefly first).
  - **Ronin**: closes to 1.4 m and circles while on cooldown. Within 1.9 m it winds up for 0.45 s with a sector decal, then slashes a 1.6 m / 100° sector with a lunge. Cooldown 1.4 s.
  - **Teppo**: keeps 6–8 m away (backs off, closes in, or strafes, and won't back into the rim). The aim is a 0.7 s telegraph line that tracks for the first 60%, then locks. It fires a 9 m/s bolt (`src/combat/Projectiles.js`) with a muzzle flash and ember trail. Cooldown 2.4 s.
  - **Tate**: advances with its shield up. Within 2.4 m it telegraphs a 2.2 m slam circle for 0.94 s, centered 0.9 m in front of it and tracking for the first 40%. The impact adds rings, dust, debris, shake and a petal impulse. Cooldown 2.6 s.
  - Eyes flare through the telegraph and dim when stunned.
- **Waves** (`src/game/Waves.js`):
  - Wave w has 3 + ⌊1.2w⌋ enemies, spawned one at a time while fewer than 2 are alive. Spawn telegraphs in flight count as alive.
  - Each spawn shows a 1 s orange beam and ring at a gate ≥ 5 m from the hero, or a rim point if no gate qualifies.
  - Type unlocks: Ronin from wave 1, Teppo from 2, Tate from 3, with weighted picks.
  - Scaling per wave: HP ×1.14^(w−1), damage ×1.07^(w−1), speed +1.5% per wave (max +30%).
  - After a clear: 2.5 s break, +20% HP, and a "WAVE N" banner.
  - Boss waves (5 / 10 / 15) are regular waves until the bosses arrive in Stage 5.
- **Progression** (`src/game/Progression.js`): EXP to next level = 40 + 25·(L−1). A level-up gives +8% ATK and +5% max HP, heals 25%, adds 1 pending upgrade (cards in Stage 5), and plays a burst: cyan rings, rising sparks, "LEVEL UP" text and the HUD level flashes.
- **HUD** (`src/ui/HUD.js`, top-left, text-first): HP bar, level and EXP bar, wave and enemies left, crit %, and pending upgrades, plus the centered wave banner and the death overlay. The debug stats counter moved to the bottom-left.
- **Debug**:
  - Hotkeys: **1/2/3** spawn with the telegraph, **K** kills all (shatter + EXP), **G** god mode, **N** next wave, **L** level up.
  - Hero folder: god mode, crit rate, level up, full heal, take 50 damage.
  - Enemies folder: kill all, remove all, *AI enabled*, *waves running*, next wave, stun all.
  - The model viewer now pauses the game clocks.

### API for later stages
- `game.combat.heroHitsEnemy(enemy, { mult, crit, knockback, stun, from, hitstop, shake })`, `enemyHitsHero(...)`, `killEnemy(...)`.
- `enemy.stun(s)`, `enemy.blocks(fromPos)`, `enemy.takeDamage(...)`. Enemies expose `position`, `radius`, `hp`, `state`.
- `game.fx.particles.*`, `.slashes.spawn`, `.lightning.bolt`, `.decals.show`, `.shock.ring` / `.beam`, `.shatter.burst`, `.exp.drop`, `.numbers.show`.
- `game.spawnEnemy(type, { wave, scale, instant })`, `game.killAll()`, `game.restart()`, `game.waves.skip()`, `game.progression.levelUp()`.

### Files
- New:
  - `src/combat/{Hitbox,Combat,WhipStrike,Projectiles}.js`
  - `src/fx/{FX,Particles,SlashArc,Lightning,Decals,Shockwave,Shatter,ExpShards,DamageNumbers}.js`
  - `src/game/{Waves,Progression}.js`, `src/ui/HUD.js`
- Changed:
  - `src/entities/{Hero,Enemy}.js`, `src/game/Game.js`, `src/main.js`, `src/config.js`
  - `src/fx/BladeTrail.js` (now `RibbonTrail` + `BladeTrail`), `src/anim/Rig.js` (softer flash)
  - `src/debug/{DebugPanel,ModelViewer,Stats}.js`, `src/ui/UI.js`
  - `docs/GAME_SPEC.md` (§8 EXP shards fly to the hero)

### Key tunables (`src/config.js`)
| Path | Default | What |
|---|---|---|
| `CONFIG.whip.{reach, arcDeg, sweep, extend, retract, lag}` | 5.5 / 170 / 0.28 / 0.08 / 0.15 / 0.055 | Whip shape and timing |
| `CONFIG.whip.{segScale, bladeGlow, linkWidth, linkIntensity, tipTrail}` | 2.2 / 2.2 / 0.13 / 4.5 / … | Whip look |
| `CONFIG.whip.{hitstop, shake, punch, knockback}` | 0.07 / 0.42 / 0.035 / 6 | Whip hit feel |
| `CONFIG.combat.{heroHitstop, heroShake, finisherShake, heroKnockback, comboStun}` | 0.035 / 0.14 / 0.22 / [2.2, 2.2, 4.5] / [0, 0, 0.35] | Normal hit feel |
| `CONFIG.combat.{hurtKnockback, hurtShake, deathSlowmo, deathOverlayDelay}` | 5 / 0.35 / 0.2 / 1.4 | Getting hit and death |
| `CONFIG.enemies.<type>.*` | per spec | HP, damage, speed, ranges, cooldowns, bolt, slam, block |
| `CONFIG.waves.*` / `CONFIG.progression.*` | per spec | Counts, scaling, breaks, unlocks, EXP curve |
| `CONFIG.fx.*` | pools | Pool sizes, decal height / color, shatter physics, EXP homing, numbers |

### Verification
- **Headless fixed-step simulation** of the real game loop with a bot that chases the nearest enemy and holds attack. 150 s reached wave 5 and level 5. Whip strikes were 76 of 151 attacks (≈ 50%), and the counts (28 kills, 177 hits) track the expected rates. No errors.
- **Forced death**: slow-mo, then the overlay, then Enter restarts at wave 1 with full HP and normal time scale.
- **Per-type AI traces**: every type attacks and lands hits. The Ronin backs off to its hold range after a lunge.

### Known issues / notes
- **60 fps with full FX is unverified on a GPU.** Only SwiftShader was available. Per frame there are about 14 new draw calls when all pools are active; most pools draw nothing when idle.
- **The whip is placed procedurally in world space**, locked to the aim at the swing's start, so turning mid-whip doesn't bend it.
- **The Teppo can be slippery** for a bot at 0.45× attack move speed. For a player, walking up to it without attacking catches it easily.
- **Upgrade cards, full HUD, title and pause screens and bosses** are Stage 5. Pending upgrades are only counted for now.

### How to test
1. `npm run dev`. "WAVE 1" appears and Ronin drop in through orange beams at the gates. Hold left click toward them.
2. About half of the swings become whip strikes: the blade flies apart into a lightning-linked chain sweeping 170° to 5.5 m, with a hitstop, shake and big crit numbers, then snaps back with a flash. Normal swings show a crescent and white numbers.
3. Enemy telegraphs:
   - Ronin: sector decal plus eye flare, then a slash with a lunge.
   - Teppo (wave 2+): keeps its distance, draws a red aim line, then fires an orange bolt you can sidestep.
   - Tate (wave 3+): hit it from the front for "BLOCKED". Get behind it, or stagger it with the combo finisher (and later Q/E). Its slam circle fills for 0.9 s.
4. Kills shatter into cubes, and the EXP cubes fly to you. Level-ups show "LEVEL UP" and the HUD counts pending upgrades.
5. Clear a wave to get the break, the heal and the next banner. Die to get slow-mo, then **DEFEATED**; press **Enter** to retry.
6. Debug (`` ` ``): **1/2/3** spawn, **K** kills all, **G** god mode, **N** next wave, **L** level up. The Hero folder has crit rate (1.0 = whip every swing), and the Enemies folder has AI on/off.
7. Run `npm run build`, then open `dist/index.html`.
