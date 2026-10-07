import type { ManageProgress } from '../application/manage-progress';
import { panelArt } from './art/panel';
import { artUrl } from './canvas-art';
import { Controls } from './controls';
import { element } from './dom';
import { GameLoop } from './game-loop';
import { GameSession, type PlayableLevel } from './game-session';
import { connectGameSwitches } from './game-switches';
import { GameView } from './game-view';
import { LevelEndWindow } from './level-end';
import { drawObstacles } from './obstacle-overlay';
import { Sound } from './sound';
import { StartScreen } from './start-screen';

export { messages } from './game-session';

export function startGame(
  root: Document,
  levels: readonly PlayableLevel[],
  progress: Pick<ManageProgress, 'view' | 'reach' | 'complete'>,
): void {
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
  const levelEnd = new LevelEndWindow(root);
  const startScreen = new StartScreen(root);
  let session: GameSession | null = null;
  const openStartScreen = (): void => {
    session = null;
    levelEnd.hide();
    announcement.textContent = '';
    startScreen.show(progress.view());
  };
  startScreen.whenChosen((level) => {
    startScreen.hide();
    // A press that chose the level must not also act inside it.
    controls.takePress('a');
    controls.takePress('b');
    session = new GameSession(levels, controls, sound, levelEnd, progress, level);
  });
  connectGameSwitches(root, sound, openStartScreen);
  levelEnd.whenContinued(() => session?.continuePlaying());
  openStartScreen();

  const tick = (): void => {
    controls.advance();
    if (!session) return;
    session.tick();
    const spoken = session.messageText;
    if (announcement.textContent !== spoken) announcement.textContent = spoken;
  };

  const showObstacles = import.meta.env.DEV && new URLSearchParams(window.location.search).has('obstacles');
  const render = (tickProgress: number): void => {
    if (!session) return;
    const playing = session;
    gameView.paint(
      playing,
      tickProgress,
      showObstacles ? (context) => drawObstacles(context, playing.level) : undefined,
    );
  };

  const gameLoop = new GameLoop(tick, render, performance.now());
  const loop = (now: number): void => {
    gameLoop.advance(now);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
