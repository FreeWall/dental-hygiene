import { Stage } from './stage.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';
import { Game } from './game.js';
import { PATIENTS } from './patients.js';

const stage = new Stage(document.getElementById('c'));
const audio = new Audio();
const ui = new UI(audio);
const game = new Game(stage, audio, ui);
ui.attach(game);

// pozadí úvodní obrazovky: fantom v ordinaci
game.load(PATIENTS[0]);
game.menuView();
game.rig.set({ ...game.rig.goal, target: game.rig.targetGoal.clone() }, true);

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  stage.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.getElementById('loading').remove();
window.__game = game;
window.__ui = ui;
window.__ready = true;

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
