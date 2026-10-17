import { expect, test, vi } from 'vitest';
import { type LevelProgressView, type ProgressView } from '../../progress/application/manage-progress';
import { Playthrough, PlayTime } from '../../progress/domain/playthrough';
import { Area, Key } from '../../level/domain/collectibles';
import { Direction, TilePosition } from '../../level/domain/position';
import { Door } from '../../level/domain/door';
import { Ground, LevelSize, Scenery } from '../../level/domain/scenery';
import { LevelId } from '../../level/domain/level-id';
import { PlayLevel } from '../../level/application/play-level';
import { StarCount } from '../../level/domain/star-count';
import { Level } from '../../level/domain/level';
import { check2dObstacles } from '../../level/infrastructure/check2d-obstacles';
import { InMemoryLevelRepository } from '../../level/infrastructure/in-memory-level-repository';
import { FakeDocument, type FakeHTMLElement } from '../testing/fake-document';
import { PixelGrid, type Art } from '../graphics/art';
import { glyphHeight, textWidth, writeText } from '../graphics/font';
import {
  cardHeight,
  cardWidth,
  LevelPicker,
  levelCardArt,
  levelRowText,
  playTime,
  putClock,
  putStar,
  windowLegend,
} from './level-picker';
import { mapSize } from './level-map';
import { ditherSteps } from '../graphics/ordered-dither';
import { faded, type PaletteCode } from '../graphics/palette';
import { sprite } from '../graphics/picture';
import { artUrl } from '../graphics/canvas-art';
import { heroArt } from '../graphics/sprite-library';

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
function count(card: Codes, pattern: Codes): number {
  const height = pattern.length;
  const width = pattern[0]!.length;
  let found = 0;
  for (let top = 0; top + height <= card.length; top++)
    for (let left = 0; left + width <= card[0]!.length; left++)
      if (pattern.every((row, y) => row.every((code, x) => code === null || card[top + y]![left + x] === code)))
        found++;
  return found;
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
  const grid = new PixelGrid(9, 9);
  put(grid, 0, 0);
  return codes(grid.build(windowLegend));
}

const goldStar = iconPattern(putStar);
const dimStar = goldStar.map((row) => row.map((code) => (code === null || code === 'Ink' ? code : faded(code))));
const card = (view: LevelProgressView): Codes => codes(levelCardArt(view));
const mapLeft = (cardWidth - mapSize) / 2;
const mapTop = 6;
// A one digit number and its outline cover this corner of the map.
const underNumber = (x: number, y: number): boolean => x <= mapLeft + 10 && y <= mapTop + 14;

test('draws every card at one size, and the picker box inside the narrowest column', () => {
  const cards = [level(1, true, 60 * 60 * 120, [5, 5]), level(12, true), level(3, false)].map((view) =>
    levelCardArt(view),
  );
  for (const art of cards) {
    expect([art.rows.length, ...new Set(art.rows.map((row) => row.length))]).toEqual([cardHeight, cardWidth]);
    expect(() => sprite(art)).not.toThrow();
  }
  expect(cardWidth + 16).toBeLessThanOrEqual(180 - 8);
});

test('leaves the map window open on an unlocked card, inside an Ink border', () => {
  const rows = card(level(1, true));
  const window = rows
    .slice(mapTop, mapTop + mapSize)
    .flatMap((row, y) => row.slice(mapLeft, mapLeft + mapSize).filter((_, x) => !underNumber(mapLeft + x, mapTop + y)));
  expect(new Set(window)).toEqual(new Set([null]));
  const border = [...rows[mapTop - 1]!.slice(mapLeft - 1, mapLeft + mapSize + 1), rows[mapTop + mapSize]![mapLeft]];
  expect(new Set(border)).toEqual(new Set(['Ink']));
});

test('keeps the map window of a locked card closed', () => {
  const rows = card(level(3, false));
  const window = rows
    .slice(mapTop, mapTop + mapSize)
    .flatMap((row, y) => row.slice(mapLeft, mapLeft + mapSize).filter((_, x) => !underNumber(mapLeft + x, mapTop + y)));
  expect(new Set(window)).toEqual(new Set(['V0']));
});

