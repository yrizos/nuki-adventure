import { PlayLevel } from '../application/play-level';
import type { Level } from '../domain/level/level';
import { firstLevel, firstLevelId } from '../infrastructure/first-level';
import { InMemoryLevelRepository } from '../infrastructure/in-memory-level-repository';
import { secondLevel, secondLevelId } from '../infrastructure/second-level';
import { panelArt } from './art/panel';
import { Controls } from './controls';
import { GameLoop } from './game-loop';
import { GameSession } from './game-session';
import { connectGameSwitches } from './game-switches';
import { artUrl, element, GameView } from './game-view';
import { LevelEndWindow } from './level-end';
import { Sound } from './sound';

export { fitCanvas } from './game-view';
export { messages } from './game-session';

export function startGame(root: Document): void {
  const screen = element<HTMLElement>(root, '.screen');
  for (const [name, art] of Object.entries(panelArt)) screen.style.setProperty(`--art-${name}`, `url(${artUrl(root, art)})`);
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
  const playing = (create: () => Level) => () => new PlayLevel(new InMemoryLevelRepository([create()]));
  const session = new GameSession(
    [{ id: firstLevelId, start: playing(firstLevel) }, { id: secondLevelId, start: playing(secondLevel) }],
    controls,
    sound,
    { show: (result) => levelEnd.show(result), hide: () => levelEnd.hide() },
  );
  const levelEnd = new LevelEndWindow(root, () => session.continuePlaying());

  const tick = (): void => {
    session.tick();
    const spoken = session.messageText;
    if (announcement.textContent !== spoken) announcement.textContent = spoken;
  };

  const render = (): void => {
    gameView.paint(session);
  };

  const gameLoop = new GameLoop(tick, render, performance.now());
  const loop = (now: number): void => {
    gameLoop.advance(now);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
