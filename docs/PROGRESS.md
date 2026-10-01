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

---

## Stage 4 — Skills: Thunderclaw, Shatter → Overdrive, Demontime

### What was built
- **Skill base** (`src/skills/Skill.js`, `SkillSystem.js`):
  - Each skill has a rank (1–4). Rank values live in `CONFIG.skills.*`, as a number or an array indexed by rank − 1.
  - Cooldowns tick on the hero clock × `cooldownRate` (×2 during the Demontime buff).
  - One skill at a time, no casting while dead or stunned. A basic attack can be cancelled into a skill once its hit is out; for a whip strike, after its sweep.
  - Skills steer the hero through `hero.control`: move / aim / attack locks, base-layer ownership, invulnerability, no knockback. `hero.releaseControl()` restores everything.
  - Input is read every frame in real time (`skills.handleInput`) so aiming works in slow-mo and hitstop. Updates run on the hero clock after the pose.
- **Q Thunderclaw** (`src/skills/Thunderclaw.js`):
  - **Aim**: world and hero tween to ×0.15 with a blue tint and slight desaturation. A dashed 9 m range ring and a 2.5 m target circle are clamped to range and arena. Click fires, right-click / Esc cancels with no cooldown, and it auto-fires after 2.5 real seconds.
  - **Launch** (0.18 s): the `clawHand` bone is placed in world space and flies out with its fingers open. The instanced block **chain** (`src/fx/Chain.js`, alternating links, sag, faint cyan glow) runs from `chainAnchor`, with lightning crawling along it.
  - **Grab** (0.2 s): up to 3 nearest enemies in the radius are yanked into a cluster, take 1.2×ATK (unblockable) and are stunned 1.5 s, with lightning from the claw to each.
  - **Pull** (0.25 s): the hero is dragged to the cluster, invulnerable, in a dash pose with afterimages. Landing is a 2 m impact for 0.8×ATK with ring, dust, shake and a petal burst.
  - **Reattach** (0.12 s): the hand flies back with a spark.
  - With no targets it's a dash to the cursor.
- **E Shatter → Overdrive** (`src/skills/Shatter.js`):
  - **Shatter**: 0.12 s windup, then a one-handed lunge thrust (1.4 m lunge) with a 3.5 × 1.2 m rectangle (plus the lunge) for 1.8×ATK and a 1 s stun. The **spear burst** (`Shockwaves.spear`) is a tapered, hot-cored streak, plus a white core, a tip ring and sparks.
  - **On a hit, Overdrive (1 s)**:
    - A two-handed stance clip alternates cuts. Every 0.08 s a 120° / 3.2 m sector deals 0.45×ATK, and each slash rolls crit.
    - Each slash spawns a crescent at a random tilt. Afterimages trail every 0.05 s and the hero glows ×1.8.
    - The hero drifts toward the aim at 1.5 m/s with no knockback, and the aim follows the mouse.
    - It ends with a **heavier final slash**: 150° wide, 1.2×ATK, with hitstop, shake, zoom punch and a petal sweep.
  - **On a miss**: normal recovery.
- **R Demontime** (`src/skills/Demontime.js`), a 2.2 s cast. The hero is invulnerable, input is locked and hitstop is locked out.
  - **0–0.4 s**: kneel and plant the sword on a slant. The world clock tweens to 0 (enemies, projectiles, particles, petals, trees and lanterns freeze). The GradePass **time-stop ring** expands from the sword to 45 m, turning everything grayscale; the hero and his FX stay in color via the existing hero mask.
  - **0.4–1.6 s**: about 380 per second tiny cyan **nanobots** (`src/fx/Nanobots.js`, Bézier paths to targets in bone space) stream from both arms into the blade. The 8 `bladeUlt` plates pop in one by one with crimson sparks.
  - **1.6–2.0 s**: the ring collapses back into the sword and world time tweens back to 1.
  - **2.0–2.2 s**: the sword comes up. Pulse: 5 m, 2.0×ATK, unblockable, with 3 shockwave rings, cyan and crimson sparks, dust, a big petal impulse, a screen flash, shake and a zoom punch.
  - **Buff (7 s)**:
    - The blade's cross-section goes ×1.6 with the ult plates shown, a brighter edge and a pulsing crimson core.
    - Attack speed ×1.6, cooldowns ×2, crit 100% (every basic attack is a whip).
    - A cyan and crimson crackling aura: lightning plus embers.
  - At the end the plates **dissolve** into cyan and crimson cubes.
- **New FX**:
  - `Chain`: instanced block links.
  - `Afterimages`: a pool of 8 ghost hero rigs with a skinned additive cyan material.
  - `Nanobots`.
  - `AimRings`: dashed range ring, target circle with crosshair.
  - `Shockwaves.spear`.
  - `RibbonTrail` / `SlashArcs` / `Lightning` are reused.
  - All hero skill FX are opted into the hero mask.
- **Skill clips** (`src/anim/clips/skillClips.js`): `clawThrow`, `clawDash`, `shatterWindup`, `shatterThrust`, `overdrive` (loop), `overdriveFinal`, `demonKneel`, `demonRise`. Arm and weapon angles were solved offline like the attacks, including two-handed poses (claw on the hilt).
- **Time safety** (`src/core/GameTime.js`):
  - Hitstop never stacks: an active freeze keeps the longer duration, capped at 0.12 s.
  - A new hitstop can't start within 0.05 real seconds of the last one ending, so Overdrive can't chain into a long freeze.
  - `realDt` is clamped, so there's no catch-up after a freeze or slow-mo. Scale tweens run in real time.
  - `time.resetScales()` clears freezes, tweens and the lock.
- **Death mid-skill**: `game._onHeroDeath()` calls `skills.reset()`. That cancels the active skill, ends the buff (plates hidden, blade restored), resets time / tint / saturation / ring, and hides the chain, aim rings and nanobots; the claw and segments go back to their animated pose. Then the death slow-mo starts. Restart also resets cooldowns.
- **HUD**: a `SKILL` row shows Q / E / R state: ready, remaining seconds, aiming / OVERDRIVE / casting, or the buff timer.
- **Debug**:
  - **C** resets cooldowns.
  - Skills folder: reset cooldowns, rank per skill (1–4), Q aim time scale, E slash interval, R ring max, R buff now / end buff.
  - The Hotkeys help lists Q / E / R / C.

