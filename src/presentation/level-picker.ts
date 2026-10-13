import type { LevelView } from '../application/level-view';
import type { LevelProgressView, ProgressView } from '../application/manage-progress';
import type { Playthrough, PlayTime } from '../domain/progress/playthrough';
import type { LevelId } from '../domain/shared/level-id';
import { PixelGrid, type Art } from './art/art';
import { glyphHeight, textWidth, writeText } from './art/font';
import { backWidth, scrollButtonWidth, textButtonHeight } from './art/panel';
import { artUrl, pictureUrl } from './canvas-art';
import { DitherModal, modalWidth } from './dither-modal';
import { element } from './dom';
import { levelMap } from './level-map';
import { idleHeroPose } from './hero-animator';
import { menuChoices, takeMenuKeys } from './menu-keys';
import { ditherSteps, ditherThreshold } from './ordered-dither';
import { faded } from './palette';
import { Picture } from './picture';
import { heroArt, padlockArt, starArt } from './sprite-library';

const framesPerSecond = 60;
const iconSize = 16;
const starArtMargin = 4;
const numberScale = 2;
const numberHeight = numberScale * glyphHeight;
const edge = 2;
const inset = 4;
export const mapSize = 100;
const boxPadding = 6;
export const cardWidth = modalWidth - 2 * boxPadding;
const mapLeft = (cardWidth - mapSize) / 2;
const mapTop = edge + inset;
const stripTop = mapTop + mapSize + inset + 1;
const stripHeight = 22;
export const cardHeight = stripTop + stripHeight + edge;
const iconTop = stripTop + (stripHeight - iconSize) / 2;
const starStep = iconSize + 1;
const iconGap = 4;
// The number keeps the padding a frame would have, so it sits as far from the card edge and the map.
const numberPadding = 2 + 4;
const pickerTitle = 'ΕΠΙΠΕΔΑ';
// Most of a screenful per press keeps a card in view across the jump, so the player never loses their place.
const scrollStep = 0.8;

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

// A star not collected is drawn through the faded mapping, so the row reads as gold earned against grey still to find.
const dimStar: Record<string, string> = { a: 'A', b: 'B', c: 'C' };
const cardLegend = {
  ...windowLegend,
  A: faded(windowLegend.a),
  B: faded(windowLegend.b),
  C: faded(windowLegend.c),
} as const;

function putNumber(grid: PixelGrid, number: string, left: number, top: number): void {
  const text = new PixelGrid(textWidth(number), glyphHeight);
  writeText(text, number, 0, 0, 't');
  for (let row = 0; row < numberHeight; row++)
    for (let column = 0; column < numberScale * textWidth(number); column++) {
      const pixel = text.get(Math.floor(column / numberScale), Math.floor(row / numberScale));
      if (pixel !== '.') grid.put(left + column, top + row, pixel);
    }
}

function putStars(grid: PixelGrid, collected: number, count: number): void {
  for (let index = 0; index < count; index++) {
    const left = inset + index * starStep;
    putStar(grid, left, iconTop);
    if (index < collected) continue;
    for (let row = 0; row < iconSize; row++)
      for (let column = 0; column < iconSize; column++) {
        const dim = dimStar[grid.get(left + column, iconTop + row)];
        if (dim) grid.put(left + column, iconTop + row, dim);
      }
  }
}

// The map shows through the window left open above the strip, inside a one pixel Ink border.
export function levelCardArt(level: LevelProgressView, starCount: number): Art {
  const grid = windowFrame(cardWidth, cardHeight);
  grid.rectangle(mapLeft - 1, mapTop - 1, mapSize + 2, mapSize + 2, 'k');
  grid.rectangle(mapLeft, mapTop, mapSize, mapSize, '.');
  grid.rectangle(edge, stripTop - 1, cardWidth - 2 * edge, 1, 'e');
  if (!level.isUnlocked) {
    for (let row = mapTop; row < mapTop + mapSize; row++)
      for (let column = mapLeft; column < mapLeft + mapSize; column++)
        if (ditherThreshold(column, row) < ditherSteps / 2) grid.put(column, row, 'k');
  }
  putNumber(grid, String(level.number), inset + numberPadding, inset + 4);
  const playthrough = level.lastPlaythrough;
  putStars(grid, playthrough?.collectedStars.value ?? 0, playthrough?.starCount.value ?? starCount);
  if (playthrough) {
    const time = playTime(playthrough.time);
    const timeLeft = cardWidth - edge - inset - textWidth(time);
    putClock(grid, timeLeft - iconGap - iconSize, iconTop);
    writeText(grid, time, timeLeft, iconTop + iconTextTop, 't');
  }
  return grid.build(cardLegend);
}