test('draws the level number at the font size over the top left corner of the map', () => {
  const rows = card(level(7, true));
  const number = textPattern('7', 1).map((row) => row.map((code) => (code === 'V0' ? null : code)));
  const found: string[] = [];
  for (let top = mapTop; top + number.length <= mapTop + mapSize; top++)
    for (let left = mapLeft; left + number[0]!.length <= mapLeft + 20; left++)
      if (number.every((row, y) => row.every((code, x) => code === null || rows[top + y]![left + x] === code)))
        found.push(`${left},${top}`);
  expect(found).toEqual([`${mapLeft + 4},${mapTop + 4}`]);
});

test('draws one gold star with the count collected, beside the clock and last play time', () => {
  const completed = card(level(1, true, 60 * 83, [4, 5]));
  expect([
    count(completed, goldStar),
    count(completed, dimStar),
    count(completed, textPattern('4', 1)),
    count(completed, iconPattern(putClock)),
    count(completed, textPattern('1:23', 1)),
  ]).toEqual([1, 0, 1, 1, 1]);
});

test('draws no star, count or clock on a level without a completed playthrough', () => {
  for (const view of [level(2, true), level(3, false)]) {
    const shown = card(view);
    expect([
      count(shown, goldStar),
      count(shown, dimStar),
      count(shown, textPattern('0', 1)),
      count(shown, iconPattern(putClock)),
    ]).toEqual([0, 0, 0, 0]);
  }
});

test('reads every card out for screen readers', () => {
  expect(levels.map(levelRowText)).toEqual([
    'ΕΠΙΠΕΔΟ 1. ΧΡΟΝΟΣ 1:23. ΑΣΤΕΡΙΑ 3/5.',
    'ΕΠΙΠΕΔΟ 2.',
    'ΕΠΙΠΕΔΟ 3. ΚΛΕΙΔΩΜΕΝΟ.',
  ]);
});

const everywhere = Area.of(Array.from({ length: 30 }, (_, index) => TilePosition.at(index % 5, Math.floor(index / 5))));

function view(id: LevelId) {
  const level = Level.create({
    id,
    scenery: Scenery.of(
      LevelSize.of(5, 6),
      Array.from({ length: 6 }, () => Array<Ground>(5).fill(Ground.Path)),
      [],
      [],
    ),
    stones: [],
    keys: [Key.at(TilePosition.at(1, 3), everywhere)],
    door: Door.closedAt(TilePosition.at(0, 0)),
    hero: { position: TilePosition.at(2, 4), facing: Direction.Up },
    obstacles: check2dObstacles,
  });
  return new PlayLevel(new InMemoryLevelRepository([level])).view(id);
}

function levelPicker(progress: Partial<ProgressView> = {}) {
  FakeDocument.stubGlobals();
  const root = new FakeDocument();
  const create = (tag: string, name: string) => {
    const created = root.createElement(tag);
    created.className = name;
    return created;
  };
  const start = create('section', 'start-screen');
  const opener = create('button', 'start-pick-level');
  start.append(opener);
  const screen = create('section', 'level-picker-screen');
  screen.hidden = true;
  const box = create('div', 'level-picker-box');
  const backButton = create('button', 'level-picker-back');
  const upButton = create('button', 'level-picker-up');
  const downButton = create('button', 'level-picker-down');
  const list = Object.assign(create('ol', 'level-picker'), { scrollTop: 0, scrollHeight: 0, clientHeight: 0 });
  box.append(create('h2', 'level-picker-title'), list, upButton, downButton, backButton);
  screen.append(box);
  root.body.append(start, screen);
  const subject = new LevelPicker(
    root as unknown as Document,
    levels.map(({ id }) => ({ id, view: view(id) })),
    () => 0.5,
  );
  const chosen = vi.fn<(level: LevelId) => void>();
  const back = vi.fn();
  subject.whenChosen(chosen);
  subject.whenBack(back);
  subject.show({ continueLevel: null, hasProgress: true, levels, ...progress });
  const whole = (): void => {
    for (let frame = 0; frame < ditherSteps; frame++) subject.advance();
  };
  const rows = root.querySelectorAll('.level-row') as FakeHTMLElement[];
  const key = (name: string): Event => {
    const event = Object.assign(new Event('keydown', { cancelable: true }), { key: name, repeat: false });
    root.dispatchEvent(event);
    return event;
  };
  return {
    root,
    start,
    opener,
    screen,
    list,
    upButton,
    downButton,
    backButton,
    rows,
    chosen,
    back,
    key,
    whole,
    subject,
  };
}

