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
