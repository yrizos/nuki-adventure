import { type Art, type Legend, PixelGrid } from './art';

const orbSymbols = {
  triangle: ['...x...', '..xxx..', '.xxxxx.', 'xxxxxxx'],
  cross: ['..xx..', '..xx..', 'xxxxxx', 'xxxxxx', '..xx..', '..xx..'],
  diamond: ['..xx..', '.xxxx.', 'xxxxxx', 'xxxxxx', '.xxxx.', '..xx..'],
  square: ['xxxxxx', 'xxxxxx', 'xx..xx', 'xx..xx', 'xxxxxx', 'xxxxxx'],
} as const;

function orb(legend: Legend, symbol: keyof typeof orbSymbols): Art {
  const grid = new PixelGrid(24, 24);
  const radius = 8;
  // Hand-set row widths keep the circle round at this size, where a computed one turns octagonal.
  const widths = [6, 10, 12, 14, 14, 16, 16, 16, 16, 16, 16, 14, 14, 12, 10, 6];
  const inside = (column: number, row: number): boolean => Math.abs(column - 11.5) < (widths[row - 4] ?? 0) / 2;
  for (let row = 0; row < 24; row++) {
    for (let column = 0; column < 24; column++) {
      if (!inside(column, row)) continue;
      const across = (column - 11.5) / radius;
      const down = (row - 11.5) / radius;
      const toward = Math.sqrt(Math.max(0, 1 - across ** 2 - down ** 2));
      // Lighting a true sphere from the top left gives the curved terminator the style asks for instead of a ring of shading.
      const light = -0.45 * across - 0.55 * down + 0.7 * toward;
      const edge = [
        [column - 1, row],
        [column + 1, row],
        [column, row - 1],
        [column, row + 1],
      ].some(([x, y]) => !inside(x!, y!));
      grid.put(column, row, edge ? 'k' : light > 0.38 ? 'a' : 'b');
    }
  }
  // A small hard highlight and a faint bounce light on the far rim are what make the sphere read as glass.
  for (const [column, row] of [
    [7, 6],
    [8, 6],
    [9, 6],
    [6, 7],
    [7, 7],
    [6, 8],
  ] as const)
    grid.put(column, row, 'c');
  for (const [column, row] of [
    [15, 16],
    [16, 15],
    [17, 14],
  ] as const)
    grid.put(column, row, 'a');
  const shape = orbSymbols[symbol];
  const left = 12 - Math.ceil(shape[0].length / 2);
  const top = 12 - Math.floor(shape.length / 2);
  const carved = (column: number, row: number): boolean => shape[row - top]?.[column - left] === 'x';
  for (let row = top; row <= top + shape.length; row++) {
    for (let column = left; column <= left + shape[0].length; column++) {
      if (carved(column, row)) grid.put(column, row, 'c');
      // An engraved symbol catches a shadow on its lower right edge, so it sits in the glass rather than floating on it.
      else if (carved(column - 1, row - 1)) grid.put(column, row, 'b');
    }
  }
  return grid.build(legend);
}

export const orbArt = {
  red: orb({ k: 'Ink', a: 'R2', b: 'R1', c: 'R3' }, 'triangle'),
  blue: orb({ k: 'Ink', a: 'W2', b: 'W1', c: 'W3' }, 'cross'),
  violet: orb({ k: 'Ink', a: 'V2', b: 'V1', c: 'V3' }, 'diamond'),
  teal: orb({ k: 'Ink', a: 'T2', b: 'T1', c: 'T3' }, 'square'),
} as const;

// A computed star turns spiky and uneven at this size, so its outline is drawn by hand.
const starShape = [
  '.......kk.......',
  '......kaak......',
  '......kaak......',
  '.....kaaaak.....',
  '.....kaaaak.....',
  'kkkkkaaaaaakkkkk',
  'kaaaaaaaaaaaaaak',
  '.kaaaaaaaaaaaak.',
  '..kaaaaaaaaaak..',
  '...kaaaaaaaak...',
  '...kaaaaaaaak...',
  '..kaaaaaaaaaak..',
  '..kaaaakkaaaak..',
  '.kaaakk..kkaaak.',
  '.kaak......kaak.',
  '.kkk........kkk.',
];

function star(): Art {
  const grid = new PixelGrid(24, 24);
  starShape.forEach((line, row) =>
    [...line].forEach((pixel, column) => {
      // Shading the half below the diagonal through the center keeps the dark side on the bottom right, away from the light.
      if (pixel !== '.') grid.put(column + 4, row + 4, pixel === 'k' ? 'k' : column + row >= 18 ? 'b' : 'a');
    }),
  );
  for (const [column, row] of [
    [7, 2],
    [7, 3],
    [2, 6],
    [3, 6],
  ] as const)
    grid.put(column + 4, row + 4, 'c');
  return grid.build({ k: 'Ink', a: 'Y2', b: 'Y1', c: 'Y3' });
}

export const starArt = star();
