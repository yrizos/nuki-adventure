import { type Art, PixelGrid } from '../graphics/art';
import { glyphHeight, glyphs, glyphWidth, letterGap, textWidth } from '../graphics/font';
import { ditherSteps, ditherThreshold } from '../graphics/ordered-dither';
import type { PaletteCode } from '../graphics/palette';
import { Picture, type Version } from '../graphics/picture';
import { butterflyArt, fruitTreeArt, grassArt, groundShadow, heroArt, heroDanceArt } from '../graphics/sprite-library';
import { isDarkened } from '../world/transition/world-transition';
import { fittedMessageBoxArt } from './message-box';
import {
  beatStart,
  introLength,
  panelCount,
  revealedThresholds,
  sinkFrames,
  skipLength,
  trembleOffset,
} from './intro-timeline';

const suddenly = 'ΞΑΦΝΙΚΑ...';
const boom = 'Μ Π Ο Υ Μ !';
const fading = 'ΤΑ ΧΡΩΜΑΤΑ...';
const question = 'ΠΟΥ ΠΗΓΑΝ;';

// The first panel tells its part with the picture alone, so it has no words to repeat.
export const narration = ['', suddenly, boom, fading, question] as const;

const pageMargin = 8;
const gutter = 6;
const frameWidth = 2;
const boxInset = 4;
// Every panel films the same spot, so the tree and Nuki keep one distance and one ground line, centered as a pair.
const trunkToHero = 50;
const pairWidth = 98;
const groundGap = 8;
const treeHeight = 64;
// The boom panel needs room for the sound word above the tree, so it never shrinks below this.
const shortestBoomRow = 116;
const tallestBoomRow = 150;
// The sound word is drawn as big as the panel allows, so narrow phones fall back to a smaller size.
const boomScales = [3, 2];
const skipSize = 13;

export interface Rectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface IntroPanel extends Rectangle {
  readonly picture: Picture;
}

function packed(code: PaletteCode): number {
  const swatch = new Picture(1, 1);
  swatch.fill(code);
  return swatch.packedPixels[0]!;
}

const ink = packed('Ink');
const edge = packed('V1');
const paper = packed('Paper');
const skipShade = packed('N4');
const skipEmpty = packed('N1');

// Apples are copied from the clusters in the apple tree art, so a falling apple matches the ones still hanging.
const apple: Art = {
  legend: { r: 'R2', q: 'R3', s: 'R1' },
  rows: ['.rrr.', 'rqqrs', 'rqrrs', 'rrrss', '.sss.'],
};

// Comic sound words are fat, bright and outlined, so the font is drawn several times bigger with an Ink edge and a
// warm fill that darkens toward the bottom.
function boomArt(scale: number): Art {
  const width = textWidth(boom) * scale + 2;
  const height = glyphHeight * scale + 2;
  const grid = new PixelGrid(width, height);
  [...boom].forEach((character, index) =>
    glyphs[character]!.forEach((pixels, y) =>
      [...pixels].forEach((pixel, x) => {
        if (pixel !== '#') return;
        const left = 1 + (index * (glyphWidth + letterGap) + x) * scale;
        grid.rectangle(left, 1 + y * scale, scale, scale, y < 3 ? 'l' : y < 6 ? 'm' : 'd');
      }),
    ),
  );
  const letter = (x: number, y: number): boolean => ['l', 'm', 'd'].includes(grid.get(x, y));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid.get(x, y) !== '.') continue;
      if ([-1, 0, 1].some((down) => [-1, 0, 1].some((across) => letter(x + across, y + down)))) grid.put(x, y, 'k');
    }
  }
  return grid.build({ k: 'Ink', l: 'Y3', m: 'Y2', d: 'O2' });
}

class Scene {
  readonly picture: Picture;

  constructor(
    width: number,
    height: number,
    private readonly version: Version,
  ) {
    this.picture = new Picture(width, height);
  }

  grass(): void {
    const { width, height } = this.picture;
    for (let row = 0; row * 32 < height; row++) {
      for (let column = 0; column * 32 < width; column++)
        this.draw(grassArt[(column * 2 + row) % grassArt.length]!, column * 32, height - (row + 1) * 32);
    }
  }

  draw(art: Art, x: number, y: number, version: Version = this.version): void {
    this.picture.draw(art, Math.round(x), Math.round(y), version);
  }

  tree(trunk: number, base: number): void {
    const tree = fruitTreeArt.apple[0]!;
    this.draw(groundShadow(12, 'G1'), trunk - 6, base - 4);
    this.draw(tree, trunk - 32, base - tree.rows.length);
  }

  hero(art: Art, center: number, feet: number): void {
    this.draw(groundShadow(14, 'G1'), center - 7, feet);
    this.draw(art, center - 16, feet - 32, 'colored');
  }

  box(text: string, widest: number, x: number, y: number): void {
    this.picture.draw(fittedMessageBoxArt(text, widest), x, y, 'colored');
  }
}

function trunkFor(width: number): number {
  return Math.floor((width - pairWidth) / 2) + 32;
}

