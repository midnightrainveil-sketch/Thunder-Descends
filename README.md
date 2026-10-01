# Thunder Descends

A browser 3D voxel arena action game: a mecha samurai with a whip-sword fights waves of robots
and three bosses on a circular sakura shrine at night. Built with Vite, vanilla JavaScript and
three.js; the production build is a single self-contained `dist/index.html`.

## Controls
| Input | Action |
|---|---|
| WASD | Move (camera-relative; the hero faces where he moves) |
| Mouse | Turn the third-person camera; attacks and skills aim at the screen center |
| ← → | Turn the camera (keyboard) |
| Scroll wheel | Zoom the camera in / out |
| V | Switch third-person ⇄ fixed overview camera |
| Hold left mouse | 3-hit combo — about half the swings crit into a **whip strike** |
| Shift | **Flash Step** — invulnerable dash, afterimages, 3 stacks (one every 3 s). Attack right after it to snap to the marked enemy for a heavy hit |
| Q | **Storm Grapple**: aim (time slows), click to fire, right-click / Esc cancels |
| E | **Lightning Lance**: aim (time slows), click to thrust, right-click / Esc cancels → **Blade Storm** on hit |
| R | **Zero Hour** (stop time, upgrade the blade, 7 s power buff) |
| 1 / 2 / 3 or click | Pick a level-up card |
| Esc / P | Pause (Esc also frees the mouse; click the game to grab it again) |
| Enter | Retry after defeat |

Five waves — boss, basic, boss, basic, boss (Iron Juggernaut, Shadow Fox, Storm Serpent) — to reach **Demo clear**,
then continue endlessly.

Debug (press `` ` `` to toggle the panel): 1/2/3 spawn enemies, 4/5/6 spawn bosses, K kill all,
G god mode, N next wave, L level up, C reset cooldowns, M model viewer, T time scale, O orbit
camera, F photo mode.

## Play (release package)
Download or build `release/ThunderDescends-1.0.0.zip`, unzip it anywhere, then:
- **Windows:** double-click `play-windows.bat` (or `index.html`)
- **Linux:** run `./play-linux.sh` (or open `index.html` in your browser)

No install, no server, works offline. Needs a desktop browser with WebGL2 (Chrome, Edge,
Firefox, Chromium).

## Develop
```bash
npm install
npm run dev      # dev server with hot reload
npm run build    # → dist/index.html (single file, open it directly in a browser)
npm run package  # → release/ThunderDescends-<version>.zip (game + Windows/Linux launchers)
```

All tunable numbers live in `src/config.js`. Design spec: `docs/GAME_SPEC.md`; build log:
`docs/PROGRESS.md`.
