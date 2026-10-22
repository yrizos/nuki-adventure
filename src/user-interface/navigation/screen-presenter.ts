import type { ManageProgress } from '../../progress';
import type { Sound } from '../audio/sound';
import type { Controls } from '../input/controls';
import type { HoldToSkip } from '../input/hold-to-skip';
import type { EndScreen } from '../screens/end-screen';
import type { LevelPicker } from '../screens/level-picker';
import { type MenuScreen, titleRevealLength } from '../screens/menu-screen';
import type { Screens } from './game-navigator';

export interface ScreenPresenterParts {
  readonly screen: HTMLElement;
  readonly announcement: HTMLElement;
  readonly actionButtons: { readonly a: HTMLButtonElement; readonly b: HTMLButtonElement };
  readonly controls: Controls;
  readonly sound: Sound;
  readonly holdToSkip: HoldToSkip;
  readonly menuScreen: MenuScreen;
  readonly levelPicker: LevelPicker;
  readonly endScreen: EndScreen;
  readonly progress: Pick<ManageProgress, 'view'>;
}

export function presentScreens(parts: ScreenPresenterParts): Screens {
  const { screen, announcement, actionButtons, controls, sound, holdToSkip, menuScreen, levelPicker, endScreen } =
    parts;
  const { progress } = parts;
  let menuProgress = progress.view();
  const setActionButtonsEnabled = (enabled: boolean): void => {
    actionButtons.a.disabled = !enabled;
    actionButtons.b.disabled = !enabled;
  };
  const leaveIntro = (): void => {
    screen.classList.remove('intro-open');
    holdToSkip.stop();
  };
  return {
    showIntro: () => {
      menuScreen.hide();
      levelPicker.hide();
      endScreen.hide();
      screen.classList.add('intro-open');
      holdToSkip.listen();
      sound.hum(0);
      sound.music(null);
    },
    showMenuScreen: () => {
      leaveIntro();
      levelPicker.hide();
      endScreen.hide();
      announcement.textContent = '';
      setActionButtonsEnabled(true);
      menuProgress = progress.view();
      menuScreen.show({ canContinue: menuProgress.continueLevel !== null, hasProgress: menuProgress.hasProgress });
      sound.hum(0);
      sound.music(null);
    },
    // The level picker dithers out over the menu screen after it closes, so both move on the same frames.
    animateMenuScreen: (framesOpen) => {
      menuScreen.animate(framesOpen);
      levelPicker.advance();
      // Waiting for the title to fade in keeps that animation smooth.
      if (framesOpen >= titleRevealLength) levelPicker.prepare(menuProgress);
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
      leaveIntro();
      menuScreen.hide();
      levelPicker.hide();
      endScreen.hide();
      sound.music('game');
      actionButtons.a.disabled = !usesA;
      actionButtons.b.disabled = !usesB;
      // A press that chose the level must not also act inside it, nor count as held there.
      controls.releaseButtons();
    },
  };
}
