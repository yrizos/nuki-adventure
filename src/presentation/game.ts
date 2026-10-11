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
import { LevelPicker } from './level-picker';
import { drawObstacles } from './obstacle-overlay';
import { Sound } from './sound';
import { StartScreen } from './start-screen';

export { messages } from './game-session';

const wobbleSwing = 12;
const wobbleBurst = 24;
export const wobbleEvery = 60;

// A sine swing inside a sine envelope eases in and out, and the rests between bursts keep it a hint instead of a buzz.
export function aButtonWobble(age: number): number {
  const frame = age % wobbleEvery;
  if (frame >= wobbleBurst) return 0;
  return Math.sin((2 * Math.PI * frame) / wobbleSwing) * Math.sin((Math.PI * frame) / wobbleBurst);
}

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
  const levelPicker = new LevelPicker(root);
  const navigator = new GameNavigator(
    levels,
    progress,
    (level, report) => new GameSession(level, controls, sound, progress, report),
    {
      showStartScreen: () => {
        levelPicker.hide();
        announcement.textContent = '';
        setActionButtonsEnabled(true);
        startScreen.show();
      },
      animateStartScreen: (framesOpen) => startScreen.animate(framesOpen),
      showLevelPicker: () => {
        startScreen.hide();
        setActionButtonsEnabled(true);
        levelPicker.show(progress.view().levels);
      },
      showLevel: (usesA) => {
        startScreen.hide();
        levelPicker.hide();
        // Only a gate answers A and nothing in a level answers B, so a button stays disabled where pressing it does nothing.
        actionButtons.a.disabled = !usesA;
        actionButtons.b.disabled = true;
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
  connectGameSwitches(root, sound, () => {
    sound.hum(0);
    navigator.openStartScreen();
  });
  navigator.openStartScreen();

  // Counting from when the prompt starts makes every burst, and its chime, begin at once instead of mid-cycle.
  let promptAge: number | null = null;
  const tick = (): void => {
    controls.advance();
    navigator.tick();
    promptAge = navigator.session?.promptsA ? (promptAge ?? -1) + 1 : null;
    if (promptAge !== null && promptAge % wobbleEvery === 0) sound.hint();
    actionButtons.a.style.setProperty('--wobble', String(promptAge === null ? 0 : aButtonWobble(promptAge)));
    // Completing a level replaces the session during its own tick, so the message comes from whichever level is now open.
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
