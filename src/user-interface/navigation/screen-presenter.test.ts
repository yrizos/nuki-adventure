import { expect, test, vi } from 'vitest';
import { titleRevealLength } from '../screens/menu-screen';
import { presentScreens, type ScreenPresenterParts } from './screen-presenter';

function presented(view = { continueLevel: null as string | null, hasProgress: false }) {
  const parts = {
    screen: { classList: { add: vi.fn(), remove: vi.fn() } },
    announcement: { textContent: 'a message' },
    actionButtons: { a: { disabled: true }, b: { disabled: true } },
    controls: { releaseButtons: vi.fn() },
    sound: { hum: vi.fn(), music: vi.fn() },
    holdToSkip: { listen: vi.fn(), stop: vi.fn() },
    menuScreen: { show: vi.fn(), hide: vi.fn(), animate: vi.fn() },
    levelPicker: { show: vi.fn(), hide: vi.fn(), close: vi.fn(), advance: vi.fn(), prepare: vi.fn() },
    endScreen: { show: vi.fn(), hide: vi.fn(), animate: vi.fn() },
    progress: { view: vi.fn(() => view) },
  };
  return { parts, screens: presentScreens(parts as unknown as ScreenPresenterParts) };
}

test('the intro replaces every other screen, listens for a skip and goes quiet', () => {
  const { parts, screens } = presented();
  screens.showIntro();
  expect(parts.menuScreen.hide).toHaveBeenCalled();
  expect(parts.levelPicker.hide).toHaveBeenCalled();
  expect(parts.endScreen.hide).toHaveBeenCalled();
  expect(parts.screen.classList.add).toHaveBeenCalledWith('intro-open');
  expect(parts.holdToSkip.listen).toHaveBeenCalled();
  expect(parts.sound.hum).toHaveBeenCalledWith(0);
  expect(parts.sound.music).toHaveBeenCalledWith(null);
});

test('the menu screen leaves the intro, clears the message and offers what the player can continue', () => {
  const { parts, screens } = presented({ continueLevel: 'second', hasProgress: true });
  screens.showMenuScreen();
  expect(parts.screen.classList.remove).toHaveBeenCalledWith('intro-open');
  expect(parts.holdToSkip.stop).toHaveBeenCalled();
  expect(parts.levelPicker.hide).toHaveBeenCalled();
  expect(parts.endScreen.hide).toHaveBeenCalled();
  expect(parts.announcement.textContent).toBe('');
  expect([parts.actionButtons.a.disabled, parts.actionButtons.b.disabled]).toEqual([false, false]);
  expect(parts.menuScreen.show).toHaveBeenCalledWith({ canContinue: true, hasProgress: true });
  expect(parts.sound.hum).toHaveBeenCalledWith(0);
  expect(parts.sound.music).toHaveBeenCalledWith(null);
});

test('the menu screen offers no continue when nothing is in progress', () => {
  const { parts, screens } = presented();
  screens.showMenuScreen();
  expect(parts.menuScreen.show).toHaveBeenCalledWith({ canContinue: false, hasProgress: false });
});

test('the menu screen moves the level picker on the same frames', () => {
  const { parts, screens } = presented();
  screens.showMenuScreen();
  screens.animateMenuScreen(3);
  expect(parts.menuScreen.animate).toHaveBeenCalledWith(3);
  expect(parts.levelPicker.advance).toHaveBeenCalledTimes(1);
});

test('the level picker waits for the title to fade in before it prepares its cards', () => {
  const { parts, screens } = presented({ continueLevel: 'first', hasProgress: true });
  screens.showMenuScreen();
  screens.animateMenuScreen(titleRevealLength - 1);
  expect(parts.levelPicker.prepare).not.toHaveBeenCalled();
  screens.animateMenuScreen(titleRevealLength);
  expect(parts.levelPicker.prepare).toHaveBeenCalledWith({ continueLevel: 'first', hasProgress: true });
});

test('opening the level picker enables the buttons and shows the saved progress', () => {
  const { parts, screens } = presented({ continueLevel: 'first', hasProgress: true });
  screens.showLevelPicker();
  expect([parts.actionButtons.a.disabled, parts.actionButtons.b.disabled]).toEqual([false, false]);
  expect(parts.levelPicker.show).toHaveBeenCalledWith({ continueLevel: 'first', hasProgress: true });
  expect(parts.sound.music).toHaveBeenCalledWith(null);
});

test('closing and animating the level picker pass straight through', () => {
  const { parts, screens } = presented();
  screens.closeLevelPicker();
  screens.animateLevelPicker();
  expect(parts.levelPicker.close).toHaveBeenCalledTimes(1);
  expect(parts.levelPicker.advance).toHaveBeenCalledTimes(1);
});

test('the end screen clears the message and plays the end tune', () => {
  const { parts, screens } = presented();
  screens.showEndScreen();
  screens.animateEndScreen(4, 2);
  expect(parts.announcement.textContent).toBe('');
  expect(parts.endScreen.show).toHaveBeenCalled();
  expect(parts.sound.hum).toHaveBeenCalledWith(0);
  expect(parts.sound.music).toHaveBeenCalledWith('end');
  expect(parts.endScreen.animate).toHaveBeenCalledWith(4, 2);
});

test('a level hides every screen, plays the game tune and enables only the buttons it uses', () => {
  const { parts, screens } = presented();
  screens.showLevel(true, false);
  expect(parts.screen.classList.remove).toHaveBeenCalledWith('intro-open');
  expect(parts.holdToSkip.stop).toHaveBeenCalled();
  expect(parts.menuScreen.hide).toHaveBeenCalled();
  expect(parts.levelPicker.hide).toHaveBeenCalled();
  expect(parts.endScreen.hide).toHaveBeenCalled();
  expect(parts.sound.music).toHaveBeenCalledWith('game');
  expect([parts.actionButtons.a.disabled, parts.actionButtons.b.disabled]).toEqual([false, true]);
});

test('the press that chose a level is released so it does not act inside it', () => {
  const { parts, screens } = presented();
  screens.showLevel(true, true);
  expect(parts.controls.releaseButtons).toHaveBeenCalledTimes(1);
});
