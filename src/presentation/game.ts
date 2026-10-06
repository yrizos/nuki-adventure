import { panelArt } from './art/panel';
import { artUrl } from './canvas-art';
import { Controls } from './controls';
import { element } from './dom';
import { GameLoop } from './game-loop';
import { GameSession, type PlayableLevel } from './game-session';
import { connectGameSwitches } from './game-switches';
import { GameView } from './game-view';
import { LevelEndWindow } from './level-end';
import { Sound } from './sound';

export { messages } from './game-session';

export function startGame(root: Document, levels: readonly PlayableLevel[]): void {
  const screen = element<HTMLElement>(root, '.screen');
  for (const [name, art] of Object.entries(panelArt))
    screen.style.setProperty(`--art-${name}`, `url(${artUrl(root, art)})`);
  const view = element<HTMLElement>(root, '.game-view');
  const canvas = element<HTMLCanvasElement>(root, '.game-view canvas');
  const controls = new Controls(element(root, '.control-panel'), element(root, '.joystick'), element(root, '.knob'), {
    a: element(root, '.button-a'),
    b: element(root, '.button-b'),
  });
  const announcement = element<HTMLElement>(root, '.announcement');
  const gameView = new GameView(screen, view, canvas);

  const sound = new Sound(window);
  connectGameSwitches(root, sound);
  const levelEnd = new LevelEndWindow(root);
  const session = new GameSession(levels, controls, sound, levelEnd);
  levelEnd.whenContinued(() => session.continuePlaying());

  const tick = (): void => {
    session.tick();
    const spoken = session.messageText;
    if (announcement.textContent !== spoken) announcement.textContent = spoken;
  };

  const render = (): void => {
    controls.advance();
    gameView.paint(session);
  };

  const gameLoop = new GameLoop(tick, render, performance.now());
  const loop = (now: number): void => {
    gameLoop.advance(now);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
