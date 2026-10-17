import { PixelGrid, type Art } from '../graphics/art';
import type { PaletteCode } from '../graphics/palette';

// ΠΟΛΥΧΡΩΜΗ means colorful, so every letter of the logo takes the next color of the rainbow.
const lines = ['Η ΠΟΛΥΧΡΩΜΗ', 'ΠΕΡΙΠΕΤΕΙΑ', 'ΤΗΣ ΝΟΥΚΙ'];
// Each ramp runs light, base, dark, so the letters catch the light on top.
const ramps: readonly (readonly [PaletteCode, PaletteCode, PaletteCode])[] = [
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

export function titleArt(): Art {
  const fill = new Map<string, PaletteCode>();
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
  return grid.build(Object.fromEntries(codes.map((code) => [symbols.get(code)!, code])));
}
