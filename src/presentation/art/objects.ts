import { type Art, type Legend, PixelGrid } from './art';

const stoneColors = { k: 'Ink', a: 'N3', b: 'N2', c: 'N4' } as const satisfies Legend;

const stoneShapes = [
  [
    // rounded boulder
    '...........kkkkkkkk.............',
    '.........kkccccaaaakk...........',
    '........kccccaaaaaaaak..........',
    '.......kcccaaaaaaaaaaakk........',
    '......kccaaaaaaaaaaaaaaak.......',
    '.....kccaaaaaaaaaaaaaaaaak......',
    '.....kcaaaaaaaaaaaaaaaaabk......',
    '....kcaaaaaaaaaaaaaaaaaabbk.....',
    '....kaaaaaaaaaaaaaaaaaabbbk.....',
    '....kbaaaaaaaaaaaaaaaabbbbk.....',
    '....kbbbaaaaaaaaaaaaabbbbbk.....',
    '....kbbbbbbaaaaaaaabbbbbbbk.....',
    '.....kbbbbbbbbbbbbbbbbbbbk......',
    '.....kbbbbbbbbbbbbbbbbbbbk......',
    '......kbbbbbbbbbbbbbbbbbk.......',
    '.......kkbbbbbbbbbbbbbkk........',
    '.........kkkkkkkkkkkkk..........',
  ],
  [
    // flat slab
    '..........kkkkkkkkkk............',
    '.......kkkccccaaaaaakkk.........',
    '.....kkccccaaaaaaaaaaaakk.......',
    '....kccccaaaaaaaaaaaaaaaak......',
    '...kccaaaaaaaaaaaaaaaaaaaak.....',
    '...kcaaaaaaaaaaaaaaaaaaaaabk....',
    '...kaaaaaaaaaaaaaaaaaaaaabbk....',
    '...kbbaaaaaaaaaaaaaaaaaabbbk....',
    '...kbbbbbbbbbbbbbbbbbbbbbbbk....',
    '...kbbbbbbbbbbbbbbbbbbbbbbbk....',
    '....kbbbbbbbbbbbbbbbbbbbbbk.....',
    '....kbbbbbbbbbbbbbbbbbbbbbk.....',
    '.....kkbbbbbbbbbbbbbbbbbkk......',
    '.......kkkkkkkkkkkkkkkkk........',
  ],
  [
    // pointed rock
    '..............kkkk..............',
    '............kkccaak.............',
    '...........kcccaaaak............',
    '..........kcccaaaaaak...........',
    '.........kccaaaaaaaaak..........',
    '.........kcaaaaaaaaaaak.........',
    '........kccaaaaaaaaaaabk........',
    '........kcaaaaaaaaaaaabk........',
    '.......kcaaaaaaaaaaaaabbk.......',
    '.......kcaaaaaaaaaaaaabbk.......',
    '......kcaaaaaaaaaaaaaabbbk......',
    '......kaaaaaaaaaaaaaaabbbk......',
    '.....kbaaaaaaaaaaaaaaabbbbk.....',
    '.....kbbaaaaaaaaaaaaabbbbbk.....',
    '.....kbbbbaaaaaaaaabbbbbbbk.....',
    '.....kbbbbbbbbbbbbbbbbbbbbk.....',
    '......kbbbbbbbbbbbbbbbbbbk......',
    '......kbbbbbbbbbbbbbbbbbbk......',
    '.......kkbbbbbbbbbbbbbbkk.......',
    '.........kkkkkkkkkkkkkk.........',
  ],
];
// Every stone ends on row 26 so its ground shadow shows as a contact band directly beneath it.
const stoneTops = [10, 12, 7];

// Each variant pairs a shape with its own crack, so neighbors never repeat even when they share an outline.
const stoneDetails: readonly {
  shape: number;
  crack: readonly (readonly [number, number])[];
  chips?: readonly (readonly [number, number, string])[];
}[] = [
  {
    shape: 0,
    crack: [
      [10, 15],
      [11, 15],
      [12, 16],
      [13, 16],
      [14, 17],
      [15, 17],
      [16, 18],
    ],
  },
  {
    shape: 1,
    crack: [
      [7, 17],
      [8, 17],
      [9, 17],
      [10, 16],
      [11, 16],
      [12, 16],
    ],
  },
  {
    shape: 2,
    crack: [
      [12, 13],
      [13, 14],
      [14, 15],
      [15, 16],
      [16, 17],
      [17, 18],
    ],
  },
  {
    shape: 0,
    crack: [
      [13, 14],
      [14, 14],
      [15, 14],
      [16, 15],
      [17, 15],
      [18, 15],
    ],
    chips: [
      [19, 11, '.'],
      [20, 11, '.'],
      [18, 11, 'k'],
      [19, 12, 'k'],
      [20, 12, 'k'],
    ],
  },
  {
    shape: 1,
    crack: [
      [15, 15],
      [16, 15],
      [17, 16],
      [18, 16],
      [19, 17],
      [20, 17],
    ],
  },
];

function stone({ shape, crack, chips = [] }: (typeof stoneDetails)[number]): Art {
  const grid = new PixelGrid(32, 32);
  stoneShapes[shape]!.forEach((line, row) =>
    [...line].forEach((symbol, column) => {
      if (symbol !== '.') grid.put(column, row + stoneTops[shape]!, symbol);
    }),
  );
  for (const [column, row] of crack) if (grid.get(column, row) === 'a') grid.put(column, row, 'b');
  for (const [column, row, symbol] of chips) grid.put(column, row, symbol);
  return grid.build(stoneColors);
}

export const stoneVariants = stoneDetails.map(stone);

function signpost(): Art {
  const grid = new PixelGrid(32, 32);
  grid.rectangle(13, 18, 6, 9, 'k');
  grid.rectangle(14, 18, 4, 8, 'a');
  grid.rectangle(14, 18, 1, 8, 'h');
  grid.rectangle(17, 18, 1, 8, 's');
  grid.rectangle(5, 6, 22, 13, 'k');
  for (const [column, row] of [
    [5, 6],
    [26, 6],
    [5, 18],
    [26, 18],
  ] as const)
    grid.put(column, row, '.');
  grid.rectangle(6, 7, 20, 11, 'a');
  grid.rectangle(6, 7, 20, 1, 'h');
  grid.rectangle(6, 7, 1, 11, 'h');
  grid.rectangle(6, 17, 20, 1, 's');
  grid.rectangle(25, 7, 1, 11, 's');
  // Two short strokes suggest writing without letters, which the board is too small to hold legibly.
  grid.rectangle(9, 10, 14, 2, 's');
  grid.rectangle(9, 13, 9, 2, 's');
  return grid.build({ k: 'Ink', a: 'E1', h: 'E2', s: 'E0' });
}

export const signpostArt = signpost();
