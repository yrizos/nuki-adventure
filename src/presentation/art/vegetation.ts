import { type Art, hash, type Legend, PixelGrid, scatter, stamp } from './art';

const treeColors = { a: 'G1', b: 'G0', c: 'G3', t: 'E1', T: 'E0' } as const satisfies Legend;
const flowerColors = { y: 'Y3', r: 'R3', v: 'V3', w: 'W3', p: 'Paper', d: 'G1' } as const satisfies Legend;

// One leaf cluster: highlight on its top left, body, and shadow on its bottom right.
const leafCluster = ['..HH..', '.HHMM.', 'HMMMMD', '.MMMDD', '..DD..'];

function trunk(grid: PixelGrid): void {
  const spans: Record<number, [number, number]> = {
    56: [26, 37],
    57: [26, 37],
    58: [25, 38],
    59: [24, 39],
    60: [23, 40],
    61: [23, 40],
  };
  for (let row = 38; row <= 61; row++) {
    const [left, right] = spans[row] ?? [27, 36];
    for (let column = left; column <= right; column++) {
      const shaded = column >= right - 2 || row === 61 || row < 46;
      grid.put(column, row, shaded ? 'T' : 't');
    }
  }
  for (const [column, top, bottom] of [
    [29, 47, 55],
    [32, 49, 58],
    [30, 57, 60],
    [35, 58, 61],
  ] as const) {
    for (let row = top; row <= bottom; row++) grid.put(column, row, 'T');
  }
  for (const [column, row] of [
    [24, 61],
    [27, 61],
    [38, 61],
    [39, 61],
  ] as const)
    grid.put(column, row, '.');
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
  return (column, row) =>
    row <= 47 &&
    (((column - 32) / width) ** 2 + ((row - 25) / height) ** 2 <= 1 ||
      lobes.some(([x, y, radius]) => (column - x) ** 2 + (row - y) ** 2 <= radius ** 2));
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
  const swaying = clusters.filter(([x, y]) => !inside(x + 2, y - 1)).sort((first, second) => first[1] - second[1])[
    variant % 3
  ];
  for (const [x, y] of clusters) {
    const shift = frame === 1 && swaying && x === swaying[0] && y === swaying[1] ? 1 : 0;
    const light = -((x + 2 - 32) / 28) * 0.55 - ((y + 2 - 24) / 22) * 0.85 + (hash(x, y, variant) - 0.5) * 0.35;
    const tone = y > 39 ? 'shadow' : light > 0.05 ? 'lit' : light < -0.55 ? 'shadow' : 'middle';
    const colors = {
      lit: { H: 'c', M: 'a', D: 'b' },
      middle: { H: 'a', M: 'a', D: 'b' },
      shadow: { H: 'a', M: 'b', D: 'b' },
    }[tone];
    leafCluster.forEach((line, row) =>
      [...line].forEach((symbol, column) => {
        const target = [x + column + shift, y + row] as const;
        if (symbol !== '.' && target[0] >= 0 && target[0] < 64 && target[1] >= 0)
          leaves.put(target[0], target[1], colors[symbol as 'H' | 'M' | 'D']);
      }),
    );
  }
  const rows = leaves.build(treeColors).rows;
  rows.forEach((line, row) =>
    [...line].forEach((symbol, column) => {
      if (symbol === '.') return;
      // Scenery is outlined only on its shaded bottom and right edges, in the darkest step of its ramp.
      const edge = (rows[row + 1]?.[column] ?? '.') === '.' || (line[column + 1] ?? '.') === '.';
      grid.put(column, row, edge ? 'b' : symbol);
    }),
  );
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
  const colors = [
    ['r', 'p'],
    ['v', 'w'],
    ['p', 'v'],
  ][variant]!;
  scatter(
    [0, 1, 2, 3].map(() => ['......', '......', '......', '......', '......', '......']),
    variant + 53,
  ).forEach(([, x, y], index) => {
    const shape = (frame === 1 ? swayingBlossom : blossom)[index % 2]!;
    stamp(grid, [shape.map((line) => line.replaceAll('p', colors[index % 2]!)), x, y]);
  });
  return grid.build(flowerColors);
}

export const flowerArt = [0, 1, 2].map((variant) => [flowers(variant, 0), flowers(variant, 1)]);
