import type { LevelProgressView } from '../application/manage-progress';
import type { Playthrough, PlayTime } from '../domain/progress/playthrough';
import type { LevelId } from '../domain/shared/level-id';
import { PixelGrid, type Art } from './art/art';
import { glyphHeight, textWidth, writeText } from './art/font';
import { backWidth, textButtonHeight } from './art/panel';
import { artUrl } from './canvas-art';
import { element } from './dom';
import { menuChoices, takeMenuKeys } from './menu-keys';
import { faded } from './palette';
import { starArt } from './sprite-library';

const framesPerSecond = 60;
const edge = 2;
const padding = 6;
const iconSize = 16;
const iconGap = 8;
const starArtMargin = 4;
const columnGap = 10;
const numberScale = 2;
const numberHeight = numberScale * glyphHeight;
const statsTop = edge + padding + numberHeight + padding;
export const rowHeight = statsTop + iconSize + padding + edge;
// The widths of the shortest statistics keep a card from shrinking before any level is completed.
const shortestTime = '0:00';
const shortestStars = '0/0';

function clockFace(): readonly string[] {
  const grid = new PixelGrid(iconSize, iconSize);
  const radius = iconSize / 2;
  const inside = (column: number, row: number): boolean =>
    (column + 0.5 - radius) ** 2 + (row + 0.5 - radius) ** 2 <= radius * radius;
  for (let row = 0; row < iconSize; row++) {
    for (let column = 0; column < iconSize; column++) {
      if (!inside(column, row)) continue;
      const edge = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([across, down]) => !inside(column + across!, row + down!));
      grid.put(column, row, edge ? 'k' : !inside(column + 2, row + 2) ? 'q' : 'p');
    }
  }
  for (const [column, row, across, down] of [
    [7, 2, 2, 1],
    [7, 13, 2, 1],
    [2, 7, 1, 2],
    [13, 7, 1, 2],
  ] as const) {
    grid.rectangle(column, row, across, down, 'k');
  }
  grid.rectangle(7, 4, 2, 5, 'k');
  grid.rectangle(9, 7, 3, 2, 'k');
  return grid.build({}).rows;
}

const clock = clockFace();

const iconTextTop = Math.floor((iconSize - glyphHeight) / 2);
export const windowLegend = {
  k: 'Ink',
  e: 'V1',
  f: 'V0',
  a: 'Y2',
  b: 'Y1',
  c: 'Y3',
  p: 'Paper',
  q: 'N4',
  t: 'Paper',
} as const;

function putIcon(grid: PixelGrid, rows: readonly string[], left: number, top: number): void {
  rows.forEach((line, y) =>
    [...line].forEach((pixel, x) => {
      if (pixel !== '.') grid.put(left + x, top + y, pixel);
    }),
  );
}

export function putClock(grid: PixelGrid, left: number, top: number): void {
  putIcon(grid, clock, left, top);
}

export function putStar(grid: PixelGrid, left: number, top: number): void {
  putIcon(
    grid,
    starArt.rows
      .slice(starArtMargin, starArtMargin + iconSize)
      .map((line) => line.slice(starArtMargin, starArtMargin + iconSize)),
    left,
    top,
  );
}

// The clipped corners match the message box and the switches, so every window over the game world looks like one set.
export function windowFrame(width: number, height: number): PixelGrid {
  const grid = new PixelGrid(width, height, 'k');
  grid.rectangle(1, 1, width - 2, height - 2, 'e');
  grid.rectangle(2, 2, width - 4, height - 4, 'f');
  for (const [column, row] of [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ] as const)
    grid.put(column, row, '.');
  for (const [column, row] of [
    [1, 1],
    [width - 2, 1],
    [1, height - 2],
    [width - 2, height - 2],
  ] as const)
    grid.put(column, row, 'k');
  return grid;
}

export function playTime(time: PlayTime): string {
  const seconds = Math.floor(time.frames / framesPerSecond);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function starsText(playthrough: Playthrough): string {
  return `${playthrough.collectedStars.value}/${playthrough.starCount.value}`;
}

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
    this.backButton.style.setProperty('--art-height', String(textButtonHeight));
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
