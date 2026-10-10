import { expect, test, vi } from 'vitest';
import type { LevelProgressView } from '../application/manage-progress';
import { Playthrough, PlayTime } from '../domain/progress/playthrough';
import { LevelId } from '../domain/shared/level-id';
import { StarCount } from '../domain/shared/star-count';
import { FakeDocument, type FakeHTMLElement } from '../test-support/fake-document';
import { LevelPicker, levelPickerArt, levelRowText, rowHeight } from './level-picker';
import { sprite } from './picture';

const level = (number: number, isUnlocked: boolean, frames?: number): LevelProgressView => ({
  id: LevelId.of(`level ${number}`),
  number,
  isUnlocked,
  lastPlaythrough:
    frames === undefined ? null : Playthrough.of(PlayTime.ofFrames(frames), StarCount.of(3), StarCount.of(5)),
});

const levels = [level(1, true, 60 * 83), level(2, true), level(3, false)];

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

test('shows the picker with focus on the first row', () => {
  const { root, screen, rows } = levelPicker();
  expect(screen.hidden).toBe(false);
  expect(root.activeElement).toBe(rows[0]);
});

test.each([0, 1])('clicking row %s chooses its level', (index) => {
  const { rows, chosen, back } = levelPicker();
  rows[index]!.click();
  expect(chosen).toHaveBeenCalledExactlyOnceWith(levels[index]!.id);
  expect(back).not.toHaveBeenCalled();
});

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

test('clicking ΠΙΣΩ goes back', () => {
  const { backButton, back, chosen } = levelPicker();
  backButton.click();
  expect(back).toHaveBeenCalledOnce();
  expect(chosen).not.toHaveBeenCalled();
});

test('choosing ΠΙΣΩ with the keyboard goes back', () => {
  const { root, backButton, back, chosen, key } = levelPicker();
  for (let press = 0; press < levels.length + 1; press++) key('ArrowDown');
  expect(root.activeElement).toBe(backButton);
  key('Enter');
  expect(back).toHaveBeenCalledOnce();
  expect(chosen).not.toHaveBeenCalled();
});