function orchard(scene: Scene, pose: Art): { readonly trunk: number; readonly base: number } {
  const { width, height } = scene.picture;
  const trunk = trunkFor(width);
  const base = height - groundGap;
  scene.grass();
  scene.tree(trunk, base);
  scene.hero(pose, trunk + trunkToHero, base);
  return { trunk, base };
}

function playingPanel(width: number, height: number): Picture {
  const scene = new Scene(width, height, 'colored');
  const { trunk, base } = orchard(scene, heroDanceArt[1]!);
  scene.draw(butterflyArt[0]![0]!, trunk + 22, base - 46);
  return scene.picture;
}

// Nuki stops dancing and stands still, so something is about to happen.
function suddenlyPanel(width: number, height: number): Picture {
  const scene = new Scene(width, height, 'colored');
  const { trunk, base } = orchard(scene, heroArt.down.stand);
  scene.draw(butterflyArt[0]![0]!, trunk + 22, base - 46);
  scene.box(suddenly, width - 2 * boxInset, boxInset, boxInset);
  return scene.picture;
}

// Falling apples hang above their own ground shadows, the way the game shows anything off the ground.
function boomPanel(width: number, height: number): Picture {
  const scene = new Scene(width, height, 'colored');
  const { trunk, base } = orchard(scene, heroArt.down.stand);
  for (const [x, drop] of [
    [-28, 16],
    [16, 12],
    [-14, 8],
  ] as const) {
    scene.draw(groundShadow(8, 'G1'), trunk + x - 1, base - 1);
    scene.draw(apple, trunk + x, base - drop);
  }
  scene.draw(butterflyArt[0]![1]!, width - 20, Math.floor(height * 0.5));
  const scale = boomScales.find((size) => textWidth(boom) * size + 2 <= width - 2 * boxInset) ?? boomScales.at(-1)!;
  const sound = boomArt(scale);
  // The word sits just above the treetop, so it reads as bursting out of the orchard instead of floating in the sky.
  const top = Math.max(boxInset, base - treeHeight - sound.rows.length - 4);
  scene.picture.draw(sound, Math.floor((width - sound.rows[0]!.length) / 2), top, 'colored');
  return scene.picture;
}

// The gray reaches the tree first and stops halfway across it, while Nuki and the grass beside her keep their color.
function fadingPanel(width: number, height: number): Picture {
  const colored = new Scene(width, height, 'colored');
  const faded = new Scene(width, height, 'faded');
  const { trunk } = orchard(colored, heroArt.down.stand);
  orchard(faded, heroArt.down.stand);
  const picture = colored.picture;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const share = Math.min(1, Math.max(0, (trunk - x + (y - height / 2) * 0.3) / 24 + 0.5));
      if (ditherThreshold(x, y) < share * ditherSteps)
        picture.packedPixels[y * width + x] = faded.picture.packedPixels[y * width + x]!;
    }
  }
  colored.hero(heroArt.down.stand, trunk + trunkToHero, height - groundGap);
  colored.box(fading, width - 2 * boxInset, boxInset, boxInset);
  return picture;
}

function questionPanel(width: number, height: number): Picture {
  const scene = new Scene(width, height, 'faded');
  orchard(scene, heroArt.down.stand);
  scene.box(question, width - 2 * boxInset, boxInset, boxInset);
  return scene.picture;
}

// Panels wear the frame of the game's message box and level cards: an Ink line, a V1 edge and clipped corners.
function framed(content: Picture): Picture {
  const { width, height } = content;
  const picture = new Picture(width + 2 * frameWidth, height + 2 * frameWidth);
  picture.packedPixels.fill(edge);
  for (let x = 0; x < picture.width; x++) {
    picture.packedPixels[x] = ink;
    picture.packedPixels[(picture.height - 1) * picture.width + x] = ink;
  }
  for (let y = 0; y < picture.height; y++) {
    picture.packedPixels[y * picture.width] = ink;
    picture.packedPixels[y * picture.width + picture.width - 1] = ink;
  }
  for (const [x, y] of [
    [1, 1],
    [picture.width - 2, 1],
    [1, picture.height - 2],
    [picture.width - 2, picture.height - 2],
  ] as const)
    picture.packedPixels[y * picture.width + x] = ink;
  for (let y = 0; y < height; y++)
    picture.packedPixels.set(
      content.packedPixels.subarray(y * width, (y + 1) * width),
      (y + frameWidth) * picture.width + frameWidth,
    );
  return picture;
}

function boxHeight(text: string, panelWidth: number): number {
  if (text === '') return -2 * boxInset;
  return fittedMessageBoxArt(text, panelWidth - 2 * frameWidth - 2 * boxInset).rows.length;
}

