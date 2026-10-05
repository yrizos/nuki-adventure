import { PixelGrid, type Art, type Legend } from './art';

const groundColors = {
  g: 'G2', G: 'G3', d: 'G1', p: 'E3', P: 'E4', e: 'E2', w: 'W1', r: 'W2', D: 'W0', f: 'W4',
} as const satisfies Legend;
const treeColors = { a: 'G1', b: 'G0', c: 'G3', t: 'E1', T: 'E0' } as const satisfies Legend;
const flowerColors = { y: 'Y3', r: 'R3', v: 'V3', w: 'W3', p: 'Paper', d: 'G1' } as const satisfies Legend;

type Stamp = readonly string[];

// Rejection sampling keeps details apart without settling into rows or a grid, and the one pixel inset keeps them off tile edges they could not continue across.
function scatter(stamps: readonly Stamp[], seed: number): [Stamp, number, number][] {
  const placed: [Stamp, number, number][] = [];
  let attempt = 0;
  for (const stamp of stamps) {
    const width = stamp[0]!.length;
    const height = stamp.length;
    for (;;) {
      if (++attempt > 10000) throw new RangeError('Ground details do not fit in one tile');
      const x = 1 + Math.floor(hash(seed, attempt, 1) * (31 - width));
      const y = 1 + Math.floor(hash(seed, attempt, 2) * (31 - height));
      const clear = placed.every(([other, left, top]) =>
        x + width < left || left + other[0]!.length < x || y + height < top || top + other.length < y);
      if (clear) {
        placed.push([stamp, x, y]);
        break;
      }
    }
  }
  return placed;
}

function stamp(grid: PixelGrid, [pattern, x, y]: [Stamp, number, number]): void {
  pattern.forEach((line, row) => [...line].forEach((symbol, column) => {
    if (symbol !== '.') grid.put(x + column, y + row, symbol);
  }));
}

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
  const spots = scatter(ripplePhases.map(() => ['..........']), variant + 37);
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
  const terrain = Array.from({ length: 32 }, (_, row) => Array.from({ length: 32 }, (_, column) => {
    const weights = [(31 - column) * (31 - row), column * (31 - row), (31 - column) * row, column * row];
    const totals = { g: 0, p: 0, w: 0 };
    corners.forEach((ground, index) => { totals[ground] += weights[index]!; });
    // Wobbling the boundary makes shores and path edges organic, and fading the wobble out toward the tile edges keeps neighbors meeting at the same pixel.
    const taper = Math.sin((Math.PI * column) / 31) * Math.sin((Math.PI * row) / 31);
    for (const ground of groundCodes) totals[ground] += taper * 220 * (wobble(column, row, ground.charCodeAt(0)) - 0.5);
    return groundCodes.reduce((selected, ground) => totals[ground] >= totals[selected] ? ground : selected);
  }));
  const grid = new PixelGrid(32, 32);
  const sources = { g: grassArt[0]!, p: pathArt[0]!, w: waterArt[0]![frame]! };
  for (let row = 0; row < 32; row++) {
    for (let column = 0; column < 32; column++) {
      const ground = terrain[row]![column]!;
      const neighbors = [[column - 1, row], [column + 1, row], [column, row - 1], [column, row + 1]];
      const boundary = neighbors.some(([horizontal, vertical]) => {
        const neighbor = terrain[vertical!]?.[horizontal!];
        return neighbor !== undefined && neighbor !== ground;
      });
      const nearWaterEdge = ground === 'w' && neighbors.some(([horizontal, vertical]) =>
        [[horizontal! - 1, vertical!], [horizontal! + 1, vertical!], [horizontal!, vertical! - 1], [horizontal!, vertical! + 1]]
          .some(([across, down]) => terrain[down!]?.[across!] !== undefined && terrain[down!]![across!] !== 'w'));
      const symbol = boundary && ground === 'p' ? 'e'
        : boundary && ground === 'w' ? 'D'
        : nearWaterEdge && (column + row) % 8 < 5 ? 'f'
        : sources[ground].rows[row]![column]!;
      grid.put(column, row, symbol);
    }
  }
  return grid.build(groundColors);
}

export const terrainArt: Readonly<Record<string, readonly Art[]>> = Object.fromEntries(
  groundCodes.flatMap((topLeft) => groundCodes.flatMap((topRight) => groundCodes.flatMap((bottomLeft) =>
    groundCodes.map((bottomRight) => {
      const corners = [topLeft, topRight, bottomLeft, bottomRight];
      return [corners.join(''), [0, 1, 2, 3].map((frame) => transition(corners, frame))];
    })))),
);

// Art is authored once at load, so a fixed hash keeps every variant identical between runs without storing pixel data for all of them.
function hash(...values: readonly number[]): number {
  let mixed = 2166136261;
  for (const value of values) mixed = Math.imul(mixed ^ value, 16777619);
  mixed = Math.imul(mixed ^ (mixed >>> 13), 1274126177);
  return ((mixed ^ (mixed >>> 16)) >>> 0) / 4294967296;
}

