# KUROGANE — project conventions

Before starting any stage, read docs/GAME_SPEC.md and docs/PROGRESS.md. If I change a design decision during review, update docs/GAME_SPEC.md to match.

## Conventions (spec §13)
- Every tunable number lives in `src/config.js`, grouped by system, with a short comment. No magic numbers in gameplay code.
- Folders: src/core (engine, time, input, loop, post), src/world (map, trees, petals, sky), src/voxel (builder, palettes, models), src/anim, src/entities, src/combat, src/skills, src/fx, src/game (waves, progression), src/ui, src/debug.
- Each entity has update(dt) and picks its clock explicitly.
- Hitboxes are 2D on XZ (circle, sector, oriented rectangle). Arena bounds are a circle.
- Never break earlier features; each stage is an update to the same game.
- Keep the debug panel and hotkeys working and extend them every stage.
- At the end of each stage: update docs/PROGRESS.md, make sure `npm run build` succeeds, commit "Stage N: <summary>".

## Practical notes
- `npm run dev` for development, `npm run build` → single self-contained `dist/index.html`.
- Clocks: world clock (`time.worldDt`) for enemies/projectiles/world FX/petals/trees/lanterns, hero clock (`time.heroDt`) for the hero, his skills, FX and cooldowns, real time (`time.realDt`) for UI and camera shake. Shaders that animate read `time.worldTime`.
- Voxel models are lists of integer boxes `{p, s, c, e?}` built with `buildPart()` from `src/voxel/VoxelBuilder.js`; never hand-build character or prop geometry.
- Objects that must stay in color inside the Demontime ring opt in with `postFX.addToMask(object)`.
- The map lives in `src/world/ArenaMap.js` (`game.map`): use `game.map.groundHeightAt(x, z)`, the petal API (`petalImpulse`, `petalSweep`, `petalVortex`) and `spawnGates` from `src/world/ArenaBounds.js`. Gameplay ground decals go at y ≥ 0.04 m (tiles ≤ 0.02, seams 0.022, lantern pools 0.03).
- Map composition (moon, pagoda, sky gradient, mountains) is tuned for the fixed camera; check changes from the game camera, not the orbit camera.