function titleArt(): Art {
  const grid = new PixelGrid(textWidth(pickerTitle), glyphHeight);
  writeText(grid, pickerTitle, 0, 0, 't');
  return grid.build({ t: 'Paper' });
}

// The text says in words what the card shows in pictures.
export function levelRowText(level: LevelProgressView): string {
  if (!level.isUnlocked) return `ΕΠΙΠΕΔΟ ${level.number}. ΚΛΕΙΔΩΜΕΝΟ.`;
  if (!level.lastPlaythrough) return `ΕΠΙΠΕΔΟ ${level.number}.`;
  return `ΕΠΙΠΕΔΟ ${level.number}. ΧΡΟΝΟΣ ${playTime(level.lastPlaythrough.time)}. ΑΣΤΕΡΙΑ ${starsText(level.lastPlaythrough)}.`;
}

export interface PickerLevel {
  readonly id: LevelId;
  readonly view: LevelView;
}

export class LevelPicker {
  private readonly dither: DitherModal;
  private readonly list: HTMLElement;
  private readonly backButton: HTMLButtonElement;
  private readonly scrollButtons: readonly [HTMLButtonElement, HTMLButtonElement];
  private readonly maps = new Map<string, Picture>();
  private readonly hero: HTMLElement;
  private readonly heroUrls = new Map<Art, string>();
  private heroPose: Art | null = null;
  private heroFrame = 0;
  private chosen: (level: LevelId) => void = () => {};

  constructor(
    private readonly root: Document,
    private readonly levels: readonly PickerLevel[],
    private readonly random: () => number,
  ) {
    const screen = element<HTMLElement>(root, '.level-picker-screen');
    const box = element<HTMLElement>(root, '.level-picker-box');
    this.dither = new DitherModal(
      root,
      screen,
      box,
      element(root, '.start-screen'),
      element(root, '.start-pick-level'),
    );
    this.list = element(root, '.level-picker');
    this.backButton = element(root, '.level-picker-back');
    this.backButton.style.setProperty('--art-width', String(backWidth));
    this.backButton.style.setProperty('--art-height', String(textButtonHeight));
    this.scrollButtons = [element(root, '.level-picker-up'), element(root, '.level-picker-down')];
    this.scrollButtons.forEach((button, index) => {
      button.style.setProperty('--art-width', String(scrollButtonWidth));
      button.style.setProperty('--art-height', String(textButtonHeight));
      const direction = index === 0 ? -1 : 1;
      button.addEventListener('click', () =>
        this.list.scrollBy?.({ top: direction * scrollStep * this.list.clientHeight, behavior: 'smooth' }),
      );
    });
    this.list.addEventListener('scroll', () => this.showScrollable());
    screen.style.setProperty('--modal-width', String(modalWidth));
    const title = element<HTMLElement>(root, '.level-picker-title');
    const art = titleArt();
    title.style.setProperty('--art', `url(${artUrl(root, art)})`);
    title.style.setProperty('--art-width', String(art.rows[0]!.length));
    title.style.setProperty('--art-height', String(art.rows.length));
    this.hero = root.createElement('span');
    this.hero.className = 'level-hero';
    this.hero.setAttribute('aria-hidden', 'true');
    const stand = heroArt.down.stand;
    this.hero.style.setProperty('--art-width', String(stand.rows[0]!.length));
    this.hero.style.setProperty('--art-height', String(stand.rows.length));
    this.hero.style.setProperty('--left', String(mapLeft + (mapSize - stand.rows[0]!.length) / 2));
    this.hero.style.setProperty('--top', String(mapTop + (mapSize - stand.rows.length) / 2));
    takeMenuKeys(root, screen);
  }