// One leaf cluster: highlight on its top left, body, and shadow on its bottom right.
const leafCluster = [
  '..HH..',
  '.HHMM.',
  'HMMMMD',
  '.MMMDD',
  '..DD..',
];

function trunk(grid: PixelGrid): void {
  const spans: Record<number, [number, number]> = { 56: [26, 37], 57: [26, 37], 58: [25, 38], 59: [24, 39], 60: [23, 40], 61: [23, 40] };
  for (let row = 38; row <= 61; row++) {
    const [left, right] = spans[row] ?? [27, 36];
    for (let column = left; column <= right; column++) {
      const shaded = column >= right - 2 || row === 61 || row < 46;
      grid.put(column, row, shaded ? 'T' : 't');
    }
  }
  for (const [column, top, bottom] of [[29, 47, 55], [32, 49, 58], [30, 57, 60], [35, 58, 61]] as const) {
    for (let row = top; row <= bottom; row++) grid.put(column, row, 'T');
  }
  for (const [column, row] of [[24, 61], [27, 61], [38, 61], [39, 61]] as const) grid.put(column, row, '.');
  grid.rectangle(26, 60, 2, 1, 'T');
  grid.rectangle(37, 59, 2, 1, 't');
}

function canopy(variant: number): (column: number, row: number) => boolean {
  const width = 21 + (variant % 3);
  const height = 16 + (variant % 2) * 2;
  const count = 8 + (variant % 3);
  const lobes = Array.from({ length: count }, (_, index) => {
    const angle = ((index + hash(variant, index) * 0.6) / count) * Math.PI * 2;
    return [32 + Math.cos(angle) * width, 25 + Math.sin(angle) * height, 8 + hash(index, variant) * 4] as const;
  });
  return (column, row) => row <= 47 && (((column - 32) / width) ** 2 + ((row - 25) / height) ** 2 <= 1
    || lobes.some(([x, y, radius]) => (column - x) ** 2 + (row - y) ** 2 <= radius ** 2));
}

function tree(variant: number, frame: number): Art {
  const grid = new PixelGrid(64, 64);
  trunk(grid);
  const inside = canopy(variant);
  const leaves = new PixelGrid(64, 64);
  for (let row = 2; row < 48; row++) {
    for (let column = 2; column < 62; column++) if (inside(column, row)) leaves.put(column, row, 'b');
  }
  const clusters: [number, number][] = [];
  for (let row = 0; row < 46; row += 4) {
    for (let column = (row / 4) % 2 === 0 ? 0 : 2; column < 60; column += 5) {
      const x = column + Math.floor(hash(variant, column, row) * 2);
      const y = row + Math.floor(hash(row, variant, column) * 2);
      if (inside(x + 2, y + 2)) clusters.push([x, y]);
    }
  }
  // A cluster on the top edge sways on the second frame, which reads as wind without moving the whole crown.
  const swaying = clusters.filter(([x, y]) => !inside(x + 2, y - 1)).sort((first, second) => first[1] - second[1])[variant % 3];
  for (const [x, y] of clusters) {
    const shift = frame === 1 && swaying && x === swaying[0] && y === swaying[1] ? 1 : 0;
    const light = -((x + 2 - 32) / 28) * 0.55 - ((y + 2 - 24) / 22) * 0.85 + (hash(x, y, variant) - 0.5) * 0.35;
    const tone = y > 39 ? 'shadow' : light > 0.05 ? 'lit' : light < -0.55 ? 'shadow' : 'middle';
    const colors = { lit: { H: 'c', M: 'a', D: 'b' }, middle: { H: 'a', M: 'a', D: 'b' }, shadow: { H: 'a', M: 'b', D: 'b' } }[tone];
    leafCluster.forEach((line, row) => [...line].forEach((symbol, column) => {
      const target = [x + column + shift, y + row] as const;
      if (symbol !== '.' && target[0] >= 0 && target[0] < 64 && target[1] >= 0) leaves.put(target[0], target[1], colors[symbol as 'H' | 'M' | 'D']);
    }));
  }
  const rows = leaves.build(treeColors).rows;
  rows.forEach((line, row) => [...line].forEach((symbol, column) => {
    if (symbol === '.') return;
    // Scenery is outlined only on its shaded bottom and right edges, in the darkest step of its ramp.
    const edge = (rows[row + 1]?.[column] ?? '.') === '.' || (line[column + 1] ?? '.') === '.';
    grid.put(column, row, edge ? 'b' : symbol);
  }));
  return grid.build(treeColors);
}

export const treeArt = Array.from({ length: 8 }, (_, variant) => [tree(variant, 0), tree(variant, 1)]);