### Files
- New:
  - `src/skills/{Skill,SkillSystem,Thunderclaw,Shatter,Demontime}.js`
  - `src/anim/clips/skillClips.js`
  - `src/fx/{Chain,Afterimages,Nanobots,AimRings}.js`
- Changed:
  - `src/entities/Hero.js`: control flags, buffs, `critChance`, blade thickness / glow baselines, `placeBoneWorld`, cancel rules.
  - `src/combat/{Combat,WhipStrike}.js`: `unblockable`, invulnerability, blade thickness during the whip.
  - `src/core/GameTime.js`, `src/fx/{FX,Shockwave}.js`, `src/game/Game.js`, `src/ui/HUD.js`, `src/debug/DebugPanel.js`, `src/anim/clips/heroClips.js`, `src/config.js`.
  - `docs/GAME_SPEC.md`: §7 casting rules, heavier Overdrive final slash.

### Key tunables (`CONFIG.skills`)
| Path | Default | What |
|---|---|---|
| `thunderclaw.{cooldown, range, radius, maxTargets}` | 6 / 9 / 2.5 / 3 | Per rank |
| `thunderclaw.{aimScale, aimTimeout, aimTintStrength}` | 0.15 / 2.5 / 0.5 | Aiming |
| `thunderclaw.{launch, grab, pull, reattach}` | 0.18 / 0.2 / 0.25 / 0.12 | Phase timings |
| `thunderclaw.{grabMult, grabStun, landMult, landRadius}` | 1.2 / 1.5 / 0.8 / 2 | Damage |
| `thunderclaw.{linkSize, linkSpacing, sag}` | … | Chain look |
| `shatter.{cooldown, windup, length, width, mult, stun, lunge}` | 10 / 0.12 / 3.5 / 1.2 / 1.8 / 1 / 1.4 | Thrust |
| `shatter.{overdrive, slashEvery, slashRange, slashArcDeg, slashMult, finalMult, drift}` | 1 / 0.08 / 3.2 / 120 / 0.45 / 1.2 / 1.5 | Overdrive |
| `demontime.{cooldown, cast, freezeAt, nanoEnd, restoreAt, ringMax}` | 30 / 2.2 / 0.4 / 1.6 / 2.0 / 45 | Cast timeline |
| `demontime.{buff, pulseRadius, pulseMult, attackSpeed, cooldownRate, bladeThick}` | 7 / 5 / 2 / 1.6 / 2 / 1.6 | Buff and pulse |
| `demontime.{nanobots, nanoRate, nanoFlight}` | 420 / 380 / [0.28, 0.5] | Nanobot stream |
| `time.{hitstopMax, hitstopGap}` | 0.12 / 0.05 | Anti-stacking |

### Verification
- **Fixed-step skill tests** through the real loop:
  - **Q aim** sets both clocks to 0.15 and shows the rings. The fire grabs 3 enemies (a Tate included, unblockable) into a 1.9 m cluster, all stunned. The hero is invulnerable during the pull and lands 1.1 m short.
  - **Q afterwards**: the claw is back at its rest offset (0), the chain is hidden, cooldown ticking. Cancel leaves no cooldown and time / tint restored. The timeout auto-fires and dashes to the cursor with no targets.
  - **E hit** gives Overdrive with 17 hits; **E miss** recovers with no Overdrive.
  - **R**: world 0, hero 1, ring on and hitstop locked at 0.5 s; nanobots and plates arrive; world 1 and ring off by 2.2 s. The pulse hits for about 2×ATK and the buff applies ×1.6 attack speed, 100% crit and ×2 cooldowns. After 7 s the buff ends and the plates hide.
  - **Death mid-R**: ring off, lock off, plates and nanobots cleared, death slow-mo applied. Restart gives time 1 and cooldowns 0.
- **120 s bot run** casting Q, E and R whenever possible (10 / 11 / 5 casts) through waves 1–5: no stuck time scale, no stuck control locks, no errors.
- Game-camera frames checked for Q aim, chain, pull afterimages, the spear, Overdrive, the Demontime grayscale ring with the hero in color, nanobots, the pulse and the buff aura.

### Known issues / notes
- **The chain doesn't avoid obstacles** and links can clip through enemies at the grab point. That's fine at game scale.
- **Cancelling Q aim with Esc** will also be the pause key in Stage 5; Esc cancelling aim first is already the spec's behaviour.
- **The Demontime ring expands to 45 m in 0.4 s**, so the gray wave crosses the screen in about 0.3 s. `ringMax` / `freezeAt` tune the speed.
- **Rank-up effects exist in config**, including rank IV extras such as Overdrive chain lightning and buff extension on kills, and can be set from the Skills debug folder; the cards that raise ranks arrive in Stage 5.
- **60 fps with all skill FX is unverified on a GPU.** The heaviest moment is Demontime: 8 hidden afterimage rigs cost nothing when invisible, and nanobots are 1 draw call.

### How to test
1. `npm run dev` and start fighting. Press **Q**: time slows and turns blue. Move the mouse (the circle clamps to 9 m and the arena), then click. The claw flies out on a chain, yanks nearby enemies together, and drags you in. Right-click or Esc cancels; waiting 2.5 s auto-fires.
2. Press **E** next to an enemy: a lunge thrust with a spear burst, then 1 s of rapid two-handed slashes with afterimages, ending in a big final cut. E into empty space is just the thrust.
3. Press **R**: the hero kneels and plants the sword, the gray ring washes over everything and freezes it (watch the petals hang), cyan cubes stream into the sword and crimson plates assemble, then color returns and the release pulse knocks enemies back. For 7 s every swing is a whip, attacks are faster and the aura crackles. Then the plates dissolve.
4. The HUD `SKILL` row shows cooldowns; they tick twice as fast during the buff.
5. Cancel a swing into a skill: E right after a hit lands works; E mid-windup doesn't.
6. Debug: **C** resets cooldowns. The Skills folder has ranks and *R: buff now*. Die during R (turn off god mode, set HP low) to check that time and color come back.
7. Run `npm run build`, then open `dist/index.html`.