// A row of two is as tall as its taller text box plus the tree beneath it. On short pages the outer rows give up
// height first, so their boxes may cover the top of the tree, while the boom row keeps room for its sound word.
export function introPage(width: number, height: number): readonly Rectangle[] {
  const panelWidth = width - 2 * pageMargin;
  const left = Math.floor((panelWidth - gutter) / 2);
  const right = panelWidth - left - gutter;
  const need = (first: string, second: string): number =>
    Math.max(boxHeight(first, left), boxHeight(second, right)) + 2 * boxInset + treeHeight + groundGap + 2 * frameWidth;
  const available = height - 2 * pageMargin - 2 * gutter;
  const top = need('', suddenly);
  const bottom = need(fading, question);
  const squeeze = Math.min(1, (available - shortestBoomRow) / (top + bottom));
  const first = Math.floor(top * squeeze);
  const third = Math.floor(bottom * squeeze);
  const second = Math.min(tallestBoomRow, available - first - third);
  const start = pageMargin + Math.floor((available - first - second - third) / 2);
  const middle = start + first + gutter;
  const last = middle + second + gutter;
  return [
    { x: pageMargin, y: start, width: left, height: first },
    { x: pageMargin + left + gutter, y: start, width: right, height: first },
    { x: pageMargin, y: middle, width: panelWidth, height: second },
    { x: pageMargin, y: last, width: left, height: third },
    { x: pageMargin + left + gutter, y: last, width: right, height: third },
  ];
}

const painters = [playingPanel, suddenlyPanel, boomPanel, fadingPanel, questionPanel];

function drawPanels(width: number, height: number): readonly IntroPanel[] {
  return introPage(width, height).map((place, index) => ({
    ...place,
    picture: framed(painters[index]!(place.width - 2 * frameWidth, place.height - 2 * frameWidth)),
  }));
}

export class Intro {
  private frame = 0;
  private heldFrames = 0;
  private panels: { readonly width: number; readonly height: number; readonly drawn: readonly IntroPanel[] } | null =
    null;
  private painted: { readonly picture: Picture; readonly frame: number; readonly held: number } | null = null;

  constructor(private readonly hold: { readonly isHeld: boolean }) {}

  get finished(): boolean {
    return this.frame >= introLength || this.heldFrames >= skipLength;
  }

  get messageText(): string {
    return narration.findLast((_, panel) => this.frame >= beatStart(panel)) ?? '';
  }

  tick(): void {
    if (this.finished) return;
    this.frame++;
    this.heldFrames = this.hold.isHeld ? this.heldFrames + 1 : 0;
  }

  paint(picture: Picture): void {
    const held = this.hold.isHeld ? this.heldFrames : -1;
    const painted = this.painted;
    if (painted?.picture === picture && painted.frame === this.frame && painted.held === held) return;
    this.painted = { picture, frame: this.frame, held };
    if (this.panels?.width !== picture.width || this.panels.height !== picture.height)
      this.panels = { width: picture.width, height: picture.height, drawn: drawPanels(picture.width, picture.height) };
    picture.fill('Ink');
    for (let index = 0; index < panelCount; index++) {
      const shown = revealedThresholds(index, this.frame);
      if (shown > 0) this.copy(picture, this.panels.drawn[index]!, shown, trembleOffset(this.frame));
    }
    const sinking = sinkFrames(this.frame);
    if (sinking >= 0) {
      for (let y = 0; y < picture.height; y++) {
        for (let x = 0; x < picture.width; x++)
          if (isDarkened(x, y, sinking)) picture.packedPixels[y * picture.width + x] = ink;
      }
    }
    if (held >= 0) this.paintSkip(picture, held / skipLength);
  }

  private copy(picture: Picture, panel: IntroPanel, shown: number, offset: { x: number; y: number }): void {
    const source = panel.picture;
    for (let y = 0; y < source.height; y++) {
      const pageY = panel.y + offset.y + y;
      if (pageY < 0 || pageY >= picture.height) continue;
      for (let x = 0; x < source.width; x++) {
        const pageX = panel.x + offset.x + x;
        if (pageX < 0 || pageX >= picture.width || ditherThreshold(pageX, pageY) >= shown) continue;
        picture.packedPixels[pageY * picture.width + pageX] = source.packedPixels[y * source.width + x]!;
      }
    }
  }

  // The circle is drawn like the clock on the level cards, an Ink ring with a shaded Paper face, so it belongs to the game
  // without looking like a switch. Paper fills it clockwise from the top over a dark face.
  private paintSkip(picture: Picture, progress: number): void {
    const left = picture.width - pageMargin - skipSize;
    const top = picture.height - pageMargin - skipSize;
    const radius = skipSize / 2;
    const inside = (column: number, row: number): boolean =>
      (column + 0.5 - radius) ** 2 + (row + 0.5 - radius) ** 2 <= radius * radius;
    for (let row = 0; row < skipSize; row++) {
      for (let column = 0; column < skipSize; column++) {
        if (!inside(column, row)) continue;
        const ring = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([across, down]) => !inside(column + across!, row + down!));
        const turn = (Math.atan2(column + 0.5 - radius, radius - row - 0.5) / (2 * Math.PI) + 1) % 1;
        const face = turn >= progress ? skipEmpty : inside(column + 1, row + 1) ? paper : skipShade;
        picture.packedPixels[(top + row) * picture.width + left + column] = ring ? ink : face;
      }
    }
  }
}
