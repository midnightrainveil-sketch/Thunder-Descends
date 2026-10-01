# KUROGANE — Game Spec

## 1. Vision
A short, punchy, playable 3D arena action demo in the browser. The player controls KUROGANE, a mecha samurai, in a circular moonlit shrine arena ringed by sakura trees, fighting waves of robot soldiers (max 1–2 on the field at a time) and 3 bosses. EXP from kills upgrades skills.

Art: blocky low-resolution voxel art — every character and prop is built from big, clearly visible cubes, like chunky 3D pixel art — with a mature, grounded, cinematic tone. Low block count, bold simple shapes, detail through color blocking only. Realistic adult proportions; nothing chibi, cute or big-headed.

Build priorities, in order: (1) visuals and effects, (2) gameplay feel, (3) UI. Out of scope: multiple stages/levels, music, sound, story.

## 2. Camera & world
- Gameplay camera: third-person follow camera behind the hero's back (`camera.follow` in `config.js`: FOV ~56°, boom ~7.5 m from a pivot 2.5 m above his feet, 0.85 m right-shoulder offset, ~20° looking down). The mouse turns it (pointer lock: horizontal = yaw, vertical = pitch −8°…62°); ← → turn it too. The pivot chases the hero smoothly, and the boom pulls in so the camera never leaves `follow.maxRadius` (past the balustrade, short of the lanterns). While the hero runs roughly away from the camera and the mouse is idle, the camera eases back behind his back. Attacks and skills aim through the screen center (the ground reticle marks the point, 1.2–13 m ahead).
- Fixed cinematic pose: an elevated three-quarter side view, ~35–40° looking down, low FOV (~30–35°). It frames the title screen, the run glides from it into the follow camera (0.7 s), V toggles back to it during play (then WASD is screen-relative and the mouse cursor aims, as originally designed), and the map composition (moon, pagoda, canopy check) is laid out against it. Defined in `config.js` by `elevationDeg`, `yawDeg` (0 = looking straight from the front), `fov`, `target`, and auto-fit: distance is computed so the whole arena circle plus a margin fits the viewport at any aspect ratio, with extra headroom at the top of the frame for the torii and sakura canopies behind the arena.
- Screen shake and short zoom punches play on top of either camera. Losing the pointer lock mid-run (Esc, alt-tab) pauses; clicking the game grabs it again.
- Units: meters, +Y up, ground plane y = 0. The arena is a circle of radius `ARENA_RADIUS = 11` m centered at the origin. All movement is on XZ and clamped to the circle (radius minus character radius).
- "Front" = the side of the arena nearest the camera (+Z). "Back" = the far side (−Z).
- Block sizes (big on purpose): characters use `VOXEL = 0.12` m, so the hero is only ~20 blocks tall (~2.4 m). Large bosses use `BOSS_VOXEL = 0.18` m so bigger characters stay just as chunky instead of gaining detail. Environment uses `ENV_VOXEL = 0.25` m for props (lanterns, balustrade, trunks), 0.5 m for canopy cubes, big structures and the crest, and 1 m floor blocks. Only FX particles, nanobots and petals may be smaller than the block scale.

