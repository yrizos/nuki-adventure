import type { ManageProgress } from '../../progress';
import { panelArt } from '../graphics/panel';
import { artUrl } from '../graphics/canvas-art';
import { Controls } from '../input/controls';
import { element } from '../page/dom';
import { EndScreen } from '../screens/end-screen';
import { GameLoop } from './game-loop';
import { GameNavigator } from '../navigation/game-navigator';
import { presentScreens } from '../navigation/screen-presenter';
import { GameSession, type PlayableLevel } from '../session/game-session';
import { PromptWobble } from '../session/prompt-wobble';
import { connectGameSwitches } from '../page/game-switches';
import { watchPageLifecycle } from '../page/page-lifecycle';
import { GameView } from './game-view';
import { HoldToSkip } from '../input/hold-to-skip';
import { Intro } from '../screens/intro';
import { LevelPicker } from '../screens/level-picker';
import { drawObstacles } from '../world/painting/obstacle-overlay';
import { Sound } from '../audio/sound';
import { MenuScreen } from '../screens/menu-screen';

export { messages } from '../session/game-session';

export function startGame(
  root: Document,
  levels: readonly PlayableLevel[],
  progress: Pick<
    ManageProgress,
    'view' | 'levelAfter' | 'reach' | 'complete' | 'reset' | 'suspend' | 'levelInProgress'
  >,
  random: () => number,
): void {
  const screen = element<HTMLElement>(root, '.screen');
  for (const [name, art] of Object.entries(panelArt))
    screen.style.setProperty(`--art-${name}`, `url(${artUrl(root, art)})`);
  // Every data url is encoded before the first paint, so only the buttons that can be disabled get a faded one.
  for (const name of ['button-a', 'button-b', 'continue', 'pick-level', 'scroll-up', 'scroll-down'])
    screen.style.setProperty(`--art-${name}-faded`, `url(${artUrl(root, panelArt[name]!, 'faded')})`);
  const view = element<HTMLElement>(root, '.game-view');
  const canvas = element<HTMLCanvasElement>(root, '.game-view canvas');
  const actionButtons = {
    a: element<HTMLButtonElement>(root, '.button-a'),
    b: element<HTMLButtonElement>(root, '.button-b'),
  };
  const controls = new Controls(
    element(root, '.control-panel'),
    element(root, '.joystick'),
    element(root, '.knob'),
    actionButtons,
  );
  const announcement = element<HTMLElement>(root, '.announcement');
  const gameView = new GameView(screen, view, canvas);

  const sound = new Sound(window);
  const menuScreen = new MenuScreen(root);
  const levelPicker = new LevelPicker(
    root,
    levels.map((level) => ({ id: level.id, view: () => level.start().view(level.id) })),
    random,
  );
  const endScreen = new EndScreen(root);
  const holdToSkip = new HoldToSkip(window, root.body);
  const navigator = new GameNavigator(
    levels,
    progress,
    (level, report, suspended) => new GameSession(level, controls, sound, progress, report, random, suspended),
    () => new Intro(holdToSkip),
    presentScreens({
      screen,
      announcement,
      actionButtons,
      controls,
      sound,
      holdToSkip,
      menuScreen,
      levelPicker,
      endScreen,
      progress,
    }),
  );
  menuScreen.whenContinuing(() => {
    const level = progress.view().continueLevel;
    if (level) navigator.play(level, progress.levelInProgress() ?? undefined);
  });
  menuScreen.whenNewGame(() => {
    progress.reset();
    navigator.openIntro();
  });
  endScreen.whenLeaving(() => navigator.leaveEndScreen());
  menuScreen.whenPickingLevel(() => navigator.openLevelPicker());
  levelPicker.whenChosen((level) => navigator.play(level));
  levelPicker.whenBack(() => navigator.closeLevelPicker());
  connectGameSwitches(root, sound, () => {
    // Escape is one of the keys that leave the end screen, so it leaves through the same fade.
    if (navigator.state === 'end-screen') return;
    navigator.openMenuScreen();
  });
  navigator.openMenuScreen();

  const promptWobble = new PromptWobble(navigator, actionButtons, sound);
  const tick = (): void => {
    controls.advance();
    navigator.tick();
    promptWobble.advance();
    // Completing a level replaces the session during its own tick, so the message comes from whichever level is now open.
    const spoken = (navigator.session ?? navigator.intro)?.messageText ?? '';
    if (announcement.textContent !== spoken) announcement.textContent = spoken;
  };

  const showObstacles = import.meta.env.DEV && new URLSearchParams(window.location.search).has('obstacles');
  const render = (tickProgress: number): void => {
    const intro = navigator.intro;
    if (intro) gameView.paint(intro, tickProgress);
    const playing = navigator.session;
    if (!playing) return;
    gameView.paint(
      playing,
      tickProgress,
      showObstacles ? (context) => drawObstacles(context, playing.level) : undefined,
    );
  };

  const gameLoop = new GameLoop(tick, render, performance.now());
  watchPageLifecycle(
    root,
    window,
    () => navigator.suspend(),
    () => gameLoop.rest(),
  );
  const loop = (now: number): void => {
    gameLoop.advance(now);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  root.querySelector('.loader')?.remove();
}
