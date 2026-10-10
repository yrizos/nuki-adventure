import type { LevelProgressView } from '../application/manage-progress';
import type { LevelId } from '../domain/shared/level-id';
import type { Art } from './art/art';
import { textWidth, writeText } from './art/font';
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

const edge = 2;
const padding = 6;
const columnGap = 10;
export const rowHeight = 2 * edge + 2 * padding + iconSize;
const noPlaythrough = '-';

function timeText(level: LevelProgressView): string {
  return level.lastPlaythrough ? playTime(level.lastPlaythrough.time) : noPlaythrough;
}

function starText(level: LevelProgressView): string {
  return level.lastPlaythrough ? starsText(level.lastPlaythrough) : noPlaythrough;
}

// Every row shares one set of column widths, so numbers, times and stars line up down the list.
export function levelPickerArt(levels: readonly LevelProgressView[]): Art[] {
  const widest = (text: (level: LevelProgressView) => string): number =>
    Math.max(...levels.map((level) => textWidth(text(level))));
  const numberWidth = widest((level) => String(level.number));
  const timeWidth = widest(timeText);
  const starWidth = widest(starText);
  const timeLeft = edge + padding + numberWidth + columnGap;
  const starLeft = timeLeft + iconSize + iconGap + timeWidth + columnGap;
  const width = starLeft + iconSize + iconGap + starWidth + padding + edge;
  const textTop = edge + padding + iconTextTop;
  return levels.map((level) => {
    const grid = windowFrame(width, rowHeight);
    const number = String(level.number);
    writeText(grid, number, edge + padding + numberWidth - textWidth(number), textTop, level.isUnlocked ? 't' : 'q');
    if (level.isUnlocked) {
      putClock(grid, timeLeft, edge + padding);
      writeText(grid, timeText(level), timeLeft + iconSize + iconGap, textTop, 't');
      putStar(grid, starLeft, edge + padding);
      writeText(grid, starText(level), starLeft + iconSize + iconGap, textTop, 't');
    }
    return grid.build(windowLegend);
  });
}

// The rows show pictures and numbers, so screen readers get the same facts in words.
export function levelRowText(level: LevelProgressView): string {
  if (!level.isUnlocked) return `ΕΠΙΠΕΔΟ ${level.number}. ΚΛΕΙΔΩΜΕΝΟ.`;
  if (!level.lastPlaythrough) return `ΕΠΙΠΕΔΟ ${level.number}.`;
  return `ΕΠΙΠΕΔΟ ${level.number}. ΧΡΟΝΟΣ ${timeText(level)}. ΑΣΤΕΡΙΑ ${starText(level)}.`;
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
