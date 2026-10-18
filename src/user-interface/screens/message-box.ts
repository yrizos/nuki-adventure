import type { Art } from '../graphics/art';
import { PixelGrid } from '../graphics/art';
import { glyphHeight, lineHeight, textWidth, wrapText, writeText } from '../graphics/font';
import { ditherSteps, ditherThreshold } from '../graphics/ordered-dither';
import type { Picture } from '../graphics/picture';

const margin = 8;
const edge = 2;
const padding = 10;
const lineGap = 6;
const dissolveLength = ditherSteps;
// Half a second with eased dither steps lets a box fade in gently instead of popping through the pattern.
const arrivalLength = 30;
// A short pause after each arrival lets the reader take in one line before the next pushes it up.
const lineDelay = arrivalLength + 15;

export function wrap(text: string, boxWidth: number): readonly string[] {
  return wrapText(text, boxWidth - 2 * (edge + padding));
}

// The box shrinks to its longest line, so a short text gets a small box instead of one spanning the view.
export function fittedMessageBoxArt(text: string, widest: number): Art {
  const lines = wrap(text, widest);
  return boxArt(text, Math.max(...lines.map(textWidth)) + 2 * (edge + padding));
}

function boxArt(text: string, width: number): Art {
  const lines = wrap(text, width);
  const height = 2 * (edge + padding) + lines.length * lineHeight - (lineHeight - glyphHeight);
  const grid = new PixelGrid(width, height, 'k');
  grid.rectangle(1, 1, width - 2, height - 2, 'e');
  grid.rectangle(2, 2, width - 4, height - 4, 'f');
  // Clipping the corners rounds the box the way the panel's buttons are rounded, instead of a plain modern rectangle.
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
  lines.forEach((line, row) => writeText(grid, line, edge + padding, edge + padding + row * lineHeight, 't'));
  return grid.build({ k: 'Ink', e: 'V1', f: 'V0', t: 'Paper' });
}

export class MessageBox {
  private state: {
    readonly text: string;
    readonly since: number;
    readonly closing: boolean;
    readonly opened: number;
  } | null = null;
  private readonly arts = new Map<string, Art>();

  get text(): string | null {
    return this.state && !this.state.closing ? this.state.text : null;
  }

  show(text: string, frame: number): void {
    if (this.text !== text) this.state = { text, since: frame, closing: false, opened: 0 };
  }

  hide(frame: number): void {
    if (this.state && !this.state.closing)
      this.state = { ...this.state, since: frame, closing: true, opened: this.opened(this.state.since, frame) };
  }

  paint(picture: Picture, frame: number): void {
    if (!this.state) return;
    const { text, since, closing } = this.state;
    const closed = Math.min(frame - since + 1, dissolveLength);
    if (closing && closed === dissolveLength) {
      this.state = null;
      return;
    }
    const width = picture.width - 2 * margin;
    const lines = text.split('\n').slice(0, closing ? this.state.opened : this.opened(since, frame));
    const newest = lines.length - 1;
    const progress = Math.min((frame - since - newest * lineDelay + 1) / arrivalLength, 1);
    const eased = closing ? 1 : progress * progress * (3 - 2 * progress);
    // A later line rises from below the bottom edge, so the boxes above move up with it instead of making room first.
    const rise = newest > 0 ? Math.round((1 - eased) * (lineGap + this.art(lines[newest]!, width).rows.length)) : 0;
    let top = picture.height - margin + lineGap + rise;
    lines.toReversed().forEach((line, fromBottom) => {
      const arriving = fromBottom === 0 && !closing;
      const shown = closing ? dissolveLength - closed : arriving ? Math.round(dissolveLength * eased) : dissolveLength;
      const art = this.art(line, width);
      top -= lineGap + art.rows.length;
      // The box dissolves through the same ordered pattern as the restoration, so it needs no transparency.
      picture.draw(art, margin, top, 'colored', (x, y) => ditherThreshold(x, y) < shown);
    });
  }

  private opened(since: number, frame: number): number {
    return frame < since ? 0 : Math.floor((frame - since) / lineDelay) + 1;
  }

  private art(line: string, width: number): Art {
    const key = `${width}:${line}`;
    let art = this.arts.get(key);
    if (!art) {
      art = fittedMessageBoxArt(line, width);
      this.arts.set(key, art);
    }
    return art;
  }
}
