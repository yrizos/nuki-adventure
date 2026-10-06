import type { PaletteCode } from '../palette';

export type Legend = Readonly<Record<string, PaletteCode>>;

export interface Art {
  readonly legend: Legend;
  readonly rows: readonly string[];
  readonly faded?: { readonly legend: Legend; readonly rows: readonly string[] };
}

export interface HeroDirectionArt {
  readonly stand: Art;
  readonly settle: Art;
  readonly breathe: Art;
  readonly blink: Art | null;
  readonly inhaleBlink: Art | null;
  readonly walk: readonly Art[];
  readonly holding?: Art;
}

export interface HeroArt {
  readonly down: HeroDirectionArt;
  readonly up: HeroDirectionArt;
  readonly left: HeroDirectionArt;
  readonly right: HeroDirectionArt;
}

export class PixelGrid {
  private readonly pixels: string[][];

  constructor(width: number, height: number, fill = '.') {
    this.pixels = Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
  }

  put(column: number, row: number, symbol: string): void {
    if (!Number.isInteger(column) || !Number.isInteger(row)) throw new RangeError('Art positions must be whole pixels');
    if (this.pixels[row]?.[column] === undefined)
      throw new RangeError(`Art pixel ${column}, ${row} is outside its grid`);
    this.pixels[row][column] = symbol;
  }

  get(column: number, row: number): string {
    return this.pixels[row]?.[column] ?? '.';
  }

  rectangle(column: number, row: number, width: number, height: number, symbol: string): void {
    for (let vertical = row; vertical < row + height; vertical++) {
      for (let horizontal = column; horizontal < column + width; horizontal++) this.put(horizontal, vertical, symbol);
    }
  }

  build(legend: Legend): Art {
    return { legend, rows: this.pixels.map((row) => row.join('')) };
  }
}

export type Stamp = readonly string[];

// Rejection sampling keeps details apart without settling into rows or a grid, and the one pixel inset keeps them off tile edges they could not continue across.
export function scatter(stamps: readonly Stamp[], seed: number): [Stamp, number, number][] {
  const placed: [Stamp, number, number][] = [];
  let attempt = 0;
  for (const stamp of stamps) {
    const width = stamp[0]!.length;
    const height = stamp.length;
    for (;;) {
      if (++attempt > 10000) throw new RangeError('Ground details do not fit in one tile');
      const x = 1 + Math.floor(hash(seed, attempt, 1) * (31 - width));
      const y = 1 + Math.floor(hash(seed, attempt, 2) * (31 - height));
      const clear = placed.every(
        ([other, left, top]) =>
          x + width < left || left + other[0]!.length < x || y + height < top || top + other.length < y,
      );
      if (clear) {
        placed.push([stamp, x, y]);
        break;
      }
    }
  }
  return placed;
}

export function stamp(grid: PixelGrid, [pattern, x, y]: [Stamp, number, number]): void {
  pattern.forEach((line, row) =>
    [...line].forEach((symbol, column) => {
      if (symbol !== '.') grid.put(x + column, y + row, symbol);
    }),
  );
}

// Art is authored once at load, so a fixed hash keeps every variant identical between runs without storing pixel data for all of them.
export function hash(...values: readonly number[]): number {
  let mixed = 2166136261;
  for (const value of values) mixed = Math.imul(mixed ^ value, 16777619);
  mixed = Math.imul(mixed ^ (mixed >>> 13), 1274126177);
  return ((mixed ^ (mixed >>> 16)) >>> 0) / 4294967296;
}
