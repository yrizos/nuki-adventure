import type { LevelId, LevelView } from '../../level';
import type { LevelProgressView, PlayTime, ProgressView } from '../../progress';
import { PixelGrid, type Art } from '../graphics/art';
import { glyphHeight, textWidth, writeText } from '../graphics/font';
import { backWidth, scrollButtonWidth, textButtonHeight } from '../graphics/panel';
import { artUrl, pictureUrl } from '../graphics/canvas-art';
import { DitherModal, modalWidth } from './dither-modal';
import { element } from '../shell/dom';
import { levelMap, mapSize } from './level-map';
import { idlePose } from '../world/hero-animator';
import { menuChoices, takeMenuKeys } from './menu-keys';
import { Picture } from '../graphics/picture';
import { heroArt, smallPadlockArt } from '../graphics/sprite-library';

const framesPerSecond = 60;
// Two cards share a row, so the clock shrinks to sit beside the time on one strip.
const iconSize = 9;
const edge = 2;
const inset = 4;
const boxPadding = 6;
// Two cards to a row. Rounding down to an even width keeps the map centered on whole pixels.
export const cardWidth = 2 * Math.floor((modalWidth - 2 * boxPadding - 6) / 4);
const mapTop = edge + inset;
const mapLeft = (cardWidth - mapSize) / 2;
const stripTop = mapTop + mapSize + inset + 1;
const stripHeight = 15;
export const cardHeight = stripTop + stripHeight + edge;
const iconTop = stripTop + (stripHeight - iconSize) / 2;
const iconGap = 2;
// The number sits over the map's top left corner, clear of its Ink border.
const numberInset = 4;
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
      grid.put(column, row, edge ? 'k' : !inside(column + 1, row + 1) ? 'q' : 'p');
    }
  }
  grid.rectangle(4, 2, 1, 3, 'k');
  grid.rectangle(5, 4, 2, 1, 'k');
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

// Over the map, an Ink outline keeps the number readable on any ground.
function putNumber(grid: PixelGrid, number: string, left: number, top: number): void {
  const text = new PixelGrid(textWidth(number), glyphHeight);
  writeText(text, number, 0, 0, 't');
  const lit = (column: number, row: number): boolean =>
    column >= 0 && row >= 0 && column < textWidth(number) && row < glyphHeight && text.get(column, row) !== '.';
  for (let row = -1; row <= glyphHeight; row++)
    for (let column = -1; column <= textWidth(number); column++) {
      if (lit(column, row)) grid.put(left + column, top + row, 't');
      else if ([-1, 0, 1].some((down) => [-1, 0, 1].some((across) => lit(column + across, row + down))))
        grid.put(left + column, top + row, 'k');
    }
}

// The map shows through the window left open above the strip, inside a one pixel Ink border. A locked level keeps
// the window closed, so its layout stays a surprise.
export function levelCardArt(level: LevelProgressView): Art {
  const grid = windowFrame(cardWidth, cardHeight);
  grid.rectangle(mapLeft - 1, mapTop - 1, mapSize + 2, mapSize + 2, 'k');
  grid.rectangle(mapLeft, mapTop, mapSize, mapSize, level.isUnlocked ? '.' : 'f');
  grid.rectangle(edge, stripTop - 1, cardWidth - 2 * edge, 1, 'e');
  putNumber(grid, String(level.number), mapLeft + numberInset, mapTop + numberInset);
  const playthrough = level.lastPlaythrough;
  if (playthrough) {
    const time = playTime(playthrough.time);
    const timeLeft = cardWidth - edge - inset - textWidth(time);
    putClock(grid, timeLeft - iconGap - iconSize, iconTop);
    writeText(grid, time, timeLeft, iconTop + iconTextTop, 't');
  }
  return grid.build(windowLegend);
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
  return `ΕΠΙΠΕΔΟ ${level.number}. ΧΡΟΝΟΣ ${playTime(level.lastPlaythrough.time)}.`;
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
    this.dither = new DitherModal(root, screen, box, element(root, '.menu-screen'), element(root, '.menu-pick-level'));
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
      const art = levelCardArt(level);
      const picture = new Picture(cardWidth, cardHeight);
      if (playable && level.isUnlocked) {
        const map = this.map(playable);
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
          smallPadlockArt,
          mapLeft + (mapSize - smallPadlockArt.rows[0]!.length) / 2,
          mapTop + (mapSize - smallPadlockArt.rows.length) / 2,
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
      // and blink like on the menu screen without redrawing the card.
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
    const pose = idlePose(heroArt.down, this.heroFrame);
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

  // Every unlocked level shows its world in color, played or not, so the picker reads as an invitation.
  private map(level: PickerLevel): Picture {
    let map = this.maps.get(level.id.value);
    if (!map) {
      map = levelMap(level.view, true, this.random);
      this.maps.set(level.id.value, map);
    }
    return map;
  }
}
