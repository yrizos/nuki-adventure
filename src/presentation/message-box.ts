import type { Art } from './art/art';
import { PixelGrid } from './art/art';
import { glyphHeight, glyphs, glyphWidth } from './art/font';
import type { Picture } from './picture';
import { bayer } from './world-painter';

const margin = 8;
const edge = 2;
const padding = 10;
const letterGap = 2;
const advance = glyphWidth + letterGap;
const lineHeight = glyphHeight + 7;
const dissolveLength = bayer.length * bayer.length;

export function wrap(text: string, boxWidth: number): readonly string[] {
  const perLine = Math.floor((boxWidth - 2 * (edge + padding) + letterGap) / advance);
  const lines: string[] = [];
  for (const word of text.split(' ')) {
    const last = lines.at(-1);
    if (last !== undefined && last.length + 1 + word.length <= perLine) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

function boxArt(text: string, width: number): Art {
  const lines = wrap(text, width);
  const height = 2 * (edge + padding) + lines.length * lineHeight - (lineHeight - glyphHeight);
  const grid = new PixelGrid(width, height, 'k');
  grid.rectangle(1, 1, width - 2, height - 2, 'e');
  grid.rectangle(2, 2, width - 4, height - 4, 'f');
  // Clipping the corners rounds the box the way the panel's buttons are rounded, instead of a plain modern rectangle.
  for (const [column, row] of [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]] as const) grid.put(column, row, '.');
  for (const [column, row] of [[1, 1], [width - 2, 1], [1, height - 2], [width - 2, height - 2]] as const) grid.put(column, row, 'k');
  lines.forEach((line, row) => [...line].forEach((character, column) => {
    const glyph = glyphs[character];
    if (!glyph) throw new RangeError(`The font has no "${character}"`);
    glyph.forEach((pixels, y) => [...pixels].forEach((pixel, x) => {
      if (pixel === '#') grid.put(edge + padding + column * advance + x, edge + padding + row * lineHeight + y, 't');
    }));
  }));
  return grid.build({ k: 'Ink', e: 'V1', f: 'V0', t: 'Paper' });
}

export class MessageBox {
  private state: { readonly text: string; readonly since: number; readonly closing: boolean } | null = null;
  private readonly arts = new Map<string, Art>();

  get text(): string | null {
    return this.state && !this.state.closing ? this.state.text : null;
  }

  show(text: string, frame: number): void {
    if (this.text !== text) this.state = { text, since: frame, closing: false };
  }

  hide(frame: number): void {
    if (this.state && !this.state.closing) this.state = { ...this.state, since: frame, closing: true };
  }

  paint(picture: Picture, frame: number): void {
    if (!this.state) return;
    const elapsed = Math.min(frame - this.state.since + 1, dissolveLength);
    if (this.state.closing && elapsed === dissolveLength) {
      this.state = null;
      return;
    }
    const shown = this.state.closing ? dissolveLength - elapsed : elapsed;
    const width = picture.width - 2 * margin;
    const key = `${width}:${this.state.text}`;
    let art = this.arts.get(key);
    if (!art) {
      art = boxArt(this.state.text, width);
      this.arts.set(key, art);
    }
    // The box dissolves through the same ordered pattern as the restoration, so it needs no transparency.
    picture.draw(art, margin, picture.height - margin - art.rows.length, 'colored', (x, y) => bayer[y & 3]![x & 3]! < shown);
  }
}
