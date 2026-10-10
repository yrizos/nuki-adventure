import type { ManageProgress } from '../application/manage-progress';
import { panelArt } from './art/panel';
import { artUrl } from './canvas-art';
import { Controls } from './controls';
import { element } from './dom';
import { GameLoop } from './game-loop';
import { GameNavigator } from './game-navigator';
import { GameSession, type PlayableLevel } from './game-session';
import { connectGameSwitches } from './game-switches';
import { GameView } from './game-view';
import { LevelEndWindow } from './level-end';
import { LevelPicker } from './level-picker';
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
  const levelPicker = new LevelPicker(root);
  const navigator = new GameNavigator(
    levels,
    progress,
    (level, report) => new GameSession(level, controls, sound, levelEnd, progress, report),
    {
      showStartScreen: () => {
        levelEnd.hide();
        levelPicker.hide();
        announcement.textContent = '';
        startScreen.show();
      },
      showLevelPicker: () => {
        startScreen.hide();
        levelPicker.show(progress.view().levels);
      },
      showLevel: () => {
        startScreen.hide();
        levelPicker.hide();
        // A press that chose the level must not also act inside it.
        controls.takePress('a');
        controls.takePress('b');
      },
    },
  );
  startScreen.whenNewGame(() => navigator.play(levels[0]!.id));
  startScreen.whenPickingLevel(() => navigator.openLevelPicker());
  levelPicker.whenChosen((level) => navigator.play(level));
  levelPicker.whenBack(() => navigator.openStartScreen());
  connectGameSwitches(root, sound, () => navigator.openStartScreen());
  levelEnd.whenContinued(() => navigator.session?.continuePlaying());
  navigator.openStartScreen();

  const tick = (): void => {
    controls.advance();
    navigator.session?.tick();
    // Continuing can replace the session during its own tick, so the message comes from whichever level is now open.
    const spoken = navigator.session?.messageText ?? '';
    if (announcement.textContent !== spoken) announcement.textContent = spoken;
  };

  const showObstacles = import.meta.env.DEV && new URLSearchParams(window.location.search).has('obstacles');
  const render = (tickProgress: number): void => {
    const playing = navigator.session;
    if (!playing) return;
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
