import { PixelGrid, type Art } from '../graphics/art';
import type { PaletteCode } from '../graphics/palette';

// ΠΟΛΥΧΡΩΜΗ means colorful, so every letter of the logo takes the next color of the rainbow.
const lines = ['Η ΠΟΛΥΧΡΩΜΗ', 'ΠΕΡΙΠΕΤΕΙΑ', 'ΤΗΣ ΝΟΥΚΙ'];
// Each ramp runs light, base, dark, so the letters catch the light on top.
type Ramp = readonly [PaletteCode, PaletteCode, PaletteCode];
const ramps: readonly Ramp[] = [
  ['R3', 'R2', 'R1'],
  ['O3', 'O2', 'O1'],
  ['Y3', 'Y2', 'Y1'],
  ['G4', 'G3', 'G2'],
  ['T3', 'T2', 'T1'],
  ['V3', 'V2', 'V1'],
  ['P3', 'P2', 'P1'],
];
const letterHeight = 15;
const lightRows = 4;
const darkFrom = 11;
const letterGap = 2;
const spaceWidth = 5;
const lineGap = 4;
// Every other letter, starting with the first, sits one pixel lower, so the logo bounces like the rest of the game.
const bounce = 1;
// Closing each line this far fills its notches and word gaps, so every line reads as one solid block.
const lineClosing = 6;
const stickerWidth = 2;
const shadowDepth = 3;
// The shine runs along x + y, so it crosses the letters as a 45 degree streak: a light edge, Paper, a light edge.
const shineWidth = 4;
const shineStride = 2;
export const sparkleMargin = 4;
// Each spot is a sparkle's center in the margined frame, on Ink in a corner or beside a shorter line, so no ray touches the sticker or its shadow.
const sparkles: readonly { x: number; y: number; ray: PaletteCode }[] = [
  { x: 2, y: 2, ray: 'R3' },
  { x: 152, y: 36, ray: 'Y3' },
  { x: 12, y: 56, ray: 'G4' },
  { x: 156, y: 2, ray: 'T3' },
  { x: 147, y: 58, ray: 'P3' },
];
// A sparkle grows from a dot to a star and back, so it twinkles rather than blinks.
const sparkleRays = [0, 1, 2, 1, 0];
// The dark steps between sparkles keep the twinkling an occasional glint, one sparkle at a time.
const sparkleRest = 10;
// The confetti reaches past the logo by these margins, so bits show beside and above it before falling behind it.
export const confettiSide = 6;
export const confettiAbove = 12;
// The bits are spread across the width and down the height, so the falling tile never shows a clump or a gap.
const confetti: readonly { x: number; y: number; color: PaletteCode }[] = [
  { x: 2, y: 0, color: 'R2' },
  { x: 15, y: 37, color: 'G3' },
  { x: 30, y: 74, color: 'P2' },
  { x: 36, y: 26, color: 'Y2' },
  { x: 48, y: 63, color: 'V2' },
  { x: 66, y: 15, color: 'O2' },
  { x: 71, y: 52, color: 'T2' },
  { x: 86, y: 4, color: 'R2' },
  { x: 93, y: 41, color: 'G3' },
  { x: 112, y: 78, color: 'P2' },
  { x: 118, y: 30, color: 'Y2' },
  { x: 127, y: 67, color: 'V2' },
  { x: 139, y: 19, color: 'O2' },
  { x: 159, y: 56, color: 'T2' },
];
const confettiSize = 2;