---

## Stage 5 — Bosses, level-up cards, HUD and menus (final)

### What was built
- **Boss base** (`src/entities/bosses/Boss.js`). It has the same interface as `Enemy`, so combat, hero attacks and skills work unchanged.
  - Big HP, no knockback.
  - Reduced stuns: Thunderclaw 0.6 s, Shatter 0.4 s. Other stuns such as the combo finisher are ignored; hits carry a `skill` tag so the boss can tell which applies.
  - Bosses are never yanked by Q; they take the damage and the hero still lands in front of them.
  - Attack picker: weighted random, never the same attack 3 times in a row.
  - Every attack gets a floor decal telegraph plus a pose and an eye/glow tell. Stuns and death cancel pending decals.
  - **Intro**: the Juggernaut and Kitsune drop in; the Raiju rises out of the mist. Invulnerable during it. Landing brings shake, rings, dust and debris, a petal burst and a red name banner.
  - **Death**: slow-mo (×0.3), explosions every 0.22 s for 1.6 s, then `Combat.killEnemy` does a big shatter (pool raised to 260 cubes), rings and an EXP burst in several drops.
  - **Enrage** below 50%: ×1.3 speed (timers and animation) and an "enraged" banner.
- **Oni Juggernaut** (`Juggernaut.js`, wave 5). 106 boxes at 0.18 m, 5.8 m tall: horns, tusks, ember furnace-grill chest, spiked club.
  - **Triple slam**: three 2.2 m circles in sequence toward the hero at 2.4 / 4.6 / 6.8 m.
  - **Charge**: a red lane to the rim, then 15 m/s. It crashes into the balustrade with debris and shake and is stunned 1.2 s.
  - **Stomp**: a 4.5 m ring.
  - **Enrage**: the chest glows ×2.6.
- **Kage Kitsune** (`Kitsune.js`, wave 10). 102 boxes at 0.12 m: fox mask, twin magenta blades, 3 six-link block-chain tails swaying procedurally.
  - **Blink**: a 0.5 s magenta flash at a point behind the hero, then it teleports and slashes a 150° sector.
  - **Triple dash-slash**: 3 zig-zag lane decals shown up front, then 26 m/s dashes.
  - **Tail spike fan**: the tails rise over a 90° sector telegraph, then 11 spike projectiles fly out.
  - **Enrage**: 2 shadow clones (translucent, die in one hit, half damage, blink and dash only). They're killed when the boss dies.
- **Raiju Serpent** (`Raiju.js`, wave 15). 116 boxes at 0.18 m: a head with horns, mane, whiskers and a glowing throat, plus 16 segments.
  - Bones are placed in world space. The segments follow the head's recorded path at 0.95 m spacing.
  - Movement: orbits just outside the rim at 2–4 m height, sometimes crossing over the arena in a figure-8.
  - **Hitboxes**: the head is the boss object (×1.5 damage). Every segment is a `SegmentProxy` in `game.enemies` that shares the boss's HP; `AttackInstance` keys hits by owner, so each attack counts once.
  - **Breath beam**: hovers, telegraphs a sector, then a lightning breath sweeps 70° across it with damage ticks.
  - **Lightning pillars**: 5–8 circles (8–11 when enraged).
  - **Dive**: a lane across the arena through the hero.
  - Defeating it shows **Demo clear**.
- **Waves**: 5 / 10 / 15 are boss waves (the boss alone, after a short beat). Endless mode repeats Juggernaut → Kitsune → Raiju every 5 waves with +60% HP per loop. The wave 15 clear goes to the Demo clear screen (after the shatter plays out); Continue resumes at wave 16.
- **Level-up cards** (`src/game/Upgrades.js`, `src/ui/Screens.js`). The game pauses about 0.7 s after a level-up.
  - Pool: Thunderclaw / Shatter / Demontime II–IV, Whip-sword passive II–IV (crit damage +30%, whip reach +1.5 m, crits heal 1%), and Power / Vitality / Swiftness (ATK +10%, max HP +12%, attack speed +8%, each up to 5×). Maxed options are excluded.
  - 3 cards: dark panel, cyan border, inline SVG icon, title, one-line effect, and rank pips showing current and next.
  - Click or press 1 / 2 / 3. Multiple level-ups queue.
  - Rank effects come from the Stage 4 rank arrays; Thunderclaw rank III now gives −1 s cooldown, per spec. Thunderclaw IV (+30% damage while stunned) and passive IV are wired into `Combat`.
- **HUD** (`src/ui/HUD.js`, replacing the text HUD; icons in `src/ui/icons.js`):
  - Top-left: SVG portrait (kabuto, visor), 12-segment HP bar, level badge, EXP bar.
  - Top-center: wave counter plus enemies left, or the boss name. The **boss bar** has a lag bar and turns red when enraged.
  - Bottom-center **skill bar**: LMB, Q, E, R with icons, key labels, a conic cooldown sweep with seconds, rank pips and a ready glow. R shows a crimson buff-timer ring.
  - Bottom-left: passive icon with crit %.
  - Wave, boss and enrage banners.
  - Panels use the spec style: indigo at 75%, clip-path cut corners, 1 px cyan edges, Chakra Petch / Silkscreen. The debug stats moved to the bottom-left above the crit panel.
- **Screens and modes** (`Game.mode`: title → play ⇄ paused / cards → over | clear):
  - **Title**: "KUROGANE — Thunder descends" over the live arena with controls. Click or Enter starts.
  - **Pause** (Esc / P; Esc cancels Q aim first): resume, restart, and a screen-shake toggle.
  - **Game over**: wave, level, kills, whip strikes, time. Enter or the button retries.
  - **Demo clear**: stats plus Continue (endless) / Restart.
  - Menus pause the clocks, and the hero gets a no-input stub outside play.