  whenChosen(listener: (level: LevelId) => void): void {
    this.chosen = listener;
  }

  whenBack(listener: () => void): void {
    this.backButton.addEventListener('click', () => {
      if (this.dither.isWhole) listener();
    });
  }

  // The card of the level to continue takes focus and scrolls into view, so the player starts where they left off.
  show({ continueLevel, levels }: ProgressView): void {
    const cards = levels.map((level) => {
      const playable = this.levels.find(({ id }) => id.equals(level.id));
      const art = levelCardArt(level, playable?.view.stars.length ?? 0);
      const picture = new Picture(cardWidth, cardHeight);
      if (playable) {
        const map = this.map(playable, level.lastPlaythrough !== null);
        // A level of another size sits centered in the map window and never spills out of it.
        const left = mapLeft + Math.floor((mapSize - Math.min(map.width, mapSize)) / 2);
        const top = mapTop + Math.floor((mapSize - Math.min(map.height, mapSize)) / 2);
        for (let row = 0; row < Math.min(map.height, mapSize); row++)
          picture.packedPixels.set(
            map.packedPixels.subarray(row * map.width, row * map.width + Math.min(map.width, mapSize)),
            (top + row) * cardWidth + left,
          );
      }
      picture.draw(art, 0, 0, 'colored');
      if (!level.isUnlocked)
        picture.draw(
          padlockArt,
          mapLeft + (mapSize - padlockArt.rows[0]!.length) / 2,
          mapTop + (mapSize - padlockArt.rows.length) / 2,
          'colored',
        );
      const button = this.root.createElement('button');
      button.type = 'button';
      button.className = 'level-row';
      button.disabled = !level.isUnlocked;
      button.setAttribute('aria-label', levelRowText(level));
      button.style.setProperty('--art', `url(${pictureUrl(this.root, picture)})`);
      button.style.setProperty('--art-width', String(cardWidth));
      button.style.setProperty('--art-height', String(cardHeight));
      button.addEventListener('click', () => {
        if (this.dither.isWhole) this.chosen(level.id);
      });
      // Nuki marks the level to continue, centered on the map. She stands on her own layer so she can breathe
      // and blink like on the start screen without redrawing the card.
      if (continueLevel !== null && continueLevel.equals(level.id)) button.append(this.hero);
      return { level, button };
    });
    this.list.replaceChildren(
      ...cards.map(({ button }) => {
        const item = this.root.createElement('li');
        item.append(button);
        return item;
      }),
    );
    this.heroFrame = 0;
    this.heroPose = null;
    this.dither.open();
    this.animateHero();
    const focused =
      cards.find(({ level }) => continueLevel !== null && level.id.equals(continueLevel))?.button ??
      menuChoices(this.list)[0];
    focused?.focus({ preventScroll: true });
    focused?.scrollIntoView?.({ block: 'nearest' });
    this.showScrollable();
  }

  // Each scroll button dims once the list has nothing more in its direction.
  private showScrollable(): void {
    const { scrollTop, scrollHeight, clientHeight } = this.list;
    const [up, down] = this.scrollButtons;
    up.disabled = scrollTop <= 0;
    down.disabled = scrollTop + clientHeight >= scrollHeight - 1;
  }

  close(): void {
    this.dither.close();
  }

  advance(): void {
    this.dither.advance();
    if (!this.dither.isOpen) return;
    this.heroFrame++;
    this.animateHero();
  }

  private animateHero(): void {
    const pose = idleHeroPose('down', this.heroFrame);
    if (pose === this.heroPose) return;
    this.heroPose = pose;
    let url = this.heroUrls.get(pose);
    if (!url) {
      url = `url(${artUrl(this.root, pose)})`;
      this.heroUrls.set(pose, url);
    }
    this.hero.style.setProperty('--art', url);
  }

  hide(): void {
    this.dither.dismiss();
  }

  private map(level: PickerLevel, colored: boolean): Picture {
    const key = `${level.id.value} ${colored}`;
    let map = this.maps.get(key);
    if (!map) {
      map = levelMap(level.view, colored, this.random);
      this.maps.set(key, map);
    }
    return map;
  }
}
