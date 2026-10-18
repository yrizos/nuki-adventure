import { expect, test } from 'vitest';
import { glyphs } from '../graphics/font';
import { MessageBox, wrap } from './message-box';
import { messages } from '../shell/game-session';
import { Picture } from '../graphics/picture';

test.each(Object.values(messages))('draws %s with the font inside the narrowest game view', (text) => {
  for (const character of text.replaceAll('\n', '')) expect(glyphs[character]).toBeDefined();
  const lines = wrap(text, 224 - 16);
  expect(lines.join(' ')).toBe(text.replaceAll('\n', ' '));
  for (const line of lines) expect(line.length).toBeLessThanOrEqual(26);
  const box = new MessageBox();
  box.show(text, 0);
  expect(() => box.paint(new Picture(224, 224), 16)).not.toThrow();
});

test('puts each sentence of the last orb message on a line of its own', () => {
  expect(wrap(messages.colorsBack, 224 - 16)).toEqual(['ΤΑ ΧΡΩΜΑΤΑ ΕΠΕΣΤΡΕΨΑΝ!', 'Η ΠΟΡΤΑ ΑΝΟΙΞΕ!']);
});

test('dissolves in, then dissolves away after being hidden', () => {
  const picture = new Picture(224, 224);
  const box = new MessageBox();
  const painted = (): number =>
    picture.pixels.filter((_, index) => index % 4 === 3 && picture.pixels[index] !== 0).length;
  box.show(messages.colorsBack, 0);
  box.paint(picture, 0);
  const first = painted();
  box.paint(picture, 15);
  expect(painted()).toBeGreaterThan(first);
  box.hide(20);
  expect(box.text).toBeNull();
  picture.pixels.fill(0);
  box.paint(picture, 35);
  expect(painted()).toBe(0);
});
