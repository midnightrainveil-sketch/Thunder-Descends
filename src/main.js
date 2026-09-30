import { Engine } from './core/Engine.js';
import { CameraRig } from './core/CameraRig.js';
import { GameTime } from './core/GameTime.js';
import { Input } from './core/Input.js';
import { Loop } from './core/Loop.js';
import { PostFX } from './core/PostFX.js';
import { Game } from './game/Game.js';
import { UI } from './ui/UI.js';
import { DebugPanel } from './debug/DebugPanel.js';
import { CONFIG } from './config.js';

const container = document.getElementById('game');
const uiRoot = document.getElementById('ui');
document.addEventListener('contextmenu', (e) => e.preventDefault());

const engine = new Engine(container);
const rig = new CameraRig();
engine.onResize((w, h) => rig.resize(w, h));
const time = new GameTime();
const input = new Input(engine.renderer.domElement);
const postFX = new PostFX(engine, rig);
const game = new Game({ engine, rig, postFX });
engine.onResize(() => game.onCameraChanged()); // after rig.resize (handlers run in order)
const ui = new UI(uiRoot);
const debug = new DebugPanel({ engine, rig, postFX, time, game, ui, input });

// Frame order: input → time → game update → FX update → camera → render → UI.
const loop = new Loop((rawDt) => {
  engine.renderer.info.reset();

  input.update(rig.activePickCamera);
  debug.handleHotkeys(input);

  time.update(rawDt);

  game.update(time, input);

  game.updateFX(time, input);
  postFX.update(time.realDt);
  debug.update(time.realDt);

  rig.update(time.realDt);

  postFX.render();

  ui.update(time.realDt);
  debug.stats.update(rawDt, engine.renderer, time, debug.statsExtra());
  input.endFrame();
});
loop.start();

// Handy for poking at things from the console during development.
if (import.meta.env.DEV) window.KUROGANE = { CONFIG, engine, rig, time, input, postFX, game, ui, debug };
