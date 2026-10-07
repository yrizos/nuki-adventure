import type { Playthrough, PlayTime } from '../domain/progress/playthrough';
import { PixelGrid, type Art } from './art/art';
import { glyphHeight, textWidth, writeText } from './art/font';
import { continueHeight, continueWidth } from './art/panel';
import { starArt } from './art/collectibles';
import { artUrl } from './canvas-art';
import { element } from './dom';

const framesPerSecond = 60;
const edge = 2;
const padding = 10;
export const iconSize = 16;
export const iconGap = 8;
const titleRow = 10;
const timeRow = 28;
const starsRow = 52;
export const continueTop = 78;
const height = continueTop + continueHeight + padding + edge;
const starArtMargin = 4;
const title = 'ΜΠΡΑΒΟ!';
const sparkle = ['.c.', 'ccc', '.c.'];

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

export const iconTextTop = Math.floor((iconSize - glyphHeight) / 2);
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

// The window shows pictures instead of words, so screen readers get the words here.
export function levelEndText(playthrough: Playthrough): string {
  return `${title} ΧΡΟΝΟΣ ${playTime(playthrough.time)}. ΑΣΤΕΡΙΑ ${starsText(playthrough)}.`;
}

export function levelEndArt(playthrough: Playthrough): Art {
  const time = playTime(playthrough.time);
  const stars = starsText(playthrough);
  const content = iconSize + iconGap + Math.max(textWidth(time), textWidth(stars));
  const width = Math.max(continueWidth, content) + 2 * (edge + padding);
  const grid = windowFrame(width, height);

  // The exclamation mark sits in the middle column of its glyph, so the title's drawn width ends two columns early.
  const titleWidth = textWidth(title) - 2;
  const titleLeft = Math.floor((width - titleWidth) / 2);
  writeText(grid, title, titleLeft, titleRow, 'a');
  for (const sparkleLeft of [titleLeft - 10, titleLeft + titleWidth + 7]) {
    sparkle.forEach((line, y) =>
      [...line].forEach((pixel, x) => {
        if (pixel !== '.') grid.put(sparkleLeft + x, titleRow + 3 + y, pixel);
      }),
    );
  }

  const left = Math.floor((width - content) / 2);
  putClock(grid, left, timeRow);
  putStar(grid, left, starsRow);
  writeText(grid, time, left + iconSize + iconGap, timeRow + iconTextTop, 't');
  writeText(grid, stars, left + iconSize + iconGap, starsRow + iconTextTop, 't');
  return grid.build(windowLegend);
}

export class LevelEndWindow {
  private readonly overlay: HTMLElement;
  private readonly card: HTMLElement;
  private readonly summary: HTMLElement;
  private readonly continueButton: HTMLButtonElement;

  constructor(private readonly root: Document) {
    this.overlay = element(root, '.level-end');
    this.card = element(root, '.level-end-card');
    this.summary = element(root, '.level-end-summary');
    this.continueButton = element(root, '.continue-button');
    this.continueButton.style.setProperty('--button-top', String(continueTop));
    this.continueButton.style.setProperty('--button-width', String(continueWidth));
    this.continueButton.style.setProperty('--button-height', String(continueHeight));
  }

  whenContinued(listener: () => void): void {
    this.continueButton.addEventListener('click', listener);
  }

  show(playthrough: Playthrough): void {
    const art = levelEndArt(playthrough);
    const width = art.rows[0]!.length;
    this.card.style.setProperty('--art', `url(${artUrl(this.root, art)})`);
    this.card.style.setProperty('--card-width', String(width));
    this.card.style.setProperty('--card-height', String(art.rows.length));
    this.continueButton.style.setProperty('--button-left', String(Math.floor((width - continueWidth) / 2)));
    this.summary.textContent = levelEndText(playthrough);
    this.overlay.hidden = false;
    this.continueButton.focus({ preventScroll: true });
  }

  hide(): void {
    this.overlay.hidden = true;
  }
}
