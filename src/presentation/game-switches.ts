import { element } from './dom';
import type { Sound } from './sound';

export function connectGameSwitches(
  root: Document,
  sound: Pick<Sound, 'on' | 'toggle'>,
  openStartScreen: () => void,
): void {
  element<HTMLButtonElement>(root, '.menu-switch').addEventListener('click', openStartScreen);
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    if (!event.repeat) openStartScreen();
  });
  const soundSwitch = element<HTMLButtonElement>(root, '.sound-switch');
  const showSound = (): void => soundSwitch.setAttribute('aria-pressed', String(sound.on));
  showSound();
  soundSwitch.addEventListener('click', () => {
    sound.toggle();
    showSound();
  });
  const fullScreenSwitch = element<HTMLButtonElement>(root, '.full-screen-switch');
  fullScreenSwitch.hidden = !root.fullscreenEnabled;
  root.addEventListener('fullscreenchange', () =>
    fullScreenSwitch.setAttribute('aria-pressed', String(root.fullscreenElement !== null)),
  );
  fullScreenSwitch.addEventListener('click', () => {
    (root.fullscreenElement ? root.exitFullscreen() : root.documentElement.requestFullscreen()).catch(() => {});
  });
}
