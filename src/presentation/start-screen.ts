import type { LevelProgressView, ProgressView } from '../application/manage-progress';
import type { LevelId } from '../domain/shared/level-id';
import { PixelGrid, type Art } from './art/art';
import { glyphHeight, textWidth, writeText } from './art/font';
import { continueHeight, continueWidth, newGameWidth } from './art/panel';
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

const gameName = ['Η ΠΟΛΥΧΡΩΜΗ ΠΕΡΙΠΕΤΕΙΑ', 'ΤΗΣ ΝΟΥΚΙ'];
const lineHeight = 16;
const edge = 2;
const padding = 6;
const columnGap = 10;
export const rowHeight = 2 * edge + 2 * padding + iconSize;
const noPlaythrough = '-';

export function titleArt(): Art {
  const width = Math.max(...gameName.map(textWidth));
  const grid = new PixelGrid(width, (gameName.length - 1) * lineHeight + glyphHeight);
  gameName.forEach((line, index) =>
    writeText(grid, line, Math.floor((width - textWidth(line)) / 2), index * lineHeight, 'a'),
  );
  return grid.build({ a: 'Y2' });
}

function timeText(level: LevelProgressView): string {
  return level.bestPlaythrough ? playTime(level.bestPlaythrough.time) : noPlaythrough;
}

function starText(level: LevelProgressView): string {
  return level.bestPlaythrough ? starsText(level.bestPlaythrough) : noPlaythrough;
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
  if (!level.bestPlaythrough) return `ΕΠΙΠΕΔΟ ${level.number}.`;
  return `ΕΠΙΠΕΔΟ ${level.number}. ΧΡΟΝΟΣ ${timeText(level)}. ΑΣΤΕΡΙΑ ${starText(level)}.`;
}

const previousKeys = new Set(['ArrowUp', 'ArrowLeft']);
const nextKeys = new Set(['ArrowDown', 'ArrowRight']);
const chooseKeys = new Set(['z', 'x', ' ', 'Enter']);

export function focusAfter(key: string, focused: number, count: number): number {
  if (previousKeys.has(key)) return Math.max(0, focused - 1);
  if (nextKeys.has(key)) return Math.min(count - 1, focused + 1);
  return focused;
}

export class StartScreen {
  private readonly screen: HTMLElement;
  private readonly continueButton: HTMLButtonElement;
  private readonly newGameButton: HTMLButtonElement;
  private readonly picker: HTMLElement;
  private chosen: (level: LevelId) => void = () => {};
  private continueLevel: LevelId | null = null;
  private firstLevel: LevelId | null = null;

  constructor(private readonly root: Document) {
    this.screen = element(root, '.start-screen');
    this.continueButton = element(root, '.start-continue');
    this.newGameButton = element(root, '.start-new-game');
    this.picker = element(root, '.level-picker');
    const title = element<HTMLElement>(root, '.start-title');
    const art = titleArt();
    title.style.setProperty('--art', `url(${artUrl(root, art)})`);
    title.style.setProperty('--art-width', String(art.rows[0]!.length));
    title.style.setProperty('--art-height', String(art.rows.length));
    for (const [button, width] of [
      [this.continueButton, continueWidth],
      [this.newGameButton, newGameWidth],
    ] as const) {
      button.style.setProperty('--art-width', String(width));
      button.style.setProperty('--art-height', String(continueHeight));
    }
    this.continueButton.addEventListener('click', () => this.continueLevel && this.chosen(this.continueLevel));
    this.newGameButton.addEventListener('click', () => this.firstLevel && this.chosen(this.firstLevel));
    // The game's own keys move the hero and press A and B, so the start screen takes them first while it is open.
    root.addEventListener(
      'keydown',
      (event) => {
        if (this.screen.hidden) return;
        const choices = this.choices();
        const focused = choices.findIndex((choice) => choice === root.activeElement);
        if (chooseKeys.has(event.key.length === 1 ? event.key.toLowerCase() : event.key)) {
          if (!event.repeat) choices[focused]?.click();
        } else if (previousKeys.has(event.key) || nextKeys.has(event.key)) {
          choices[focusAfter(event.key, Math.max(0, focused), choices.length)]?.focus();
        } else return;
        event.preventDefault();
        event.stopPropagation();
      },
      true,
    );
  }

  whenChosen(listener: (level: LevelId) => void): void {
    this.chosen = listener;
  }

  show({ continueLevel, levels }: ProgressView): void {
    this.continueLevel = continueLevel;
    this.firstLevel = levels[0]!.id;
    this.continueButton.hidden = continueLevel.equals(this.firstLevel);
    const arts = levelPickerArt(levels);
    this.picker.replaceChildren(
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
    this.choices()[0]?.focus({ preventScroll: true });
  }

  hide(): void {
    this.screen.hidden = true;
  }

  private choices(): HTMLButtonElement[] {
    return [...this.screen.querySelectorAll<HTMLButtonElement>('button')].filter(
      (button) => !button.hidden && !button.disabled,
    );
  }
}
