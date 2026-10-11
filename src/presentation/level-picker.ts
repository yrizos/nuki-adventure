import type { LevelProgressView } from '../application/manage-progress';
import type { LevelId } from '../domain/shared/level-id';
import { PixelGrid, type Art } from './art/art';
import { glyphHeight, textWidth, writeText } from './art/font';
import { backWidth, continueHeight } from './art/panel';
import { artUrl } from './canvas-art';
import { element } from './dom';
import {
  iconGap,
  iconSize,
  iconTextTop,
  playTime,
  putClock,
  putStar,
  starsText,
  windowFrame,
  windowLegend,
} from './level-end';
import { menuChoices, takeMenuKeys } from './menu-keys';
import { faded } from './palette';

const edge = 2;
const padding = 6;
const columnGap = 10;
const numberScale = 2;
const numberHeight = numberScale * glyphHeight;
const statsTop = edge + padding + numberHeight + padding;
export const rowHeight = statsTop + iconSize + padding + edge;
// The widths of the shortest statistics keep a card from shrinking before any level is completed.
const shortestTime = '0:00';
const shortestStars = '0/0';

const lockedLegend = Object.fromEntries(Object.entries(windowLegend).map(([symbol, code]) => [symbol, faded(code)]));

function putNumber(grid: PixelGrid, number: string, left: number, top: number): void {
  const text = new PixelGrid(textWidth(number), glyphHeight);
  writeText(text, number, 0, 0, 't');
  for (let row = 0; row < numberHeight; row++)
    for (let column = 0; column < numberScale * textWidth(number); column++) {
      const pixel = text.get(Math.floor(column / numberScale), Math.floor(row / numberScale));
      if (pixel !== '.') grid.put(left + column, top + row, pixel);
    }
}

// Every card shares one size and one set of columns, so numbers, times and stars line up down the list.
export function levelPickerArt(levels: readonly LevelProgressView[]): Art[] {
  const widest = (texts: readonly string[]): number => Math.max(...texts.map(textWidth));
  const playthroughs = levels.flatMap(({ lastPlaythrough }) => (lastPlaythrough ? [lastPlaythrough] : []));
  const numberWidth = numberScale * widest(levels.map(({ number }) => String(number)));
  const timeWidth = widest([shortestTime, ...playthroughs.map(({ time }) => playTime(time))]);
  const starWidth = widest([shortestStars, ...playthroughs.map(starsText)]);
  const left = edge + padding;
  const starLeft = left + iconSize + iconGap + timeWidth + columnGap;
  const width = Math.max(left + numberWidth, starLeft + iconSize + iconGap + starWidth) + padding + edge;
  return levels.map((level) => {
    const grid = windowFrame(width, rowHeight);
    const number = String(level.number);
    putNumber(grid, number, left + numberWidth - numberScale * textWidth(number), edge + padding);
    if (level.lastPlaythrough) {
      putClock(grid, left, statsTop);
      writeText(grid, playTime(level.lastPlaythrough.time), left + iconSize + iconGap, statsTop + iconTextTop, 't');
      putStar(grid, starLeft, statsTop);
      writeText(grid, starsText(level.lastPlaythrough), starLeft + iconSize + iconGap, statsTop + iconTextTop, 't');
    }
    return grid.build(level.isUnlocked ? windowLegend : lockedLegend);
  });
}

// The rows show pictures and numbers, so screen readers get the same facts in words.
export function levelRowText(level: LevelProgressView): string {
  if (!level.isUnlocked) return `ΕΠΙΠΕΔΟ ${level.number}. ΚΛΕΙΔΩΜΕΝΟ.`;
  if (!level.lastPlaythrough) return `ΕΠΙΠΕΔΟ ${level.number}.`;
  return `ΕΠΙΠΕΔΟ ${level.number}. ΧΡΟΝΟΣ ${playTime(level.lastPlaythrough.time)}. ΑΣΤΕΡΙΑ ${starsText(level.lastPlaythrough)}.`;
}

export class LevelPicker {
  private readonly screen: HTMLElement;
  private readonly list: HTMLElement;
  private readonly backButton: HTMLButtonElement;
  private chosen: (level: LevelId) => void = () => {};

  constructor(private readonly root: Document) {
    this.screen = element(root, '.level-picker-screen');
    this.list = element(root, '.level-picker');
    this.backButton = element(root, '.level-picker-back');
    this.backButton.style.setProperty('--art-width', String(backWidth));
    this.backButton.style.setProperty('--art-height', String(continueHeight));
    takeMenuKeys(root, this.screen);
  }

  whenChosen(listener: (level: LevelId) => void): void {
    this.chosen = listener;
  }

  whenBack(listener: () => void): void {
    this.backButton.addEventListener('click', listener);
  }

  show(levels: readonly LevelProgressView[]): void {
    const arts = levelPickerArt(levels);
    this.list.replaceChildren(
      ...levels.map((level, index) => {
        const art = arts[index]!;
        const button = this.root.createElement('button');
        button.type = 'button';
        button.className = 'level-row';
        button.disabled = !level.isUnlocked;
        button.setAttribute('aria-label', levelRowText(level));
        button.style.setProperty('--art', `url(${artUrl(this.root, art)})`);
        button.style.setProperty('--art-width', String(art.rows[0]!.length));
        button.style.setProperty('--art-height', String(art.rows.length));
        button.addEventListener('click', () => this.chosen(level.id));
        const item = this.root.createElement('li');
        item.append(button);
        return item;
      }),
    );
    this.screen.hidden = false;
    menuChoices(this.screen)[0]?.focus({ preventScroll: true });
  }

  hide(): void {
    this.screen.hidden = true;
  }
}