- **Polish**:
  - Camera shake is capped at 0.5 trauma per call and 0.75 total, and can be toggled off.
  - Full-screen flashes are capped at 0.45.
  - Telegraph decals render last among the effects (renderOrder 9, polygon offset).
  - Boss hit flash is softer (×0.7).
  - Banners clear when a menu opens.
  - A new run resets skill ranks, passive and stat cards.
- **README.md**: controls, `npm run dev`, `npm run build`.
- **Debug**: **4 / 5 / 6** spawn the Juggernaut / Kitsune / Raiju. Debug keys are off in menus (digits pick cards).

### Files
- New:
  - `src/entities/bosses/{Boss,Juggernaut,Kitsune,Raiju}.js`, `src/voxel/models/BossModels.js`, `src/anim/clips/bossClips.js`
  - `src/game/Upgrades.js`, `src/ui/{Screens,icons}.js`, `README.md`
- Changed:
  - `src/ui/HUD.js` (rewritten), `src/game/{Game,Waves}.js`
  - `src/combat/{Combat,Hitbox,Projectiles,WhipStrike}.js`
  - `src/skills/{Thunderclaw,Shatter,Demontime}.js`, `src/entities/{Hero,Enemy}.js`
  - `src/core/{CameraRig,PostFX}.js`, `src/fx/Decals.js`, `src/anim/Rig.js`, `src/voxel/palettes.js`
  - `src/debug/{DebugPanel,Stats}.js`, `src/config.js`
  - `docs/GAME_SPEC.md` (§11 screens)

### Key tunables
| Path | What |
|---|---|
| `CONFIG.bosses.{stunQ, stunE, introDrop, introHold, deathTime, deathSlowmo, enrageAt, loopHp, recover}` | Boss base |
| `CONFIG.bosses.juggernaut.{hp, speed, slam, charge, stomp, enrage, weights}` | Juggernaut |
| `CONFIG.bosses.kitsune.{hp, speed, blink, dash, fan, enrage, weights, tailSway}` | Kitsune |
| `CONFIG.bosses.raiju.{hp, segments, spacing, headMult, orbitRadius, height, beam, pillars, dive, enrage}` | Raiju |
| `CONFIG.cards.*` | Stat card values and passive effects |
| `CONFIG.ui.{cardDelay, hpSegments, flashMax}` | Menus and HUD |
| `CONFIG.camera.shake.{maxTrauma, perHitCap, enabled}` | Shake polish |

### Verification
- **Boss fights** (fixed-step bot that chases, attacks and uses skills, god mode):
  - Juggernaut: all 3 attacks, enraged at 14 s, killed at 35 s.
  - Kitsune: all 3 attacks plus clones, enraged at 26 s, killed at 50 s, clones cleaned up.
  - Raiju: all 3 attacks, enraged at 36 s, killed at 78 s.
  - Afterwards: time scale back to 1, the boss and proxies removed, shatter cubes flying.
- **Full run, title → Demo clear**: title click, waves 1–15 with all three bosses, 11 cards picked through the real UI flow, level 12, Demo clear at about 12½ minutes of game time. No errors.
- **Without god mode**: the non-dodging bot dies around waves 8–9, and the retry flow works. That run found and fixed skill ranks carrying over into a retry.
- **The built `dist/index.html`** loads from `file://`, shows the title, and click-to-start brings up the HUD.
- Screenshots checked: title, HUD with a boss bar (Raiju), each boss in the arena, a boss close-up, level-up cards, pause, demo clear.

### Known issues / notes
- **60 fps is still unverified on a GPU**, as in every stage; only headless SwiftShader was available. The heaviest case is the Raiju fight: 1 rig of 19 bones, beam lightning, pillars.
- **The Raiju's segments are hittable in 2D** (floor-plane projections at 2–4 m height), matching the rest of the game's XZ hitboxes.
- **The boss intro** doesn't lock the hero; he can reposition while the boss lands.
- **Fairness tuning is based on bot runs**; the attack damages and telegraph times in `CONFIG.bosses` are the knobs.

### How to test
1. Run `npm run dev` (or open the built `dist/index.html`). The title screen shows; click to start.
2. Fight waves 1–4 and level up: the game pauses on 3 cards; pick with a click or 1 / 2 / 3.
3. Wave 5 brings the Oni Juggernaut: dodge the three slam circles, stand clear of the charge lane (it stuns itself on the rim), and step out of the stomp ring.
4. Wave 10 brings the Kage Kitsune: watch for the magenta flash behind you, the three dash lanes, and the spike fan. Below half HP, two shadow clones appear.
5. Wave 15 brings the Raiju Serpent: hit any segment. Dodge the breath sweep, the pillar circles and the dive lane. Defeating it shows Demo clear; Continue goes endless.
6. Esc / P pauses (with the screen-shake toggle). On defeat, press Enter to retry.
7. Debug shortcuts: `` ` `` opens the panel. **4 / 5 / 6** spawn bosses directly, **N** skips waves, **L** levels up, **G** is god mode.
8. Run `npm run build`: it produces a single playable `dist/index.html`.

---

## Final — character redesign and release package

### Hero redesign (per the character sheet)
- `src/voxel/models/HeroModel.js` was rebuilt on the **same joints and pivots**, so every animation, solved pose, whip, claw, blade split and ult plate still works.
- New look:
  - Navy armor (`navy` / `navyDark` / `navyLight`) with saturated tan-gold trim (`gold` / `goldDark`).
  - Large gold crescent horns, gold side flaps, cyan eyes and a crest jewel.
  - A glowing cyan V chest core.
  - Big layered pauldrons with gold hems, rising gold-tipped feather plates and a gold emblem.
  - Two tall back fins with glowing cyan edges, above the head.
  - A long narrow crimson sash under a navy front panel with a gold V, and a red back sash.
  - Gold knee guards, toe caps and bracers; red ankle bands.
  - Cyan light strips on the shins, thighs and forearms.
  - A gray claw gauntlet (`claw` / `clawDark`) with hooked tips; a gold guard and pommel on the nodachi.
- 216 boxes, 47 joints, about 2.3 k triangles, still 2 draw calls.
- Accent glow was toned down so the silhouette reads.
- The spec §5 design line was updated to match.

### Release package
- `npm run package` builds the game and writes `release/KUROGANE-1.0.0.zip` (about 244 KB) with a dependency-free zip writer (`scripts/package.mjs`):
  - `index.html`: the whole game, a single file.
  - `play-windows.bat`: CRLF, opens the game in the default browser.
  - `play-linux.sh`: executable bit kept in the zip; uses `xdg-open`, or falls back to Chrome / Chromium / Firefox.
  - `README.txt`: how to play and the controls.
- Verified: the zip checks clean, file modes are kept, the extracted `index.html` runs from `file://` with no errors, and `sh -n play-linux.sh` passes.
- The skill regression tests pass with the new model.