## 3. Art direction
- Look: big flat-shaded cubes, crisp edges, per-block brightness jitter (±4–6%), no textures, no smooth geometry. Block rule: nothing smaller than one block. No recessed panel lines, scratches, chipped corners or tiny greebles — detail comes only from color blocking (a whole block in a different color), a few stepped layers, and strong silhouettes. If a feature can't be shown with whole blocks, simplify it. Emissive energy is used sparingly on whole blocks (visor row, chest core, blade edge row, a few edge blocks) and blooms.
- Proportions: realistic adults, ~7 heads tall even at low resolution (the hero's head is ~3 blocks of his ~20). Small heads, long legs (~half the body height), broad shoulders tapering to a narrower waist. Motion is weighty and controlled, not bouncy or cartoony.
- Palette:
  - Hero: gunmetal #2A2F3A, dark steel #1E222B, ivory #E6E1D3, worn edge #8A8F99, crimson #D7263D, energy cyan #35E0FF, hot core #E8FDFF.
  - Enemies: rust red #8C2F1F, black #15151A, bronze #8A6A3A, ember orange glow #FF7A1A.
  - Map: basalt #3A3D46 / #2E3038 / #26282F, moss #3E5A3A, torii vermilion #B8452F with black #141418 top beam, sakura #F6CADB / #EFA3BF / #FFE8F0 / white #FFF6F8, bark #2B2123, lantern warm #FFB25A, seam cyan #35E0FF (low intensity), night indigo #0E1426, moon #E9EEF7.
  - Bosses: Juggernaut ember orange, Kitsune magenta #FF3FD2, Raiju yellow #FFE14A.
- Readability rule: hero energy = cyan, enemy energy = orange, danger telegraphs = red/orange ground decals, crits = white-cyan. Sakura pinks stay pale, soft and non-emissive so they never compete with gameplay colors.

## 4. The map — circular sakura shrine arena
- Setting: a circular stone shrine platform on a hilltop at night, mostly traditional Japanese.
- Floor (play area, radius 11 m): big 1 m × 1 m dark basalt blocks on a grid, filling a stepped, pixelated circle. Concentric ring bands (every 2 blocks) in alternating stone shades, thin cyan glow lines along the stepped ring-band edges and 4 stepped radial lines (low intensity, an occasional slow pulse travelling outward), a pixel-art crest in the center built from 0.5 m blocks (an original emblem: a ring around a stylized lightning bolt crossed by a blade, darker stone with a few faint cyan blocks), a few whole moss-green blocks toward the rim, fallen cube petals scattered on top. The play area is perfectly flat (decals must lie flat on it). Movement is still clamped to a true circle just inside the stepped edge.
- Rim: the platform ends in a visible stone foundation wall that drops into mist, most visible at the front edge. A low blocky stone balustrade (~0.5 m, never hides characters) runs around the rim with 4 gaps (front-left, front-right, back-left, back-right) that act as enemy spawn gates. 8 stone tōrō lanterns sit on the rim with warm flickering fire boxes and soft light pools on the floor.
- Back: a large blocky vermilion torii gate just beyond the back edge, blocky stone steps descending behind it, a small blocky shrine hall with a stepped roof further back half-hidden by trees, a distant blocky five-tier pagoda silhouette on a far ridge.
- Sakura: 7–9 large blocky sakura trees (5–9 m tall) around the back and sides, outside the rim, stair-stepped leaning dark trunks, big canopies made of 0.5 m cubes in pale pink, soft pink and white (a couple of green cubes) forming a few overlapping rounded clusters with stepped edges. One large "hero tree" behind-left frames the torii. No trees in the front arc between the camera and the arena; canopies may overhang the rim slightly but never hide the play area. Canopies sway gently in the wind.
- Petals: drifting sakura petals (tiny pink cubes) across the whole scene, landing, resting and fading on the floor; a petal carpet under the trees. Petals react to gameplay: shockwaves, slams, dashes and sweeps push them away. Petals run on the world clock, so they slow during Q aiming and freeze in mid-air during the Demontime time-stop.
- Sky & distance: deep indigo gradient sky, faint stars, a large pale moon with a soft halo and thin clouds drifting across it, three layered big-block mountain ridges fading into the distance (atmospheric perspective), thin ground mist rolling around the rim and below the platform edge.
- Lighting: cool moonlight (main shadow caster), dim blue hemisphere fill, warm lantern pools, a subtle back/rim light so silhouettes separate from the floor, dappled canopy shadows at the arena edges.

## 5. The hero — KUROGANE
Design: a tall blocky mecha samurai (~20 blocks tall) with realistic proportions (~7 heads tall): small helmeted head, broad shoulders tapering to a narrow waist, long powerful legs. Navy armor blocks with tan-gold trim (knee guards, toe caps, bracers, pauldron edges and emblems), dark joint blocks, a long crimson sash under a navy front panel, cyan light strips on shins, thighs and forearms and a glowing cyan V chest core. Navy kabuto with large gold crescent horns, gold side flaps and a stepped neck guard; big layered pauldrons with gold-tipped plates; two tall back fins with glowing cyan edges; a gray claw gauntlet and a gold sword guard (final look per the character sheet). Face fully covered by a thick blocky jaw mask with a single row of glowing cyan visor blocks. Big rectangular shoulder pauldrons (2 stepped slabs). Two angular fins on the back with cyan tip blocks. Left forearm: an oversized armored gauntlet (~1.4× the right forearm) with three thick 1-block claw fingers and a dark wrist chain-housing block; it detaches for Thunderclaw. Right hand: a long nodachi (~2.0 m) whose blade is 8 stacked 2-block segments in alternating steel shades (they split apart for the crit whip), a glowing cyan edge row, crimson hilt, square guard.

Base stats (all in config.js):
| Stat | Value |
|---|---|
| Max HP | 600 |
| Move speed | 6 m/s (×0.45 while attacking) |
| ATK | 30 |
| Basic attack interval | 0.55 s (scaled by attack speed) |
| Crit rate | 50% |
| Crit damage | ×2.0 |
| Hurt i-frames | 0.4 s |

Controls: WASD move, camera-relative (W = away from the camera). Mouse = look / turn the camera; ← → also turn it. V = switch between the follow camera and the fixed camera. The hero faces his movement direction; while attacking or using a skill he turns toward the aim point (screen center in the follow camera, the mouse's ground point in the fixed camera; legs follow the movement, twisting up to ±60°). Left mouse (hold) = basic attack toward the aim point. Shift = dash. Q / E / R = skills. Esc / P = pause (Esc cancels Q aiming first in the fixed camera; in the follow camera Esc releases the mouse and pauses, right-click cancels Q). Enter = restart from game over.

Dash (Shift): a 5.2 m burst over 0.2 s in the WASD direction (the facing when no key is held). Immune to damage and knockback for the whole dash plus 0.12 s after; cyan afterimages trail it and a small ring and dust mark the start. 2 stacks, one refills every 3 s (hero clock). It cancels a basic attack at any point; it can't be used while a skill is being cast (Q aiming included), and skills can't be cast mid-dash. The HUD shows it as a fifth slot (SHIFT) with one pip per stack.

Basic attack: 3-hit combo (damage ×1.0, ×1.0, ×1.4), sector hitbox range 2.4 m, 120° arc toward the aim. Combo resets after 0.9 s without attacking. Input is buffered (a click during the current swing queues the next).

## 6. Passive — Crit Chance (whip-sword)
- Every basic attack rolls crit (50% base, 100% during Demontime).
- On crit the attack becomes a WHIP STRIKE: the 8 blade segments detach and fly out along a long curved arc like a spine, each linked to the next by crackling cyan lightning; the chain sweeps ~170° in front of the hero with a wave-like lag (each segment follows the one before it), then snaps back together with a click-flash. Reach 5.5 m (vs 2.4 m normally), 170° sector hitbox, crit damage. The sweep blows petals along the arc.
- Timing: extend + sweep 0.28 s, retract 0.15 s. Hitstop 0.07 s on hit, camera shake, big crit damage number.
- During Overdrive, crit slashes show a shortened whip-flash variant.

## 7. Skills
All numbers in config.js. Each skill has rank 1–4 (rank-ups come from level-up cards, §10). One skill at a time, none while stunned; a basic attack can be cancelled into a skill once its hit is out.

### Q — Thunderclaw (cooldown 6 s)
1. Press Q → targeting mode. World and hero time slow to ×0.15, the screen tints cold blue and desaturates slightly. A 9 m range ring shows around the hero and a 2.5 m AoE reticle follows the mouse, clamped to max range and to the arena. Left-click confirms. Right-click or Esc cancels (no cooldown). Auto-fires at the cursor after 2.5 real seconds.
2. Launch (0.18 s): the left claw hand detaches and flies to the target; a thick chain of voxel links trails from the empty wrist to the hand, with a slight sag and lightning crawling along it.
3. Grab (0.2 s): up to 3 enemies in the radius are yanked together to the center, clustered inside the claw's lightning grip, take 1.2×ATK and are stunned 1.5 s. Bosses are not moved; they take the damage and a 0.6 s stun.
4. Pull-dash (0.25 s): the chain retracts and drags the hero to the grab point (invulnerable meanwhile). Landing: 2 m impact, 0.8×ATK, shake, petal burst. The hand reattaches with a spark.
If nothing is in the radius, the hand still flies and the hero still dashes (it doubles as mobility).

### E — Shatter (cooldown 10 s) → Phase 2: Overdrive
1. Shatter: 0.12 s windup, one-handed straight thrust toward the aim. Rectangle hitbox 3.5 m long × 1.2 m wide, 1.8×ATK, stun 1.0 s, spear-like cyan shockwave from the blade tip.
2. If it hits at least one enemy → Overdrive (1.0 s): two-handed grip, lightning-fast: a slash every 0.08 s (~12 slashes) in a 120° cone, 3.2 m range, 0.45×ATK each, each can crit. The hero glows, leaves cyan afterimages, drifts toward the aim at 1.5 m/s and can't be knocked back. Every slash spawns a crescent arc at a varied angle; it ends with a heavier final slash.
3. If Shatter misses, nothing more happens (normal recovery).

### R — Demontime (cooldown 30 s) — ultimate
Cast (2.2 s, hero invulnerable, input locked):
- 0.00–0.40 s: the hero kneels and plants the sword point-down. A ring shockwave expands from the sword past the edge of the screen. Everything the ring passes turns grayscale and freezes (world time = 0: enemies, projectiles, particles, petals in mid-air, swaying trees, lantern flicker). Only the hero's clock runs and the hero stays in full color.
- 0.40–1.60 s: nanobots (hundreds of tiny cyan emissive cubes) stream from both arms along curved paths into the sword; the sword visibly grows as extra blocky plates assemble onto it block by block.
- 1.60–2.00 s: the grayscale ring collapses back into the sword; color and time return.
- 2.00–2.20 s: release pulse (radius 5 m, 2.0×ATK, flash, shake, a big outward burst of petals); the hero stands with the upgraded blade.

Buff (7 s, on the hero clock): bulkier blade (≈1.6× thicker, extra plates along the spine, white-cyan edge, crimson core glow), attack speed +60%, cooldowns tick 2× faster, crit rate 100% (every basic attack is a whip strike), crackling cyan and crimson aura. When it ends, the extra plates dissolve into nanobot cubes.

## 8. Enemies (base values at wave 1)
All enemies are rust-red/black/bronze armored robots with adult proportions (~0.95× hero height unless noted), orange emissive eyes and seams, the same block scale and simplicity as the hero. Every attack has a readable telegraph (eye flare + red/orange ground decal). Hit flash white 80 ms, small knockback. On death the model shatters into voxel chunks that bounce and fade, and drops EXP shards (small cyan cubes that pop out, then fly to the hero; instantly within 3 m).

| Enemy | HP | Damage | Speed | Behavior | EXP | From wave |
|---|---|---|---|---|---|---|
| Ronin Drone | 120 | 18 | 3.2 | Melee. Approaches, 0.45 s windup, slash 1.6 m range, 1.4 s cooldown. Lean ashigaru-style armor, wide conical hat helmet, one eye, short katana. | 10 | 1 |
| Teppo Gunner | 90 | 22 | 2.8 | Ranged. Keeps 6–8 m away, 0.7 s aim telegraph line, fires a glowing orange bolt (9 m/s), 2.4 s cooldown. Long rifle, back ammo drum, scope helmet. | 12 | 2 |
| Tate Brute | 260 | 35 | 2.2 | Tank (~1.05× height, 1.3× width). Frontal 120° shield blocks 80% damage unless stunned or hit from behind. 0.9 s slam telegraph, 2.2 m radius. Tower shield, hammer. | 20 | 3 |

## 9. Waves & bosses
- Order: boss, basic, boss, basic, boss — wave 1 Oni Juggernaut, wave 2 basic, wave 3 Kage Kitsune, wave 4 basic, wave 5 Raiju Serpent → Demo clear. Endless keeps alternating (bosses on odd waves, repeating in the same order).
- Basic waves: max 3 enemies alive. A basic wave w is scaled to level L = 1 + 3·(w−1) (wave 2 → L4, wave 4 → L10) and has 4 + floor(0.6·L) enemies (6, then 10), spawned one at a time as slots free up, from the 4 balustrade gaps or random rim points at least 5 m from the hero (1 s spawn telegraph: orange vertical beam + ground ring). All three types appear from wave 2.
- Scaling per level: HP ×1.14^(L−1), damage ×1.07^(L−1), speed +1.5%/level (max +30%), EXP +15%/level.
- Between waves: 2.5 s breather, hero heals 20% max HP (40% after a boss wave), big "Wave N" banner.
- Boss difficulty (all bosses): HP ×1.15, damage ×1.6, tempo ×1.15 (movement, telegraphs and attack timing are faster; enrage multiplies on top), 0.45–0.85 s between attacks, enrage at 60% HP. Bosses give ×2 EXP (they carry the levelling now that there are fewer waves).
- Boss waves (boss alone, with an intro); base HP below, before the ×1.15:
  - Wave 1 — Oni Juggernaut (HP 3000): ~2.2× hero height, hulking but properly proportioned brute, horns, furnace chest, spiked club. Triple ground slam (three red circles in sequence toward the hero), charge across the arena to the rim (red lane telegraph; stunned 1.2 s when it crashes into the balustrade), shockwave stomp. Enrage at 60% HP: faster, chest flares.
  - Wave 3 — Kage Kitsune (HP 4500): tall agile ninja mech, fox mask, 3 segmented tails, twin blades. Teleport-behind strike (magenta flash telegraph 0.5 s), triple dash-slash (three lane telegraphs, then fast dashes), tail spike fan (projectiles). At 60% HP: 2 shadow clones (die in one hit, half damage).
  - Wave 5 — Raiju Serpent (HP 7000): flying segmented dragon (~16 segments) circling the arena just outside the rim at 2–4 m height, sometimes crossing over it in a figure-8, head leads. Sweeping breath beam (telegraph line), lightning pillar barrage (5–8 red circles), dive across the arena along a lane. Every segment is hittable; damage goes to one shared HP pool; the head takes ×1.5.
- Bosses can't be pulled by Thunderclaw and receive reduced stuns (Q 0.6 s, E 0.4 s).
- After wave 5: "Demo clear" screen with stats and an option to continue endlessly (bosses repeat on every other wave with +60% HP and +25% damage per repeat).

## 10. Progression
- EXP to next level: 40 + 25·(L−1).
- Level-up: +8% ATK, +5% max HP, heal 25%, then the game pauses and shows 3 upgrade cards (pick one). Pool:
  - Thunderclaw II/III/IV: +1 target and +0.5 m radius · −1 s cooldown · grabbed enemies take +30% damage while stunned.
  - Shatter II/III/IV: Overdrive +0.4 s · Shatter range +1.5 m and width +0.4 m · Overdrive slashes chain lightning to one nearby enemy.
  - Demontime II/III/IV: buff +2 s · release pulse ×2 damage and +2 m radius · kills during the buff extend it by 0.5 s (max +4 s).
  - Passive II/III/IV: crit damage +30% · whip reach +1.5 m · crits heal 1% max HP.
  - Stats (up to 5 times each): ATK +10% · max HP +12% · attack speed +8%.
- Maxed options leave the pool. Cards show icon, title, description, current → next rank.

## 11. UI
- Style: dark translucent indigo panels (#0E1426 at ~75% opacity) with angular cut corners (clip-path), 1 px cyan edge lines, crimson for HP and danger, restrained and elegant. Fonts (Google Fonts, with fallbacks): Chakra Petch for labels and text, Silkscreen for numbers and damage numbers. Sentence case, short plain labels.
- HUD: top-left portrait (mask with visor), segmented HP bar, level badge, thin EXP bar. Top-center wave counter + enemies remaining. Wide boss bar with name during boss fights. Bottom-center skill bar: basic attack, Q, E, R icons (inline SVG), key labels, radial cooldown sweep + seconds, rank pips, ready glow; R shows a buff timer ring while active; a fifth SHIFT slot shows the dash stacks as pips, with the sweep + seconds while both are spent. Bottom-left passive icon with current crit %. Floating damage numbers (normal white; crit larger white-cyan with pop and jitter; damage to the hero crimson).
- Screens: title (game name over the live arena with drifting petals, "Click to start", controls), pause (resume, restart, screen-shake toggle, mouse-sensitivity and brightness sliders saved in the browser; brightness scales the scene lights, not emissive glow), level-up cards, game over (wave, kills, time, Enter to retry), demo clear (stats; continue endless or restart).

## 12. Technical architecture
- Stack: Vite + vanilla JavaScript (ES modules) + three.js (latest from npm) + lil-gui (debug). vite-plugin-singlefile so `npm run build` outputs one self-contained `dist/index.html` that runs by double-clicking. No external asset files: all geometry, textures and icons are procedural or inline SVG. The only external request is Google Fonts (with fallbacks).
- Rendering: WebGLRenderer (antialias, ACES filmic tone mapping, sRGB output, PCF soft shadows from the moonlight, pixel ratio capped at 2). EffectComposer: RenderPass → UnrealBloomPass → custom GradePass → OutputPass.
- GradePass uniforms: saturation, tint (color + strength, for Q slow-mo), vignette, chromaticAberration, flash (additive white), and a time-stop ring: ringCenter (screen UV), ringRadius, ringActive — pixels inside the ring become grayscale with a bright cyan line at the boundary. A hero mask (the hero rendered to a mask target) lets selected objects stay in color inside the ring.
- Materials: opaque voxel parts use MeshStandardMaterial (vertexColors, flatShading). Emissive parts use MeshBasicMaterial (vertexColors, toneMapped: false) with vertex colors scaled above 1.0 so they bloom. The bloom threshold is high enough that only emissive parts glow.
- Time system (GameTime): realDt (clamped to 1/20 s), worldScale, heroScale, paused, hitstop(duration), tweenScale(layer, target, duration), plus accumulated worldTime and heroTime. Enemies, projectiles, world particles, petals, tree sway and lantern flicker use the world clock; the hero, his skills, his FX and cooldowns use the hero clock; UI uses real time. Q targeting sets both scales to 0.15; the Demontime cast sets worldScale to 0; hitstop zeroes both briefly (except during the ult cast). Shader-driven animation (tree sway, seam pulse, mist) reads worldTime so it freezes too.
- Voxel builder: parts are lists of boxes in integer voxel units {p:[x,y,z], s:[w,h,d], c:'paletteKey', e?:emissiveIntensity}, merged into one geometry per part (one opaque mesh + one emissive mesh), with helpers mirrorX(boxes), deterministic per-box color jitter, and optional removal of fully hidden interior boxes. Every box snaps to its part's block grid (voxelSize per part: VOXEL, BOSS_VOXEL or ENV_VOXEL). The box list is kept on the part so death shatter can spawn chunks from it. Characters are rigid-skinned: all parts of a rig merge into one opaque + one emissive SkinnedMesh, each vertex bound to its part's joint, so named nodes are joints (2 draw calls per character).
- Environment: static props merged per material, repeated props instanced, petals and particles in InstancedMesh pools.
- Performance: 60 fps on a mid-range gaming laptop at 1080p. Pooled FX, no per-frame allocations in hot loops where avoidable.

## 13. Project conventions (also in CLAUDE.md)
- Every tunable number lives in `src/config.js`, grouped by system, with a short comment. No magic numbers in gameplay code.
- Folders: src/core (engine, time, input, loop, post), src/world (map, trees, petals, sky), src/voxel (builder, palettes, models), src/anim, src/entities, src/combat, src/skills, src/fx, src/game (waves, progression), src/ui, src/debug.
- Each entity has update(dt) and picks its clock explicitly.
- Hitboxes are 2D on XZ (circle, sector, oriented rectangle). Arena bounds are a circle.
- Never break earlier features; each stage is an update to the same game.
- Keep the debug panel and hotkeys working and extend them every stage.
- At the end of each stage: update docs/PROGRESS.md, make sure `npm run build` succeeds, commit "Stage N: <summary>".

## 14. Debug tools
lil-gui panel toggled with the backquote key, plus an FPS and draw-call counter. Hotkeys (only while debug is on): 1/2/3 spawn Ronin/Teppo/Tate, 4/5/6 spawn bosses, K kill all enemies, G god mode, N next wave, L gain a level, C reset cooldowns, M model viewer (C also refills the dash), T cycle time scale 1 / 0.25 / 0.05, F photo mode (hide hero, enemies and UI), O debug orbit camera (toggle; always returns to the game camera). The Camera folder also holds the follow-camera tunables and the V toggle.

## 15. Stage roadmap
- Stage 0 — Setup: project, engine, fixed camera, post-processing, time system, input, voxel builder, placeholder arena and hero, debug tools.
- Stage 1 — Map: the circular sakura shrine arena, trees, petals, sky, lighting, atmosphere.
- Stage 2 — Models: blocky voxel hero and enemies, rigs, animation system, model viewer.
- Stage 3 — Combat: combat core, whip-sword passive, FX library, enemy AI, waves, EXP.
- Stage 4 — Skills: Thunderclaw, Shatter → Overdrive, Demontime.
- Stage 5 — Finish: 3 bosses, level-up cards, full HUD, screens, polish, performance.
