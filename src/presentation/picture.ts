import type { Art } from './art/art';
import { faded, palette, type PaletteCode } from './palette';

export type Version = 'colored' | 'faded';

interface Sprite {
  readonly width: number;
  readonly height: number;
  readonly colored: Uint8ClampedArray;
  readonly faded: Uint8ClampedArray;
}

const sprites = new WeakMap<Art, Sprite>();

function channels(code: PaletteCode): readonly number[] {
  const hex = palette[code];
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
}

const shading = Object.fromEntries(Object.entries({
  G2: 'G1', G3: 'G2', G1: 'G0', E3: 'E2', E4: 'E3', E2: 'E1', W1: 'W0', W2: 'W1', W4: 'W3',
  N3: 'N2', N4: 'N3', Paper: 'N4',
}).map(([from, to]) => [channels(from as PaletteCode).join(','), channels(to as PaletteCode)]));

export function sprite(art: Art): Sprite {
  const cached = sprites.get(art);
  if (cached) return cached;
  const width = art.rows[0]?.length ?? 0;
  const height = art.rows.length;
  const colored = new Uint8ClampedArray(width * height * 4);
  const fadedPixels = new Uint8ClampedArray(width * height * 4);
  art.rows.forEach((row, y) => {
    if (row.length !== width) throw new RangeError(`Art row ${y} is ${row.length} pixels wide instead of ${width}`);
    [...row].forEach((symbol, x) => {
      if (symbol === '.') return;
      const code = art.legend[symbol];
      if (!code) throw new RangeError(`Art uses "${symbol}", which its legend does not define`);
      const offset = (y * width + x) * 4;
      colored.set([...channels(code), 255], offset);
      fadedPixels.set([...channels(faded(code)), 255], offset);
    });
  });
  if (art.faded) {
    for (const code of Object.values(art.faded.legend)) {
      if (!['Ink', 'N1', 'N2', 'N3', 'N4', 'Paper'].includes(code)) throw new RangeError('Corrected faded art must use neutral colors');
    }
    const corrected = sprite(art.faded);
    if (corrected.width !== width || corrected.height !== height) throw new RangeError('Faded art must match the colored dimensions');
    for (let offset = 3; offset < colored.length; offset += 4) {
      if (corrected.colored[offset] !== colored[offset]) throw new RangeError('Faded art must preserve the colored silhouette');
    }
    fadedPixels.set(corrected.colored);
  }
  const created = { width, height, colored, faded: fadedPixels };
  sprites.set(art, created);
  return created;
}

export class Picture {
  readonly pixels: Uint8ClampedArray;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.pixels = new Uint8ClampedArray(width * height * 4);
  }

  fill(code: PaletteCode): void {
    const color = [...channels(code), 255];
    for (let offset = 0; offset < this.pixels.length; offset += 4) this.pixels.set(color, offset);
  }

  shade(x: number, y: number, width: number, height: number): void {
    for (let row = Math.max(0, y); row < Math.min(this.height, y + height); row++) {
      for (let column = Math.max(0, x); column < Math.min(this.width, x + width); column++) {
        const offset = (row * this.width + column) * 4;
        const darker = shading[this.pixels.subarray(offset, offset + 3).join(',')];
        if (darker) this.pixels.set(darker, offset);
      }
    }
  }

  draw(art: Art, x: number, y: number, version: Version): void {
    if (!Number.isInteger(x) || !Number.isInteger(y)) throw new RangeError('Sprites must be drawn at whole pixel positions');
    const { width, height, [version]: source } = sprite(art);
    for (let row = 0; row < height; row++) {
      const targetY = y + row;
      if (targetY < 0 || targetY >= this.height) continue;
      for (let column = 0; column < width; column++) {
        const targetX = x + column;
        const from = (row * width + column) * 4;
        if (targetX < 0 || targetX >= this.width || source[from + 3] === 0) continue;
        this.pixels.set(source.subarray(from, from + 4), (targetY * this.width + targetX) * 4);
      }
    }
  }
}