---

## Fixes — black screen, movement facing

- **Black screen while moving (sometimes).**
  - Cause: hidden bones (the Demontime blade plates) were collapsed to scale 1e-4, not 0. Their microscopic triangles on the swinging sword could occasionally cover a pixel. Flat shading derives normals from screen-space derivatives, which are zero there, so the pixel shaded as NaN, and the bloom blur spread that NaN over the whole frame.
  - Fixes:
    - `Rig.setBoneVisible(false)` now uses exactly zero scale; zero-area triangles are never rasterized.
    - A sanitize pass (`PostFX`, RenderPass → sanitize → bloom) replaces any NaN / Inf pixel and clamps HDR to [0, 64], a safety net for any GPU.
- **The hero didn't face his movement.** He now faces the WASD direction (screen-relative under the fixed camera: A = screen-left, D = screen-right, W = up, S = down). He turns toward the mouse only while attacking, whipping or using a skill, and keeps his last facing when idle. The spec §5 controls line was updated.
- Verified with fixed-step tests: A / D / W / S / W+A face −90° / 90° / 180° / 0° / −135°, an attack turns toward the mouse, and releasing it returns to the movement facing. The skill regression passes.

---

## Third-person follow camera

- **The camera is unlocked and follows the hero's back** (`CameraRig` follow pose, tunables in `CONFIG.camera.follow`).
  - Boom 7.5 m behind a pivot 2.5 m above his feet, right-shoulder offset 0.85 m, FOV 56°, starting 20° down.
  - The mouse turns it (pointer lock; pitch −8°…62°); ← → turn it without a mouse.
  - The pivot follows him with exponential smoothing.
  - The boom pulls in so the camera stays inside 12.1 m: past the balustrade, short of the lanterns.
  - Recenter: when the mouse has been idle for 0.9 s and he runs within 40° of the view direction, the camera eases back behind his back (diagonals don't spiral).
- **Controls follow the camera.**
  - WASD is camera-relative, and the hero still faces where he moves.
  - Attacks and skills aim through the screen center: `Input.update` with `centerAim` keeps the ground point 1.2–13 m ahead, so looking at the sky still aims forward.
  - The ground reticle marks the aim point; Thunderclaw, the combo and the whip use it unchanged.
- **Fixed camera kept.**
  - The fixed cinematic pose still frames the title screen, and the run glides from it into the follow camera (0.7 s).
  - V switches between the two during play; the fixed camera keeps the old controls.
  - The map composition (moon, pagoda, canopy check) is laid out against `rig.compositionCamera`, the fixed pose, so the world is unchanged.
- **Pointer lock.**
  - It is grabbed when a run starts or resumes, or when you click the game.
  - It is released for menus, cards, game over, the debug panel (`` ` ``), the orbit camera and the model viewer.
  - Losing it mid-run (Esc, alt-tab) pauses; the Esc that broke the lock doesn't also resume.
- **Shake and punch.** They play on top of either pose; the shake offset scales down with the shorter follow distance.
- **Debug.** The Camera folder has a Follow ⇄ fixed toggle plus FOV, distance, height, shoulder, sensitivity, invert Y, recenter and max radius.
- **Verified** with fixed-step tests (60 Hz, render skipped between samples):
  - W / A / D / S face 180° / −90° / 90° / 0° relative to a camera looking −Z.
  - Mouse look turns the camera, and W then runs the new way.
  - Arrow keys turn it. The rim run keeps the camera inside the radius.
  - Attack, Q aim and fire, R and E work.
  - V → fixed → A faces screen-left; V back snaps the camera behind him.
  - Esc pauses. No errors.

---

## Waves boss/basic/boss/basic/boss, dash, harder bosses

- **Wave order** (`Waves.bossFor`, `CONFIG.waves.bossEvery / bossOrder / demoWave`):
  - Wave 1 Juggernaut, 2 basic, 3 Kitsune, 4 basic, 5 Raiju → Demo clear.
  - Endless keeps alternating; bosses repeat with +60% HP and +25% damage per loop.
- **Basic waves** are fewer but meaner. Each is scaled to level `1 + 3·(w−1)` (wave 2 → L4, wave 4 → L10) with the old per-wave curves:
  - 6, then 10 enemies, up to 3 alive at once.
  - All types appear from wave 2.
  - EXP +15% per level.
- **Healing between waves:** 20% after a basic wave, 40% after a boss.
- **Bosses are harder** (`CONFIG.bosses`):
  - HP ×1.15 and damage ×1.6. Every hit on the hero goes through `Boss.hitHero`, and Kitsune's spikes are scaled too.
  - Tempo ×1.15: faster movement, telegraphs and attack timing, with enrage multiplying on top.
  - 0.45–0.85 s between attacks (was 0.7–1.2) and enrage at 60% (was 50%).
  - ×2 EXP so the hero still levels up: the Juggernaut alone takes him from level 1 to 4.
- **Dash (Shift)**, `src/skills/Dash.js`, tunables in `CONFIG.hero.dash`:
  - Movement: 5.2 m in 0.2 s in the WASD direction (the facing when no key is held), with fast-start / eased-end speed; he exits at 55% move speed.
  - Defence: immune to damage and knockback for the whole dash plus 0.12 s.
  - FX: additive cyan afterimages every 45 ms; a ring, dust, sparks and a petal puff at the start; a new `dash` lunge clip.
  - Stacks: 2, refilling one at a time every 3 s (hero clock).
  - Rules: the press is buffered for 0.15 s and cancels a basic attack at any point. It is blocked during a skill cast (Q aim included), and skills are blocked mid-dash.
  - HUD: a SHIFT slot shows one pip per stack, and the sweep + seconds while both are spent.
- **Debug:**
  - Hero → Dash (Shift) folder.
  - Enemies → Bosses folder (damage / HP / tempo multipliers, enrage threshold).
  - C also refills the dash.
- **Verified** with fixed-step tests:
  - Wave sequence 1–11 is as listed.
  - The wave 1 boss spawns with 3450 HP, ×1.60 damage and tempo 1.15.
  - The dash moves 5.2 m, the stack refills 3 s apart, a hit mid-dash is ignored, it cancels a combo swing, and Shift during Q aim does nothing.
  - Boss kill → level-up cards → wave 2 basic with 3 alive. No errors.

---

## Settings sliders

- The pause menu has two sliders, saved in localStorage:
  - Mouse sensitivity: default raised from 0.0024 to 0.006 rad/px, range 0.001–0.02.
  - Brightness (`CONFIG.lighting.brightness`): default 1.4, range 0.5–3. It multiplies the hemisphere, moon and rim lights; emissive glow is unchanged.

## Camera distance, Linux mouse

- **Camera distance.** The follow boom default went from 7.5 m to 9.5 m. A pause-menu slider sets it (4–16 m) and is saved.
- **Mouse look on Linux.**
  - Pointer lock now requests raw input (`unadjustedMovement`), so there is no OS acceleration and the feel matches across systems. It falls back to normal lock where unsupported.
  - Filters drop the bogus jumps that X11/Wayland report when the cursor is warped: the first 2 events after locking are skipped, as are deltas over 300 px or more than 6× the recent motion.

## Linux pitch drift, scroll zoom

- **The camera tilted toward top-down on Linux when looking sideways.** X11 rounds sub-pixel motion, so horizontal sweeps carried a steady +1 px vertical bias.
  - Per event, 1 px vertical jitter is dropped while moving sideways (|dx| ≥ 2).
  - Per frame, vertical look is ignored while |dy| < 0.3·|dx| (`follow.pitchLock`).
  - Verified: 300 frames of sideways sweeps with a +1 px bias left the pitch unchanged, and deliberate up/down look still works.
- **Scroll-wheel zoom.** ×1.1 distance per notch, 4–16 m. It updates and saves the pause-menu "Camera distance" slider.

## Blade fixes — run grip, whip curve

- **Blade pointed into the ground while running.** This was not intended: the run clip swung the sword backward and down, and its tip reached the floor behind him. The run now keeps the guard grip, with the blade forward and to the right and its tip about 0.3 m above the floor, bobbing with the stride.
- **Idle guard.** The tip measured 0.38 m below the floor, so the weapon pitch was lowered from 62° to 44°; the tip now sits about 0.25 m up. Attacks and skills that start from the guard pose pick this up.
- **Whip-crit curve reversed.** Chain points nearer the hand now sample the sweep *ahead* in time (`tf = t + lag·(1−f)…`), so the hilt leads and the chain trails back toward where the tip has been. The tip keeps its own timing, so the hit arc, reach and timing are unchanged.

---

## Faster, unpredictable bosses · lifesteal · aimed E

- **Bosses are much faster.**
  - Tempo went from ×1.15 to ×1.45; enrage multiplies on top, capped at ×2.1 so telegraphs stay readable.
  - Base walk speed: Juggernaut 2.1 → 2.8 m/s, Kitsune 4.2 → 5 m/s. Raiju orbit: 0.32 → 0.42 rad/s.
- **Bosses are unpredictable** (`Boss.js`, `CONFIG.bosses`):
  - **Per-attack tempo jitter:** ×0.8–1.35, so the same attack's telegraph is sometimes short, sometimes long.
  - **Random recovery:** 0.1–0.95 s ÷ tempo, with a 35% chance to chain straight into the next attack.
  - **Erratic footwork** for walking bosses and Kitsune clones, re-rolled every 0.35–1.1 s and after each attack:
    - approach to keep distance;
    - circle-strafe either way;
    - flank dash at ×3.2 speed to a point 60–130° around the hero, kicking up dust;
    - back-step.
  - **Raiju:** randomly reverses its orbit (0.22/s), surges ×2.2 for 0.6 s (0.3/s) and crosses over the arena 45% of the time (was 30%).
- **Lifesteal:** the hero heals 4% of the damage he deals (`CONFIG.hero.lifesteal`). Blocked hits don't count. It is on the debug Hero folder.
- **E aims like Q.**
  - Pressing E enters slow-mo (×0.15) with the blue tint and desaturation.
  - A new cyan lane decal (`AimRings.lane`: bright edges, chevrons flowing outward) shows the thrust's length (with the lunge) and width toward the aim point.
  - Left-click fires along the lane. Right-click / Esc cancels with no cooldown. It auto-fires after 2.5 s. The cooldown starts on firing.
- **Debug:** the Bosses folder gained tempo cap, chain chance and attack jitter min/max.
- **Rim camera.**
  - Near the rim the follow camera used to pull in until the hero filled the screen. Now `follow.maxRadius` is 14 m (past the lanterns, clear of the canopies), and when the boom doesn't fit the camera first rises and tilts down toward the pivot (up to `rimPitchMaxDeg` 48°) before shortening.
  - Verified at the back, side, tree and front rim: the camera stays about 7.5 m from the hero.
  - Tree blocks within 6 m of the camera dither out, fully gone at 2.5 m (`map.trees.camFade`, screen-door discard in the sway material; shadows unchanged).
- **Fixed: the E spear burst never drew.** Its shader declared a variable named `half`, which is reserved in GLSL ES 3.0, so the program failed to compile. Renamed to `hw`.
- **Verified with fixed-step tests:**
  - Juggernaut, over 20 s: footwork split approach 376 / flank 306 / strafe 290 frames, 9 attacks at tempos 1.34–1.86.
  - Kitsune: all four footwork modes appear, 11 attacks in 15 s.
  - Raiju: reverses its orbit.
  - Lifesteal: a 61-damage hit healed 2.4 HP.
  - E: aim → world ×0.21 with the lane shown; right-click cancels with no cooldown; click fires (cooldown 10 s); auto-fires at 2.5 s.
  - No shader or page errors.

---

## Hero model v3 — reference sheet, finer blocks

- **Block size.** The hero alone now uses `HERO_VOXEL = 0.06` m, half the other characters' block, at the user's request. Rebuilt on that grid (`src/voxel/models/HeroModel.js`) to match the character reference sheet.
- **Rig compatibility.** Every joint pivot is exactly 2× the old grid, so all bone lengths in meters are unchanged: the clips, the hand-solved attack poses, the whip, Thunderclaw, Shatter, Demontime and the afterimages work as before.
  - The rig origin moved to `[-1, 0, -1]`, since the mirror axis is now x = 1.
  - Blade segments are still 0.24 m (`HERO_SEG_LEN_M`, now used by `WhipStrike`, `Demontime` and the blade trail instead of `2·VOXEL`).
- **New details:**
  - Broad crescent horns (row by row), crest blade, angled eyes.
  - Wide V core.
  - Winged pauldrons built from stair-stepped feather plates (`feather()`: narrow gold tips, gilded front edges), gold mon.
  - Wider glowing back fins, backpack light bar and vents.
  - Shorter crimson sashes and a raised crotch so the legs read long; hip tassets with red cords.
  - Big gold knee guards, sabatons with gold toe caps and heel spurs.
  - Larger gray gauntlet with three hooked talons + thumb.
  - Nodachi with wraps, tsuba, seams, spine and a glowing point.
- **Palette** (`HERO_PALETTE`): added `clawLight`, `slate` and `goldLight`. Emissive levels were lowered (V 1.3–1.8, eyes 2.4) because the finer model has more glowing blocks.
- **Cost:** 541 boxes and 5.7 k triangles (was 216 / 2.3 k), still 2 draw calls.

### Correction after review: shoulder guards and back thrusters, not wings
- **Shoulder guards.** The feathered "wings" were a misreading of the reference and are gone. Each shoulder now carries an ō-sode shoulder guard:
  - a navy cap with a gold mon;
  - three layered bands sloping down and outward (`band()` staircase: gold lower edge, darker spiky outer end, down to elbow height);
  - a serrated gold blade rising diagonally from the top.
- **Back thrusters.** The back fins became two tall thruster pods: waist to above the head, mounted to the backpack, a gold inner stripe, and cyan glow at the top nozzle and bottom exhaust.
- **Other details matched to the reference:**
  - red bead rope hanging in a U down the chest;
  - tall gold bars framing the chest;
  - a gold belt plate over a long navy center panel with crimson strips on both sides to the ankles;
  - a long back sash under a knotted rope belt;
  - front thigh tassets with a gold zigzag;
  - blue-gray segmented upper arms;
  - knee lights.
- **Cost:** 522 boxes, 6.0 k triangles. In-game check: idle, side view, attack. No errors.
- **Follow-up after review:** removed the bottom shoulder-guard band (and the spike that hung under it). The ō-sode now has two bands.

## Skill icon artwork

- The HUD slots now use the supplied artwork instead of the SVG icons (`src/ui/skillIcons.js`): LMB = segmented whip-sword, Q = claw and chain, E = thrust, R = Demontime planted sword, Shift = dash boot.
- Each image is cropped inside its own frame and downscaled to a 96 px JPEG data URI (about 30 KB total), inlined in the single-file build.
- The cooldown sweep, seconds, rank pips and key labels draw on top.

## Splash art and portrait

- **Title screen:** the supplied splash art (full resolution, WebP) under a dark bottom gradient (`src/ui/art.js`).
- **HUD portrait:** the supplied character art, cropped to the head and horns and downscaled to a 104 px JPEG (shown at 52 px).
- The single-file build grew to about 1.7 MB, mostly the splash.

---

## Demontime cast reworked (after review)

- **New sequence** (2.5 s, timeline in `CONFIG.skills.demontime`: `plantAt`, `ringOut`, `nanoStart`, `nanoEnd`, `restoreAt`, `pullFree`):
  1. Raise the sword overhead point-down with both hands.
  2. Stab it into the ground in front, standing straight. At that instant, a shockwave bursts out of the sword and time stops; the grayscale time-stop ring sweeps out from the sword.
  3. The sword stays planted while the nanobots upgrade it (plates assemble).
  4. The shockwave comes back: inward rings, and the time-stop ring rushes back into the sword as time resumes.
  5. Excalibur pull: the sword is drawn straight up out of the ground and lifted aloft. The release pulse fires when the blade comes free.
- **New clips** `demonPlant` and `demonPull` replace `demonKneel` / `demonRise`. Their four poses (raise, planted, drawn, aloft) were solved against the rig for the two-handed grip.
- **Verified with a stepped run:**
  - world time is 1 until the stab and 0 right after it;
  - the plates assemble during the hold;
  - time returns at 2.0 s, and the buff starts at the end of the cast;
  - close-up frames of each phase; no errors.

---

## Renamed: Thunder Descends, English skill names

- **Game:** *Thunder Descends*. Title screen (single-line title), browser tab, debug panel, package (`thunder-descends`), release zip (`release/ThunderDescends-<version>.zip`), launchers, READMEs. The dev console handle is now `window.THUNDER`; settings saved under the old key are migrated.
- **Skills:** Q Storm Grapple, E Lightning Lance → Blade Storm, R Zero Hour, Shift Flash Step, passive Chain Blade. Used on the title controls, level-up cards, skill labels and the debug panel.
- **Bosses** (shown in banners and the boss bar): Iron Juggernaut, Shadow Fox, Storm Serpent.
- **Single source:** display names live in `CONFIG.names` and `CONFIG.bosses.*.name`. Internal ids, class and file names are unchanged.

---

## Zero Hour camera, dash strike, smaller splash

- **Zero Hour close-up** (`CameraRig.cinematic()`, `CONFIG.camera.cine`).
  - During the cast the follow camera swings to a low front-side close-up, in front of the hero and toward his sword side: 5.6 m away, pivot 1.05 m, 6° down.
  - The stab, the planted sword and the upgrade are framed above the skill bar.
  - It blends in over 0.35 s and starts easing back at 2.2 s (0.55 s).
  - The player's yaw and pitch are untouched, so the camera returns exactly where it was. Mouse look is ignored meanwhile, and cancel, death and restart reset it.
- **Dash strike** (`Dash.js`, `CONFIG.hero.dash.strike`). After a dash, a 0.8 s window opens, and a click during the dash is buffered into it.
  - The nearest enemy in front of the aim within 8.5 m gets a red floor marker (`AimRings.marker`), and the blade glows brighter.
  - Attacking snaps the hero to it in an invulnerable lunge (≤ 0.2 s, tracks the target, afterimages, lightning flicker).
  - Then one heavy thrust lands: 2.8×ATK (can crit), unblockable, knockback 11, 0.6× splash in 2.4 m, 0.11 s hitstop, shake 0.7, zoom punch, flash, shock rings, crescent, petals.
  - Skills and dashes are blocked during the strike. Debug Hero → Dash folder: window, range, cone, ×ATK, shake.
- **Splash art** re-encoded to 1600×900 WebP (q 0.8): 492 KB → 259 KB. The single-file build is now 1.36 MB (was 1.67 MB).
- **Verified with fixed-step tests:**
  - A plain attack doesn't snap. After a dash the marker shows; clicking lunges (invulnerable) and the hit took a Tate from 260 to 106 with trauma 0.65.
  - After the window expires, a click is a normal attack.
  - Ult: close-up blend 0.95 at the stab, back to 0 after the pull, yaw restored.
  - No errors.

---

## Windows mouse, health visibility, 3 dashes, smoothness

- **Mouse on Windows.** The Linux workaround filters were the cause:
  - The spike filter dropped any event over 6× the previous one, so on Windows fast flicks were thrown away and the camera "stuck".
  - The vertical dead-zones and per-frame pitch lock swallowed small up/down motion, so aiming felt sticky.
  - Fix: every mouse event is now applied. Only the first event after locking and impossible >1500 px deltas are skipped. The Linux filters are kept behind `camera.follow.linuxMouseFix` (off).
  - Light look smoothing (22 ms time constant) evens out uneven event/frame timing. It has a pause-menu slider (0 = raw).
- **Skill aiming.** While aiming Storm Grapple in the follow camera, vertical mouse slides the target along the ground linearly (0.035 m/px, clamped to range). The camera no longer pitches, so the target never jumps far as the view nears the horizon. The aim point sits on the screen-centre line.
- **Pointer lock robustness.** Whenever the game wants the mouse but doesn't have it, time holds behind a "Click to continue" prompt; clicking grabs it. This covers run start, resume, and Chrome refusing a re-lock within ~1 s of Esc. A refused request is retried after 1.1 s. The debug panel counts as needing the cursor.
- **Health visibility.**
  - Big health bar above the skill bar: red, amber ≤ 55%, number beside it.
  - A white trail shows damage just taken, and the bar glows briefly on each hit.
  - At ≤ 30% the bar and the screen edges pulse red.
  - The top-left bar is taller with a bigger number.
- **Dashes:** 3 stacks (still one refill every 3 s); the HUD shows 3 pips.
- **Smoothness.**
  - Shader warm-up at load (`core/Warmup.js`): every hidden FX object plus one rig of each enemy and boss is rendered once behind the title, including the time-stop mask path. Effects, enemies and bosses no longer hitch the first time they appear (worst on Windows, where Chrome compiles shaders through Direct3D).
  - Dynamic resolution (`core/AutoQuality.js`): when the 1 s average frame time exceeds 19.5 ms the internal resolution steps down by 0.1 (min 0.55×). After 4 s under 15.5 ms it steps back up. Debug Post folder has the toggle and render scale.
- **Verified with fixed-step tests:**
  - The lock prompt holds time until the lock is granted.
  - A 180 px flick after a 2 px event turns the full 62.6°, and small vertical motion pitches.
  - Q aim distance goes 6.6 → 8.7 → 1.5 → 9 (clamped) and restores on cancel.
  - Low-HP UI and vignette are on at 24%; 3 dash pips.
  - Auto quality steps 1 → 0.9 on 30 ms frames and back up with headroom. No errors.

---

## Update — Sound & reasons to play

### What was built
- **Sound** (`src/audio/Audio.js`, `src/audio/Music.js`): procedural SFX for every action, hit, skill, boss telegraph, UI hover/click and card reveal/pick (with a rising chime per rarity). Generative layered music follows the game's intensity, the world is low-passed during the time stop, and a heartbeat plays at low HP. Master, music and SFX volume sliders.
- **Score & style** (`src/game/Score.js`): live score, combo counter, style ranks D to SSS with multipliers and an event feed in the HUD.
- **Cards**: rarities, 7 special cards, one reroll, and deal/pick animations.
- **Meta** (`src/game/{Save,Meta,Achievements}.js`): Thunder Cores, an Armory with 8 permanent upgrades, 17 achievements with toasts, saved bests, and a results screen.
- All numbers are in `CONFIG.audio`, `CONFIG.score`, `CONFIG.meta`, `CONFIG.achievements` and `CONFIG.cards`.

- **Camera pitch smoothing**: vertical look gets its own longer smoothing (`follow.pitchSmoothingMul`) and soft limits (`pitchSoftZoneDeg`). The rim tilt is blended with a smooth max (`rimBlendDeg`) and partially follows the player's look (`rimLookTilt`), which removes the old dead zone and jump when looking up or down near the arena edge.
