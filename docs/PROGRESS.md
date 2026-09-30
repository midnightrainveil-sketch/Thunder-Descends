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
