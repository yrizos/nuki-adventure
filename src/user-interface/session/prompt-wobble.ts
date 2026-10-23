import type { Sound } from '../audio/sound';
import type { GameNavigator } from '../navigation/game-navigator';

const wobbleSwing = 12;
export const wobbleBurst = 24;
export const wobbleEvery = 60;

// A sine swing inside a sine envelope eases in and out, and the rests between bursts keep it a hint instead of a buzz.
export function buttonWobble(age: number): number {
  const frame = age % wobbleEvery;
  if (frame >= wobbleBurst) return 0;
  return Math.sin((2 * Math.PI * frame) / wobbleSwing) * Math.sin((Math.PI * frame) / wobbleBurst);
}

export class PromptWobble {
  constructor(
    private readonly navigator: Pick<GameNavigator, 'session'>,
    private readonly actionButtons: { readonly a: HTMLButtonElement; readonly b: HTMLButtonElement },
    private readonly sound: Pick<Sound, 'hint'>,
  ) {}

  advance(): void {
    const ages = (['a', 'b'] as const).map((button) => {
      const age = this.navigator.session?.promptAge(button) ?? null;
      this.actionButtons[button].style.setProperty('--wobble', String(age === null ? 0 : buttonWobble(age)));
      return age;
    });
    // Both buttons can start a burst on the same frame, so they share one chime.
    const bursts = ages.filter((age) => age !== null && age % wobbleEvery === 0);
    if (bursts.length > 0) this.sound.hint(bursts.includes(0));
  }
}
