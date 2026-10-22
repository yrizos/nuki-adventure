import { expect, test } from 'vitest';
import { glyphs } from '../graphics/font';
import { MessageBox, wrap } from './message-box';
import { messages } from '../session/game-session';
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

function paintedRows(picture: Picture): readonly number[] {
  const rows = new Set<number>();
  for (let index = 3; index < picture.pixels.length; index += 4)
    if (picture.pixels[index] !== 0) rows.add(Math.floor((index - 3) / 4 / picture.width));
  return [...rows].toSorted((a, b) => a - b);
}

function boxCount(rows: readonly number[]): number {
  return rows.filter((row, index) => index === 0 || row !== rows[index - 1]! + 1).length;
}

test('shows one box per line, the next line after a delay', () => {
  const box = new MessageBox();
  box.show(messages.colorsBack, 0);
  const early = new Picture(224, 224);
  box.paint(early, 15);
  expect(boxCount(paintedRows(early))).toBe(1);
  const late = new Picture(224, 224);
  box.paint(late, 100);
  expect(boxCount(paintedRows(late))).toBe(2);
});

test('pushes the earlier box up when the next line appears at the bottom', () => {
  const box = new MessageBox();
  box.show(messages.colorsBack, 0);
  const early = new Picture(224, 224);
  box.paint(early, 15);
  const late = new Picture(224, 224);
  box.paint(late, 100);
  expect(paintedRows(late).at(-1)).toBe(paintedRows(early).at(-1));
  expect(paintedRows(late)[0]).toBeLessThan(paintedRows(early)[0]!);
});

test('fits the box to the width of its text', () => {
  const picture = new Picture(224, 224);
  const box = new MessageBox();
  box.show(messages.gateStuck, 0);
  box.paint(picture, 15);
  const columns = new Set<number>();
  for (let index = 3; index < picture.pixels.length; index += 4)
    if (picture.pixels[index] !== 0) columns.add(((index - 3) / 4) % picture.width);
  expect(Math.min(...columns)).toBe(8);
  expect(Math.max(...columns)).toBeLessThan(224 - 8 - 1);
});

test('glides the earlier box up over several frames as the next line rises', () => {
  const box = new MessageBox();
  box.show(messages.colorsBack, 0);
  const tops = Array.from({ length: 31 }, (_, step) => {
    const picture = new Picture(224, 224);
    box.paint(picture, 44 + step);
    return paintedRows(picture)[0]!;
  });
  const rises = tops.slice(1).map((top, step) => tops[step]! - top);
  expect(rises.every((rise) => rise >= 0)).toBe(true);
  expect(Math.max(...rises)).toBeLessThan(8);
  expect(tops[0]! - tops.at(-1)!).toBeGreaterThan(16);
});
