import { type Art, hash, type Legend, PixelGrid, scatter, type Stamp, stamp } from './art';

const groundColors = {
  g: 'G2',
  G: 'G3',
  d: 'G1',
  p: 'E3',
  P: 'E4',
  e: 'E2',
  w: 'W1',
  r: 'W2',
  D: 'W0',
  f: 'W4',
} as const satisfies Legend;

const tufts: readonly Stamp[] = [
  ['G...G', '.G.G.', '.GGG.', '..d..'],
  ['...G', '..G.', 'G.G.', 'GG..', '.d..'],
  ['G..', 'G.G', 'GGG', '.d.'],
  ['.G..G', '.GG.G', '..GG.', '..d..'],
];

// Every variant uses the same tufts, so detail density stays equal while their placement differs.
function grass(variant: number): Art {
  const grid = new PixelGrid(32, 32, 'g');
  for (const placed of scatter([...tufts, ...tufts, ...tufts, tufts[0]!, tufts[3]!], variant + 11)) stamp(grid, placed);
  return grid.build(groundColors);
}

const pebbles: readonly Stamp[] = [
  ['PP.', 'Ppe', '.ee'],
  ['PP', 'ee'],
  ['ee..', '.eee'],
  ['PP', '.P'],
];

function path(variant: number): Art {
  const grid = new PixelGrid(32, 32, 'p');
  for (const placed of scatter([...pebbles, ...pebbles, pebbles[0]!, pebbles[1]!], variant + 23)) stamp(grid, placed);
  return grid.build(groundColors);
}

// Each ripple grows and fades back over the four frames, so the surface moves while every frame keeps the same amount of detail.
const rippleLengths = [4, 6, 8, 6];
const ripplePhases = [0, 1, 2, 3, 0, 2];

function water(variant: number, frame: number): Art {
  const grid = new PixelGrid(32, 32, 'w');
  const spots = scatter(
    ripplePhases.map(() => ['..........']),
    variant + 37,
  );
  spots.forEach(([, x, y], index) => {
    const length = rippleLengths[(ripplePhases[index]! + frame) % 4]!;
    grid.rectangle(x + 5 - length / 2, y, length, 1, 'r');
  });
  return grid.build(groundColors);
}

export const grassArt = [0, 1, 2].map(grass);
export const pathArt = [0, 1, 2].map(path);
export const waterArt = [0, 1, 2].map((variant) => [0, 1, 2, 3].map((frame) => water(variant, frame)));

export type GroundCode = 'g' | 'p' | 'w';
const groundCodes: readonly GroundCode[] = ['g', 'p', 'w'];

function wobble(column: number, row: number, seed: number): number {
  const cell = 8;
  const [left, top] = [Math.floor(column / cell), Math.floor(row / cell)];
  const [across, down] = [(column % cell) / cell, (row % cell) / cell];
  const smooth = (value: number): number => value * value * (3 - 2 * value);
  const corner = (x: number, y: number): number => hash(left + x, top + y, seed);
  const upper = corner(0, 0) + (corner(1, 0) - corner(0, 0)) * smooth(across);
  const lower = corner(0, 1) + (corner(1, 1) - corner(0, 1)) * smooth(across);
  return upper + (lower - upper) * smooth(down);
}

function transition(corners: readonly GroundCode[], frame: number): Art {
  const terrain = Array.from({ length: 32 }, (_, row) =>
    Array.from({ length: 32 }, (_, column) => {
      const weights = [(31 - column) * (31 - row), column * (31 - row), (31 - column) * row, column * row];
      const totals = { g: 0, p: 0, w: 0 };
      corners.forEach((ground, index) => {
        totals[ground] += weights[index]!;
      });
      // Wobbling the boundary makes shores and path edges organic, and fading the wobble out toward the tile edges keeps neighbors meeting at the same pixel.
      const taper = Math.sin((Math.PI * column) / 31) * Math.sin((Math.PI * row) / 31);
      for (const ground of groundCodes)
        totals[ground] += taper * 220 * (wobble(column, row, ground.charCodeAt(0)) - 0.5);
      return groundCodes.reduce((selected, ground) => (totals[ground] >= totals[selected] ? ground : selected));
    }),
  );
  const grid = new PixelGrid(32, 32);
  const sources = { g: grassArt[0]!, p: pathArt[0]!, w: waterArt[0]![frame]! };
  for (let row = 0; row < 32; row++) {
    for (let column = 0; column < 32; column++) {
      const ground = terrain[row]![column]!;
      const neighbors = [
        [column - 1, row],
        [column + 1, row],
        [column, row - 1],
        [column, row + 1],
      ];
      const boundary = neighbors.some(([horizontal, vertical]) => {
        const neighbor = terrain[vertical!]?.[horizontal!];
        return neighbor !== undefined && neighbor !== ground;
      });
      const nearWaterEdge =
        ground === 'w' &&
        neighbors.some(([horizontal, vertical]) =>
          [
            [horizontal! - 1, vertical!],
            [horizontal! + 1, vertical!],
            [horizontal!, vertical! - 1],
            [horizontal!, vertical! + 1],
          ].some(([across, down]) => terrain[down!]?.[across!] !== undefined && terrain[down!]![across!] !== 'w'),
        );
      const symbol =
        boundary && ground === 'p'
          ? 'e'
          : boundary && ground === 'w'
            ? 'D'
            : nearWaterEdge && (column + row) % 8 < 5
              ? 'f'
              : sources[ground].rows[row]![column]!;
      grid.put(column, row, symbol);
    }
  }
  return grid.build(groundColors);
}

export const terrainArt: Readonly<Record<string, readonly Art[]>> = Object.fromEntries(
  groundCodes.flatMap((topLeft) =>
    groundCodes.flatMap((topRight) =>
      groundCodes.flatMap((bottomLeft) =>
        groundCodes.map((bottomRight) => {
          const corners = [topLeft, topRight, bottomLeft, bottomRight];
          return [corners.join(''), [0, 1, 2, 3].map((frame) => transition(corners, frame))];
        }),
      ),
    ),
  ),
);