test('opens over the start screen and makes it inert, with the first unlocked card focused', () => {
  const { root, start, screen, rows } = levelPicker();
  expect([screen.hidden, start.hidden, start.inert]).toEqual([false, false, true]);
  expect(root.activeElement).toBe(rows[0]);
});

test('focuses the card of the level to continue', () => {
  const { root, rows } = levelPicker({ continueLevel: levels[1]!.id });
  expect(root.activeElement).toBe(rows[1]);
});

test('cards and ΠΙΣΩ act only once the picker has dithered in', () => {
  const { rows, backButton, chosen, back, whole } = levelPicker();
  rows[1]!.click();
  backButton.click();
  expect([chosen.mock.calls.length, back.mock.calls.length]).toEqual([0, 0]);
  whole();
  rows[1]!.click();
  backButton.click();
  expect(chosen).toHaveBeenCalledExactlyOnceWith(levels[1]!.id);
  expect(back).toHaveBeenCalledOnce();
});

test('arrow keys move focus through the cards and a choose key picks the focused one', () => {
  const { root, rows, chosen, key, whole } = levelPicker();
  whole();
  expect(key('ArrowDown').defaultPrevented).toBe(true);
  expect(root.activeElement).toBe(rows[1]);
  expect(key('z').defaultPrevented).toBe(true);
  expect(chosen).toHaveBeenCalledExactlyOnceWith(levels[1]!.id);
});

test('a locked card is disabled, cannot be clicked and is skipped by arrow keys', () => {
  const { root, rows, backButton, chosen, key, whole } = levelPicker();
  whole();
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

test('closing dithers the picker out and gives focus back to what opened it', () => {
  const { root, start, screen, opener, whole, subject } = levelPicker();
  whole();
  subject.close();
  for (let frame = 1; frame < ditherSteps; frame++) subject.advance();
  expect(screen.hidden).toBe(false);
  subject.advance();
  expect([screen.hidden, start.inert]).toEqual([true, false]);
  expect(root.activeElement).toBe(opener);
});

test('dims each scroll button once the list has nothing more in its direction, and scrolls on a press', () => {
  const { list, upButton, downButton } = levelPicker();
  const scrollBy = vi.fn<(options: ScrollToOptions) => void>();
  const scroll = (top: number): void => {
    Object.assign(list, { scrollTop: top, scrollHeight: 500, clientHeight: 200, scrollBy });
    list.dispatchEvent(new Event('scroll'));
  };
  scroll(0);
  expect([upButton.disabled, downButton.disabled]).toEqual([true, false]);
  scroll(150);
  expect([upButton.disabled, downButton.disabled]).toEqual([false, false]);
  scroll(300);
  expect([upButton.disabled, downButton.disabled]).toEqual([false, true]);
  upButton.click();
  expect(scrollBy.mock.calls[0]![0].top).toBeLessThan(0);
});

test('Nuki stands on the card of the level to continue and breathes and blinks on the game frames', () => {
  const { root, rows, subject } = levelPicker({ continueLevel: levels[1]!.id });
  const hero = root.querySelector('.level-hero') as FakeHTMLElement;
  expect(hero.parentElement).toBe(rows[1]);
  const shown = (): string => hero.style.getPropertyValue('--art');
  const url = (art: Art): string => `url(${artUrl(root as unknown as Document, art)})`;
  expect(shown()).toBe(url(heroArt.down.stand));
  for (let frame = 0; frame < 180; frame++) subject.advance();
  expect(shown()).toBe(url(heroArt.down.blink!));
});
