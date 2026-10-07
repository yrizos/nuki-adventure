import { expect, test, vi } from 'vitest';
import type { LevelProgressView } from '../application/manage-progress';
import { Playthrough, PlayTime } from '../domain/progress/playthrough';
import { LevelId } from '../domain/shared/level-id';
import { StarCount } from '../domain/shared/star-count';
import { sprite } from './picture';
import { FakeDocument, type FakeHTMLElement } from '../test-support/fake-document';
import { focusAfter, levelPickerArt, levelRowText, rowHeight, StartScreen, titleArt } from './start-screen';

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

function startScreen(continueLevel = levels[0]!.id) {
  FakeDocument.stubGlobals();
  const root = new FakeDocument();
  const screen = root.createElement('section');
  screen.className = 'start-screen';
  const [title, continueButton, newGameButton, picker] = [
    'start-title',
    'start-continue',
    'start-new-game',
    'level-picker',
  ].map((name) => {
    const created = root.createElement(name === 'start-title' ? 'h1' : name === 'level-picker' ? 'ul' : 'button');
    created.className = name;
    return created;
  });
  screen.append(title!, continueButton!, newGameButton!, picker!);
  root.body.append(screen);
  const subject = new StartScreen(root as unknown as Document);
  const chosen = vi.fn<(level: LevelId) => void>();
  subject.whenChosen(chosen);
  subject.show({ continueLevel, levels });
  const rows = root.querySelectorAll('.level-row') as FakeHTMLElement[];
  const key = (name: string): Event => {
    const event = Object.assign(new Event('keydown', { cancelable: true }), { key: name, repeat: false });
    root.dispatchEvent(event);
    return event;
  };
  return { root, continueButton: continueButton!, newGameButton: newGameButton!, rows, chosen, key };
}

test.each([
  ['a level row', (page: ReturnType<typeof startScreen>) => page.rows[1]!, levels[1]!.id],
  ['continue', (page: ReturnType<typeof startScreen>) => page.continueButton, levels[1]!.id],
  ['new game', (page: ReturnType<typeof startScreen>) => page.newGameButton, levels[0]!.id],
] as const)('choosing %s starts its level', (_label, choice, level) => {
  const page = startScreen(levels[1]!.id);
  choice(page).click();
  expect(page.chosen).toHaveBeenCalledExactlyOnceWith(level);
});

test('a locked row can be neither clicked nor reached with the keyboard', () => {
  const { rows, root, chosen, key } = startScreen();
  const locked = rows[2]!;
  locked.click();
  for (let press = 0; press < rows.length + 2; press++) key('ArrowDown');
  expect(root.activeElement).toBe(rows[1]);
  key('Enter');
  expect(chosen).toHaveBeenCalledExactlyOnceWith(levels[1]!.id);
});

test('arrow keys move focus through the choices and a choose key picks the focused one', () => {
  const { root, continueButton, newGameButton, rows, chosen, key } = startScreen(levels[1]!.id);
  expect(root.activeElement).toBe(continueButton);
  expect(key('ArrowDown').defaultPrevented).toBe(true);
  expect(root.activeElement).toBe(newGameButton);
  key('ArrowRight');
  expect(root.activeElement).toBe(rows[0]);
  key('ArrowUp');
  expect(root.activeElement).toBe(newGameButton);
  key('ArrowRight');
  expect(chosen).not.toHaveBeenCalled();
  expect(key('z').defaultPrevented).toBe(true);
  expect(chosen).toHaveBeenCalledExactlyOnceWith(levels[0]!.id);
});
