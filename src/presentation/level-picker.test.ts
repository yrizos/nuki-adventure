import { expect, test, vi } from 'vitest';
import { Playthrough, PlayTime } from '../domain/progress/playthrough';
import { LevelId } from '../domain/shared/level-id';
import { StarCount } from '../domain/shared/star-count';
import { FakeDocument, type FakeHTMLElement } from '../test-support/fake-document';
import { PixelGrid, type Art } from './art/art';
import { glyphHeight, textWidth, writeText } from './art/font';
import type { LevelProgressView } from '../application/manage-progress';
import {
  LevelPicker,
  levelPickerArt,
  levelRowText,
  playTime,
  putClock,
  putStar,
  rowHeight,
  windowFrame,
  windowLegend,
} from './level-picker';
import { faded, neutralCode, type PaletteCode } from './palette';
import { sprite } from './picture';

test.each([
  [0, '0:00'],
  [59, '0:00'],
  [60, '0:01'],
  [60 * 65, '1:05'],
  [60 * 60 * 120, '120:00'],
])('shows %s frames as %s', (frames, shown) => {
  expect(playTime(PlayTime.ofFrames(frames))).toBe(shown);
});

const level = (
  number: number,
  isUnlocked: boolean,
  frames?: number,
  stars: readonly [number, number] = [3, 5],
): LevelProgressView => ({
  id: LevelId.of(`level ${number}`),
  number,
  isUnlocked,
  lastPlaythrough:
    frames === undefined
      ? null
      : Playthrough.of(PlayTime.ofFrames(frames), StarCount.of(stars[0]), StarCount.of(stars[1])),
});

const levels = [level(1, true, 60 * 83), level(2, true), level(3, false)];

type Codes = readonly (readonly (PaletteCode | null)[])[];

const codes = (art: Art): Codes =>
  art.rows.map((row) => [...row].map((symbol) => (symbol === '.' ? null : art.legend[symbol]!)));

// A null pixel in the pattern matches any card pixel, so transparent sprite pixels do not constrain the match.
function contains(card: Codes, pattern: Codes): boolean {
  const height = pattern.length;
  const width = pattern[0]!.length;
  for (let top = 0; top + height <= card.length; top++)
    for (let left = 0; left + width <= card[0]!.length; left++)
      if (pattern.every((row, y) => row.every((code, x) => code === null || card[top + y]![left + x] === code)))
        return true;
  return false;
}

// Blank glyph pixels must show the window background, so a number drawn at another size cannot match.
function textPattern(text: string, scale: number): Codes {
  const grid = new PixelGrid(textWidth(text), glyphHeight, 'f');
  writeText(grid, text, 0, 0, 't');
  const small = codes(grid.build(windowLegend));
  return Array.from({ length: scale * glyphHeight }, (_, y) =>
    Array.from({ length: scale * textWidth(text) }, (_, x) => small[Math.floor(y / scale)]![Math.floor(x / scale)]!),
  );
}

function iconPattern(put: (grid: PixelGrid, left: number, top: number) => void): Codes {
  const grid = new PixelGrid(16, 16);
  put(grid, 0, 0);
  return codes(grid.build(windowLegend));
}

const fadedPattern = (pattern: Codes): Codes =>
  pattern.map((row) => row.map((code) => (code === null ? null : faded(code))));

test.each([1, 3, 12])('draws all %s cards at one size, inside the narrowest column', (count) => {
  const cards = levelPickerArt(
    Array.from({ length: count }, (_, index) =>
      level(index + 1, index % 3 !== 2, index % 3 === 0 ? 60 * 60 * 120 : undefined),
    ),
  );
  const width = cards[0]!.rows[0]!.length;
  const wrong = cards.filter((card) => card.rows.length !== rowHeight || card.rows.some((row) => row.length !== width));
  expect(wrong).toEqual([]);
  for (const card of cards) expect(() => sprite(card)).not.toThrow();
  expect(width).toBeLessThanOrEqual(180 - 16);
});

test('keeps the card width when the shortest playthrough is completed', () => {
  const width = (cards: readonly LevelProgressView[]): number => levelPickerArt(cards)[0]!.rows[0]!.length;
  expect(width([level(1, true, 0, [0, 0]), level(2, false)])).toBe(width([level(1, true), level(2, false)]));
});

