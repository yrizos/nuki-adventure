import type { ManageProgress } from '../../progress';
import { panelArt } from '../graphics/panel';
import { artUrl } from '../graphics/canvas-art';
import { Controls } from '../input/controls';
import { element } from './dom';
import { EndScreen } from '../screens/end-screen';
import { GameLoop } from './game-loop';
import { GameNavigator } from './game-navigator';
import { GameSession, type PlayableLevel } from './game-session';
import { connectGameSwitches } from './game-switches';
import { GameView } from './game-view';
import { HoldToSkip } from '../input/hold-to-skip';
import { Intro } from '../screens/intro';
import { LevelPicker } from '../screens/level-picker';
import { drawObstacles } from '../world/obstacle-overlay';
import { Sound } from '../audio/sound';
import { StartScreen } from '../screens/start-screen';

export { messages } from './game-session';

const wobbleSwing = 12;
const wobbleBurst = 24;
export const wobbleEvery = 60;

// A sine swing inside a sine envelope eases in and out, and the rests between bursts keep it a hint instead of a buzz.
export function buttonWobble(age: number): number {
  const frame = age % wobbleEvery;
  if (frame >= wobbleBurst) return 0;
  return Math.sin((2 * Math.PI * frame) / wobbleSwing) * Math.sin((Math.PI * frame) / wobbleBurst);
}

export function startGame(
  root: Document,
  levels: readonly PlayableLevel[],
  progress: Pick<ManageProgress, 'view' | 'levelAfter' | 'reach' | 'complete' | 'reset'>,
  random: () => number,
): void {
  const screen = element<HTMLElement>(root, '.screen');
  for (const [name, art] of Object.entries(panelArt))
    screen.style.setProperty(`--art-${name}`, `url(${artUrl(root, art)})`);
  const view = element<HTMLElement>(root, '.game-view');
  const canvas = element<HTMLCanvasElement>(root, '.game-view canvas');
  const actionButtons = {
    a: element<HTMLButtonElement>(root, '.button-a'),
    b: element<HTMLButtonElement>(root, '.button-b'),
  };
  const setActionButtonsEnabled = (enabled: boolean): void => {
    actionButtons.a.disabled = !enabled;
    actionButtons.b.disabled = !enabled;
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
  const startScreen = new StartScreen(root);
  const levelPicker = new LevelPicker(
    root,
    levels.map((level) => ({ id: level.id, view: level.start().view(level.id) })),
    random,
  );
  const endScreen = new EndScreen(root);
  const holdToSkip = new HoldToSkip(window, root.body);
  const navigator = new GameNavigator(
    levels,
    progress,
    (level, report) => new GameSession(level, controls, sound, progress, report, random),
    () => new Intro(holdToSkip),
    {
      showIntro: () => {
        startScreen.hide();
        levelPicker.hide();
        endScreen.hide();
        screen.classList.add('intro-open');
        holdToSkip.listen();
        sound.hum(0);
        sound.music(null);
      },
      showStartScreen: () => {
        screen.classList.remove('intro-open');
        holdToSkip.stop();
        levelPicker.hide();
        endScreen.hide();
        announcement.textContent = '';
        setActionButtonsEnabled(true);
        const view = progress.view();
        startScreen.show({ canContinue: view.continueLevel !== null, hasProgress: view.hasProgress });
        sound.hum(0);
        sound.music(null);
      },
      // The level picker dithers out over the start screen after it closes, so both move on the same frames.
      animateStartScreen: (framesOpen) => {
        startScreen.animate(framesOpen);
        levelPicker.advance();
      },
      showLevelPicker: () => {
        setActionButtonsEnabled(true);
        levelPicker.show(progress.view());
        sound.music(null);
      },
      closeLevelPicker: () => levelPicker.close(),
      animateLevelPicker: () => levelPicker.advance(),
      showEndScreen: () => {
        announcement.textContent = '';
        endScreen.show();
        sound.hum(0);
        sound.music('end');
      },
      animateEndScreen: (framesOpen, framesLeaving) => endScreen.animate(framesOpen, framesLeaving),
      showLevel: (usesA, usesB) => {
        startScreen.hide();
        levelPicker.hide();
        endScreen.hide();
        sound.music('game');
        actionButtons.a.disabled = !usesA;
        actionButtons.b.disabled = !usesB;
        // A press that chose the level must not also act inside it, nor count as held there.
        controls.releaseButtons();
      },
    },
  );
  startScreen.whenContinuing(() => {
    const level = progress.view().continueLevel;
    if (level) navigator.play(level);
  });
  startScreen.whenNewGame(() => {
    progress.reset();
    navigator.play(levels[0]!.id);
  });
  endScreen.whenLeaving(() => navigator.leaveEndScreen());
  startScreen.whenPickingLevel(() => navigator.openLevelPicker());
  levelPicker.whenChosen((level) => navigator.play(level));
  levelPicker.whenBack(() => navigator.closeLevelPicker());
  connectGameSwitches(root, sound, () => {
    // Escape is one of the keys that leave the end screen, so it leaves through the same fade.
    if (navigator.state === 'end-screen') return;
    navigator.openStartScreen();
  });
  if (progress.view().hasProgress) navigator.openStartScreen();
  else navigator.openIntro();

  // Counting from when the prompt starts makes every burst, and its chime, begin at once instead of mid-cycle.
  const promptAges: Record<'a' | 'b', number | null> = { a: null, b: null };
  const tick = (): void => {
    controls.advance();
    navigator.tick();
    for (const button of ['a', 'b'] as const) {
      const age = navigator.session?.prompts(button) ? (promptAges[button] ?? -1) + 1 : null;
      promptAges[button] = age;
      actionButtons[button].style.setProperty('--wobble', String(age === null ? 0 : buttonWobble(age)));
    }
    // Both buttons can start a burst on the same frame, so they share one chime.
    const bursts = Object.values(promptAges).filter((age) => age !== null && age % wobbleEvery === 0);
    if (bursts.length > 0) sound.hint(bursts.includes(0));
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
  const loop = (now: number): void => {
    gameLoop.advance(now);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