const font: Readonly<Record<string, readonly string[]>> = {
  Α: [
    '...######...',
    '.##########.',
    '############',
    '####....####',
    '###......###',
    '###......###',
    '############',
    '############',
    '############',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
  ],
  Ε: [
    '############',
    '############',
    '############',
    '###.........',
    '###.........',
    '###.........',
    '##########..',
    '##########..',
    '##########..',
    '###.........',
    '###.........',
    '###.........',
    '############',
    '############',
    '############',
  ],
  Η: [
    '###......###',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
    '############',
    '############',
    '############',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
  ],
  Ι: [
    '#########',
    '#########',
    '#########',
    '...###...',
    '...###...',
    '...###...',
    '...###...',
    '...###...',
    '...###...',
    '...###...',
    '...###...',
    '...###...',
    '#########',
    '#########',
    '#########',
  ],
  Κ: [
    '###......###',
    '###.....###.',
    '###....###..',
    '###...###...',
    '###..###....',
    '###.###.....',
    '######......',
    '#####.......',
    '######......',
    '###.###.....',
    '###..###....',
    '###...###...',
    '###....###..',
    '###.....###.',
    '###......###',
  ],
  Λ: [
    '....####....',
    '...######...',
    '...######...',
    '..###..###..',
    '..###..###..',
    '..###..###..',
    '.###....###.',
    '.###....###.',
    '.###....###.',
    '.###....###.',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
  ],
  Μ: [
    '###......###',
    '####....####',
    '#####..#####',
    '############',
    '###.####.###',
    '###..##..###',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
  ],
  Ν: [
    '######...###',
    '######...###',
    '######...###',
    '######...###',
    '###.###..###',
    '###.###..###',
    '###.###..###',
    '###.###..###',
    '###..###.###',
    '###..###.###',
    '###..###.###',
    '###..###.###',
    '###...######',
    '###...######',
    '###...######',
  ],
  Ο: [
    '...######...',
    '.##########.',
    '############',
    '####....####',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
    '####....####',
    '############',
    '.##########.',
    '...######...',
  ],
  Π: [
    '.##########.',
    '############',
    '############',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
  ],
  Ρ: [
    '##########..',
    '###########.',
    '############',
    '###.....####',
    '###......###',
    '###.....####',
    '############',
    '###########.',
    '##########..',
    '###.........',
    '###.........',
    '###.........',
    '###.........',
    '###.........',
    '###.........',
  ],
  Σ: [
    '############',
    '############',
    '############',
    '####........',
    '.####.......',
    '..####......',
    '...####.....',
    '....####....',
    '...####.....',
    '..####......',
    '.####.......',
    '####........',
    '############',
    '############',
    '############',
  ],
  Τ: [
    '############',
    '############',
    '############',
    '....####....',
    '....####....',
    '....####....',
    '....####....',
    '....####....',
    '....####....',
    '....####....',
    '....####....',
    '....####....',
    '....####....',
    '....####....',
    '....####....',
  ],
  Υ: [
    '###......###',
    '###......###',
    '###......###',
    '.###....###.',
    '.###....###.',
    '..###..###..',
    '..########..',
    '...######...',
    '....####....',
    '....####....',
    '....####....',
    '....####....',
    '....####....',
    '....####....',
    '....####....',
  ],
  Χ: [
    '###......###',
    '###......###',
    '.###....###.',
    '.###....###.',
    '..###..###..',
    '..########..',
    '...######...',
    '....####....',
    '...######...',
    '..########..',
    '..###..###..',
    '.###....###.',
    '.###....###.',
    '###......###',
    '###......###',
  ],
  Ω: [
    '...######...',
    '.##########.',
    '############',
    '####....####',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
    '###......###',
    '####....####',
    '.###....###.',
    '.###....###.',
    '####....####',
    '####....####',
    '####....####',
  ],
};

type Mask = Set<string>;

const key = (x: number, y: number) => `${x},${y}`;
const point = (pixel: string) => pixel.split(',').map(Number) as [number, number];

// A rounded kernel keeps the sticker's corners soft.
function kernel(radius: number): [number, number][] {
  const offsets: [number, number][] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (radius < 2 || Math.abs(dx) + Math.abs(dy) < 2 * radius) offsets.push([dx, dy]);
    }
  }
  return offsets;
}

function dilated(mask: Mask, radius: number): Mask {
  const offsets = kernel(radius);
  const grown: Mask = new Set();
  for (const pixel of mask) {
    const [x, y] = point(pixel);
    for (const [dx, dy] of offsets) grown.add(key(x + dx, y + dy));
  }
  return grown;
}

function eroded(mask: Mask, radius: number): Mask {
  const offsets = kernel(radius);
  return new Set(
    [...mask].filter((pixel) => {
      const [x, y] = point(pixel);
      return offsets.every(([dx, dy]) => mask.has(key(x + dx, y + dy)));
    }),
  );
}