// Three petals of three pixels each read as a blossom tilted toward the camera, and the stem leans a pixel when it sways.
const blossom = [
  ['.p.p.', 'ppypp', '.ppp.', '..d..', '..dd.', '..d..'],
  ['.p.p.', 'ppypp', '.ppp.', '..d..', '.dd..', '..d..'],
];
const swayingBlossom = [
  ['..p.p', '.ppyp', '..ppp', '..d..', '..dd.', '..d..'],
  ['..p.p', '.ppyp', '..ppp', '..d..', '.dd..', '..d..'],
];

function flowers(variant: number, frame: number): Art {
  const grid = new PixelGrid(32, 32);
  const colors = [['r', 'p'], ['v', 'w'], ['p', 'v']][variant]!;
  scatter([0, 1, 2, 3].map(() => ['......', '......', '......', '......', '......', '......']), variant + 53).forEach(([, x, y], index) => {
    const shape = (frame === 1 ? swayingBlossom : blossom)[index % 2]!;
    stamp(grid, [shape.map((line) => line.replaceAll('p', colors[index % 2]!)), x, y]);
  });
  return grid.build(flowerColors);
}

export const flowerArt = [0, 1, 2].map((variant) => [flowers(variant, 0), flowers(variant, 1)]);

const woodColors = { l: 'E2', w: 'E1', d: 'E0' } as const satisfies Legend;

function rail(grid: PixelGrid, left: number, right: number, top: number): void {
  grid.rectangle(left, top, right - left, 1, 'l');
  grid.rectangle(left, top + 1, right - left, 1, 'w');
  grid.rectangle(left, top + 2, right - left, 1, 'd');
}

// A piece is chosen by its connected neighbors as bits for up, down, left and right, so runs and corners join without seams.
function fence(piece: number): Art {
  const grid = new PixelGrid(32, 32);
  for (const top of [9, 17]) {
    if (piece & 2) rail(grid, 0, 12, top);
    if (piece & 1) rail(grid, 20, 32, top);
  }
  for (const [connected, top, bottom] of [[piece & 8, 0, 4], [piece & 4, 27, 32]] as const) {
    if (!connected) continue;
    grid.rectangle(14, top, 3, bottom - top, 'w');
    grid.rectangle(17, top, 1, bottom - top, 'd');
  }
  grid.rectangle(12, 4, 8, 3, 'l');
  grid.rectangle(12, 7, 8, 19, 'w');
  grid.rectangle(19, 4, 1, 22, 'd');
  grid.rectangle(12, 26, 8, 1, 'd');
  grid.rectangle(14, 10, 1, 8, 'd');
  grid.put(12, 4, '.');
  grid.put(19, 4, '.');
  return grid.build(woodColors);
}

export const fenceArt = Array.from({ length: 16 }, (_, piece) => fence(piece));

function post(grid: PixelGrid, left: number): void {
  grid.rectangle(left, 20, 10, 71, 'w');
  grid.rectangle(left, 20, 2, 70, 'l');
  grid.rectangle(left + 9, 20, 1, 71, 'd');
  grid.rectangle(left, 90, 10, 1, 'd');
  grid.rectangle(left + 4, 26, 1, 14, 'd');
  grid.rectangle(left + 6, 52, 1, 18, 'd');
}

function door(open: boolean): Art {
  const grid = new PixelGrid(96, 96);
  grid.rectangle(0, 4, 96, 3, 'l');
  grid.rectangle(0, 7, 96, 12, 'w');
  grid.rectangle(0, 19, 96, 1, 'd');
  grid.rectangle(95, 4, 1, 16, 'd');
  for (const [column, row, length] of [[8, 10, 20], [40, 14, 24], [70, 11, 16]] as const) grid.rectangle(column, row, length, 1, 'd');
  for (const [column, row] of [[0, 4], [1, 4], [0, 5], [95, 4]] as const) grid.put(column, row, '.');
  post(grid, 0);
  post(grid, 86);
  if (open) {
    // Doorways use the darkest step of their ramp, and the leaves swung inward show only their edges.
    grid.rectangle(15, 20, 66, 71, 'd');
    grid.rectangle(10, 20, 1, 71, 'l');
    grid.rectangle(11, 20, 4, 71, 'w');
    grid.rectangle(81, 20, 1, 71, 'l');
    grid.rectangle(82, 20, 4, 71, 'w');
    return grid.build(woodColors);
  }
  grid.rectangle(10, 20, 76, 71, 'l');
  for (let column = 16; column < 86; column += 6) grid.rectangle(column === 46 ? 47 : column, 20, 1, 71, 'd');
  grid.rectangle(10, 90, 76, 1, 'd');
  for (const top of [32, 70]) {
    rail(grid, 11, 47, top);
    rail(grid, 48, 85, top);
  }
  grid.rectangle(43, 52, 2, 4, 'd');
  grid.rectangle(50, 52, 2, 4, 'd');
  return grid.build(woodColors);
}

export const doorArt = { closed: door(false), open: door(true) } as const;
