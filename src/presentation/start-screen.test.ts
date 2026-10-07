import { expect, test } from 'vitest';
import type { LevelProgressView } from '../application/manage-progress';
import { Playthrough, PlayTime } from '../domain/progress/playthrough';
import { LevelId } from '../domain/shared/level-id';
import { StarCount } from '../domain/shared/star-count';
import { sprite } from './picture';
import { focusAfter, levelPickerArt, levelRowText, rowHeight, titleArt } from './start-screen';

const level = (number: number, isUnlocked: boolean, frames?: number): LevelProgressView => ({
  id: LevelId.of(`level ${number}`),
  number,
  isUnlocked,
  bestPlaythrough:
    frames === undefined ? null : Playthrough.of(PlayTime.ofFrames(frames), StarCount.of(3), StarCount.of(5)),
});

const levels = [level(1, true, 60 * 83), level(2, true), level(3, false)];

test('draws the game name from palette codes, inside the narrowest column', () => {
  const art = titleArt();
  expect(() => sprite(art)).not.toThrow();
  expect(art.rows[0]!.length).toBeLessThanOrEqual(180 - 16);
});

test('draws every row of the level picker at one width, inside the narrowest column', () => {
  const rows = levelPickerArt([...levels, level(12, true, 60 * 60 * 120)]);
  for (const row of rows) {
    expect(() => sprite(row)).not.toThrow();
    expect(row.rows).toHaveLength(rowHeight);
    expect(row.rows[0]!.length).toBe(rows[0]!.rows[0]!.length);
  }
  expect(rows[0]!.rows[0]!.length).toBeLessThanOrEqual(180 - 16);
});

test('draws a locked level as its number alone', () => {
  const [, unplayed, locked] = levelPickerArt(levels);
  expect(locked!.rows.join('')).toMatch(/q/);
  expect(locked!.rows.join('')).not.toMatch(/[tabcp]/);
  expect(unplayed!.rows.join('')).toMatch(/t/);
});

test('reads every row out for screen readers', () => {
  expect(levels.map(levelRowText)).toEqual([
    'ΕΠΙΠΕΔΟ 1. ΧΡΟΝΟΣ 1:23. ΑΣΤΕΡΙΑ 3/5.',
    'ΕΠΙΠΕΔΟ 2.',
    'ΕΠΙΠΕΔΟ 3. ΚΛΕΙΔΩΜΕΝΟ.',
  ]);
});

test.each([
  ['ArrowDown', 0, 1],
  ['ArrowRight', 0, 1],
  ['ArrowDown', 3, 3],
  ['ArrowUp', 2, 1],
  ['ArrowLeft', 2, 1],
  ['ArrowUp', 0, 0],
])('moves focus with %s from choice %s to %s of four', (key, from, to) => {
  expect(focusAfter(key, from, 4)).toBe(to);
});