function drawnTitle(): { art: Art; letterRamps: Map<string, Ramp> } {
  const fill = new Map<string, PaletteCode>();
  const rampAt = new Map<string, Ramp>();
  const lineMasks: Mask[] = [];
  const widths = lines.map((line) =>
    [...line].reduce(
      (width, character, index) =>
        width + (index ? letterGap : 0) + (character === ' ' ? spaceWidth : font[character]![0]!.length),
      0,
    ),
  );
  const width = Math.max(...widths);
  let letter = 0;
  lines.forEach((line, lineIndex) => {
    const mask: Mask = new Set();
    let left = Math.floor((width - widths[lineIndex]!) / 2);
    for (const character of line) {
      if (character === ' ') {
        left += spaceWidth + letterGap;
        continue;
      }
      const glyph = font[character]!;
      const ramp = ramps[letter % ramps.length]!;
      const top = lineIndex * (letterHeight + lineGap) + ((letter + 1) % 2) * bounce;
      glyph.forEach((row, y) =>
        [...row].forEach((pixel, x) => {
          if (pixel !== '#') return;
          fill.set(key(left + x, top + y), ramp[y < lightRows ? 0 : y < darkFrom ? 1 : 2]);
          rampAt.set(key(left + x, top + y), ramp);
          mask.add(key(left + x, top + y));
        }),
      );
      left += glyph[0]!.length + letterGap;
      letter++;
    }
    lineMasks.push(mask);
  });

  const outline = dilated(new Set(fill.keys()), 1);
  for (const mask of lineMasks) for (const pixel of eroded(dilated(mask, lineClosing), lineClosing)) outline.add(pixel);
  // Closing the sticker by one pixel fills pinholes between lines, where the shadow would otherwise show through.
  const sticker = eroded(dilated(dilated(outline, stickerWidth), 1), 1);
  const paper = new Set([...sticker].filter((pixel) => !outline.has(pixel)));
  // Paper thinner than two pixels reads as specks, so it turns to outline.
  const thinPaper = [...paper].filter((pixel) => {
    const [x, y] = point(pixel);
    return ![
      [-1, -1],
      [-1, 0],
      [0, -1],
      [0, 0],
    ].some(([ox, oy]) =>
      [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ].every(([dx, dy]) => paper.has(key(x + ox! + dx!, y + oy! + dy!))),
    );
  });
  for (const pixel of thinPaper) {
    paper.delete(pixel);
    outline.add(pixel);
  }

  const all = [...sticker].map(point);
  const left = Math.min(...all.map(([x]) => x));
  const top = Math.min(...all.map(([, y]) => y));
  const grid = new PixelGrid(
    Math.max(...all.map(([x]) => x)) - left + 1,
    Math.max(...all.map(([, y]) => y)) - top + 1 + shadowDepth,
  );
  const codes = [...new Set<PaletteCode>(['Paper', 'Ink', 'V1', ...ramps.flat()])];
  const symbols = new Map(codes.map((code, index) => [code, String.fromCharCode(97 + index)]));
  const paint = (pixel: string, code: PaletteCode) => {
    const [x, y] = point(pixel);
    grid.put(x - left, y - top, symbols.get(code)!);
  };
  for (const pixel of sticker) {
    const [x, y] = point(pixel);
    for (let depth = 1; depth <= shadowDepth; depth++) paint(key(x, y + depth), 'V1');
  }
  for (const pixel of paper) paint(pixel, 'Paper');
  for (const pixel of outline) paint(pixel, 'Ink');
  for (const [pixel, code] of fill) paint(pixel, code);
  const letterRamps = new Map(
    [...rampAt].map(([pixel, ramp]) => {
      const [x, y] = point(pixel);
      return [key(x - left, y - top), ramp] as const;
    }),
  );
  return { art: grid.build(Object.fromEntries(codes.map((code) => [symbols.get(code)!, code]))), letterRamps };
}

export function titleArt(): Art {
  return drawnTitle().art;
}

export function titleShineArts(): Art[] {
  const { art, letterRamps } = drawnTitle();
  const symbolOf = new Map(Object.entries(art.legend).map(([symbol, code]) => [code, symbol]));
  const span = art.rows[0]!.length + art.rows.length;
  return Array.from({ length: Math.ceil((span + shineWidth) / shineStride) }, (_, step) => {
    const front = step * shineStride - shineWidth;
    return {
      legend: art.legend,
      rows: art.rows.map((row, y) =>
        [...row]
          .map((symbol, x) => {
            const ramp = letterRamps.get(key(x, y));
            const offset = x + y - front;
            if (!ramp || offset < 0 || offset >= shineWidth) return symbol;
            return symbolOf.get(offset === 0 || offset === shineWidth - 1 ? ramp[0] : 'Paper')!;
          })
          .join(''),
      ),
    };
  });
}

export function titleSparkleArts(): Art[] {
  const art = titleArt();
  const width = art.rows[0]!.length + 2 * sparkleMargin;
  const height = art.rows.length + 2 * sparkleMargin;
  const codes = [...new Set<PaletteCode>(['Paper', ...sparkles.map(({ ray }) => ray)])];
  const legend = Object.fromEntries(codes.map((code, index) => [String.fromCharCode(97 + index), code]));
  const symbolOf = new Map(Object.entries(legend).map(([symbol, code]) => [code, symbol]));
  const dark = new PixelGrid(width, height).build(legend);
  return sparkles.flatMap(({ x, y, ray }) => [
    ...sparkleRays.map((reach) => {
      const grid = new PixelGrid(width, height);
      grid.put(x, y, symbolOf.get('Paper')!);
      for (let distance = 1; distance <= reach; distance++) {
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ])
          grid.put(x + dx! * distance, y + dy! * distance, symbolOf.get(ray)!);
      }
      return grid.build(legend);
    }),
    ...Array.from({ length: sparkleRest }, () => dark),
  ]);
}

export function titleConfettiArt(): Art {
  const art = titleArt();
  const grid = new PixelGrid(art.rows[0]!.length + 2 * confettiSide, art.rows.length + 2 * confettiAbove);
  const codes = [...new Set(confetti.map(({ color }) => color))];
  const legend = Object.fromEntries(codes.map((code, index) => [String.fromCharCode(97 + index), code]));
  for (const { x, y, color } of confetti)
    grid.rectangle(x, y, confettiSize, confettiSize, String.fromCharCode(97 + codes.indexOf(color)));
  return grid.build(legend);
}
