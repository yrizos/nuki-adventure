import { expect, test, vi } from 'vitest';
import { buttonWobble, PromptWobble, wobbleEvery } from './prompt-wobble';

function wobbling(prompted: { a: boolean; b: boolean } = { a: false, b: false }) {
  const style = { a: { setProperty: vi.fn() }, b: { setProperty: vi.fn() } };
  const hint = vi.fn();
  const ages: Record<'a' | 'b', number | null> = { a: null, b: null };
  const navigator = { session: { promptAge: (button: 'a' | 'b') => ages[button] } as unknown };
  const subject = new PromptWobble(
    navigator as ConstructorParameters<typeof PromptWobble>[0],
    { a: { style: style.a }, b: { style: style.b } } as unknown as ConstructorParameters<typeof PromptWobble>[1],
    { hint },
  );
  const wobble = {
    advance: (): void => {
      for (const button of ['a', 'b'] as const) ages[button] = prompted[button] ? (ages[button] ?? -1) + 1 : null;
      subject.advance();
    },
  };
  return { wobble, style, hint, navigator, prompted };
}

test('wobbles a button smoothly within one panel pixel in bursts that start still and rest between', () => {
  const offsets = Array.from({ length: wobbleEvery }, (_, age) => buttonWobble(age));
  expect(offsets[0]).toBe(0);
  expect(offsets.every((offset) => Math.abs(offset) <= 1)).toBe(true);
  expect(offsets.slice(1).some((offset, index) => Math.abs(offset - offsets[index]!) > 0.5)).toBe(false);
  expect(offsets.slice(24).every((offset) => offset === 0)).toBe(true);
  expect(buttonWobble(wobbleEvery + 3)).toBe(offsets[3]);
});

test('a prompted button wobbles by its age and an unprompted one stays still', () => {
  const { wobble, style } = wobbling({ a: true, b: false });
  for (let age = 0; age < 6; age++) wobble.advance();
  expect(style.a.setProperty).toHaveBeenLastCalledWith('--wobble', String(buttonWobble(5)));
  expect(style.b.setProperty).toHaveBeenLastCalledWith('--wobble', '0');
});

test('the first burst chimes high and the later ones chime plain', () => {
  const { wobble, hint } = wobbling({ a: true, b: false });
  wobble.advance();
  expect(hint).toHaveBeenCalledTimes(1);
  expect(hint).toHaveBeenLastCalledWith(true);
  for (let age = 1; age < wobbleEvery; age++) wobble.advance();
  expect(hint).toHaveBeenCalledTimes(1);
  wobble.advance();
  expect(hint).toHaveBeenCalledTimes(2);
  expect(hint).toHaveBeenLastCalledWith(false);
});

test('two buttons that start together share one chime', () => {
  const { wobble, hint } = wobbling({ a: true, b: true });
  wobble.advance();
  expect(hint).toHaveBeenCalledTimes(1);
});

test('a prompt that ends stops the wobble and the next one starts a new burst', () => {
  const { wobble, style, hint, prompted } = wobbling({ a: true, b: false });
  for (let age = 0; age < 10; age++) wobble.advance();
  prompted.a = false;
  wobble.advance();
  expect(style.a.setProperty).toHaveBeenLastCalledWith('--wobble', '0');
  prompted.a = true;
  hint.mockClear();
  wobble.advance();
  expect(hint).toHaveBeenCalledWith(true);
});

test('nothing wobbles or chimes while no level is open', () => {
  const { wobble, style, hint, navigator } = wobbling({ a: true, b: true });
  navigator.session = null;
  wobble.advance();
  expect(style.a.setProperty).toHaveBeenLastCalledWith('--wobble', '0');
  expect(hint).not.toHaveBeenCalled();
});