test('draws the level number in Paper at twice the font size', () => {
  const [card] = levelPickerArt([level(12, true)]);
  expect(contains(codes(card!), textPattern('12', 2))).toBe(true);
});

test('draws a completed level with the clock beside the last play time and the star beside its stars', () => {
  const card = codes(levelPickerArt([level(1, true, 60 * 83)])[0]!);
  expect([
    contains(card, iconPattern(putClock)),
    contains(card, textPattern(playTime(PlayTime.ofFrames(60 * 83)), 1)),
    contains(card, iconPattern(putStar)),
    contains(card, textPattern('3/5', 1)),
  ]).toEqual([true, true, true, true]);
});

test('draws nothing below the number of a level without a completed playthrough', () => {
  const [completed, unplayed, locked] = levelPickerArt([level(1, true, 60 * 83), level(1, true), level(1, false)]);
  const blank = windowFrame(completed!.rows[0]!.length, rowHeight).build(windowLegend).rows;
  const statistics = completed!.rows.findIndex((row, y) => row !== unplayed!.rows[y]);
  expect(statistics).toBeGreaterThan(0);
  expect(unplayed!.rows.slice(statistics)).toEqual(blank.slice(statistics));
  expect(locked!.rows.slice(statistics)).toEqual(blank.slice(statistics));
});

test('draws a locked level only in neutral colors, with its number faded', () => {
  const card = codes(levelPickerArt([level(7, false)])[0]!);
  const neutrals: readonly (PaletteCode | null)[] = [null, ...neutralCode.options];
  expect(card.flat().filter((code) => !neutrals.includes(code))).toEqual([]);
  expect(contains(card, fadedPattern(textPattern('7', 2)))).toBe(true);
});

test('reads every card out for screen readers', () => {
  expect(levels.map(levelRowText)).toEqual([
    'ΕΠΙΠΕΔΟ 1. ΧΡΟΝΟΣ 1:23. ΑΣΤΕΡΙΑ 3/5.',
    'ΕΠΙΠΕΔΟ 2.',
    'ΕΠΙΠΕΔΟ 3. ΚΛΕΙΔΩΜΕΝΟ.',
  ]);
});

function levelPicker() {
  FakeDocument.stubGlobals();
  const root = new FakeDocument();
  const screen = root.createElement('section');
  screen.className = 'level-picker-screen';
  screen.hidden = true;
  const list = root.createElement('ol');
  list.className = 'level-picker';
  const backButton = root.createElement('button');
  backButton.className = 'level-picker-back';
  screen.append(list, backButton);
  root.body.append(screen);
  const subject = new LevelPicker(root as unknown as Document);
  const chosen = vi.fn<(level: LevelId) => void>();
  const back = vi.fn();
  subject.whenChosen(chosen);
  subject.whenBack(back);
  subject.show(levels);
  const rows = root.querySelectorAll('.level-row') as FakeHTMLElement[];
  const key = (name: string): Event => {
    const event = Object.assign(new Event('keydown', { cancelable: true }), { key: name, repeat: false });
    root.dispatchEvent(event);
    return event;
  };
  return { root, screen, backButton, rows, chosen, back, key };
}

test('arrow keys move focus through the rows and a choose key picks the focused one', () => {
  const { root, rows, chosen, key } = levelPicker();
  expect(key('ArrowDown').defaultPrevented).toBe(true);
  expect(root.activeElement).toBe(rows[1]);
  expect(key('z').defaultPrevented).toBe(true);
  expect(chosen).toHaveBeenCalledExactlyOnceWith(levels[1]!.id);
});

test('a locked row is disabled, cannot be clicked and is skipped by arrow keys', () => {
  const { root, rows, backButton, chosen, key } = levelPicker();
  const locked = rows[2]!;
  expect(locked.disabled).toBe(true);
  locked.click();
  key('ArrowDown');
  key('ArrowDown');
  expect(root.activeElement).toBe(backButton);
  key('ArrowUp');
  expect(root.activeElement).toBe(rows[1]);
  expect(chosen).not.toHaveBeenCalled();
});
