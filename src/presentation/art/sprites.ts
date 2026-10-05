import { PixelGrid, type Art, type HeroArt, type HeroDirectionArt, type Legend } from './art';

type Grid = readonly string[];
type Facing = keyof HeroArt;

const heroColors = {
  k: 'Ink', h: 'E3', H: 'E2', l: 'E4', e: 'E1', c: 'Paper', s: 'S2', S: 'S1', t: 'S3',
  p: 'P2', P: 'P1', q: 'P3', j: 'W1', J: 'W0', b: 'E1',
} as const satisfies Legend;
const stoneColors = { k: 'Ink', a: 'N3', b: 'N2', c: 'N4' } as const satisfies Legend;

const heroDown = [
  '............kkkkkkkk............',
  '..........kkllllllhhkk..........',
  '.........klllllllhhhhHk.........',
  '........kllllllhhhhhhHHk........',
  '....kk..klllhhhhhhhhhhHk..kk....',
  '...kllkklhhhhhhhhhhhhhHHkkHhk...',
  '..klhhhPhhhhhhhhhhhhhHHHPhhHHk..',
  '..khhhHPhhhhhhhhhhhhhHHHPHhHHk..',
  '..khhHHkhhHhhHHhhHhhHHHHkHHHHk..',
  '..kHhHkkhtsscesssscessSHkkHHHk..',
  '...kHHkkhtsseesssseessSHkkHHk...',
  '...kHk.khtsseesssseessSHk.kHk...',
  '....k..kHsqqsssSSsssqqSHk..k....',
  '........kkssssssssssSSkk........',
  '..........kkkkSSSSkkkk..........',
  '........kkqqqPSSSSPppPkk........',
  '......kkqqqqpppPPpppppPPkk......',
  '.....kqqppqpppppppppPPpPPPk.....',
  '.....kPPPPPpppqpqpppPPPPPPk.....',
  '......kSSSkpPpqqqpPpPkSSSk......',
  '.....ksssskpPppqppPpPkssssk.....',
  '.....ksssskpPpppppPpPkssssk.....',
  '.....ksssskJJJJJJJJJJkssssk.....',
  '.....kSSSSkjjjjjjjjjJkSSSSk.....',
  '......kkkkkjjjjJJjjjJkkkkk......',
  '..........kjjjJkkjjjJk..........',
  '..........kjjjJkkjjjJk..........',
  '..........kbbbbkkbbbbk..........',
  '.........kbbbbbkkbbbbbk.........',
  '.........kbbbbbkkbbbbbk.........',
  '.........kbbbbbkkbbbbbk.........',
  '..........kkkkk..kkkkk..........',
];

const heroUp = [
  '............kkkkkkkk............',
  '..........kkllllllhhkk..........',
  '.........klllllHhhhhhHk.........',
  '........kllllllHhhhhhHHk........',
  '....kk..klllhhhHhhhhhhHk..kk....',
  '...kllkklhhhhhhHhhhhhhHHkkHhk...',
  '..klhhhPhhhhhhhHhhhhhHHHPhhHHk..',
  '..khhhHPhhhhhhhHhhhhhHHHPHhHHk..',
  '..khhHHkhhhhhhhHhhhhhHHHkHHHHk..',
  '..kHhHkkhhhhhhhHhhhhHHHHkkHHHk..',
  '...kHHkkhhhhhhhHhhhhHHHHkkHHk...',
  '...kHk.kHhhhhhhHhhhhHHHHk.kHk...',
  '....k..kHHhhhhhHhhhHHHHHk..k....',
  '........kkHHHHHHHHHHHHkk........',
  '..........kkkkSSSSkkkk..........',
  '........kkqqqqSSSSppPPkk........',
  '......kkqqqqpppppppppPPPkk......',
  '.....kqqppqpppppppppPPpPPPk.....',
  '.....kPPPPPpppppppppPPPPPPk.....',
  '......kSSSkpPpppppPpPkSSSk......',
  '.....ksssskpPpppppPpPkssssk.....',
  '.....ksssskpPpppppPpPkssssk.....',
  '.....ksssskJJJJJJJJJJkssssk.....',
  '.....kSSSSkjjjjjjjjjJkSSSSk.....',
  '......kkkkkjjjjJJjjjJkkkkk......',
  '..........kjjjJkkjjjJk..........',
  '..........kjjjJkkjjjJk..........',
  '..........kbbbbkkbbbbk..........',
  '.........kbbbbbkkbbbbbk.........',
  '.........kbbbbbkkbbbbbk.........',
  '.........kbbbbbkkbbbbbk.........',
  '..........kkkkk..kkkkk..........',
];

const heroLeft = [
  '............kkkkkkkk............',
  '..........kkllllllhhkk..........',
  '.........klllllllhhhhHk.........',
  '........kllllllhhhhhhHHk........',
  '........klllhhhhhhhhhhHk..kk....',
  '.......khhhhhhhhhhhhhhHHkkHhk...',
  '.......khhhhhhhhhhhhhHHHPhhHHk..',
  '.......khhHhhhHhhhhhhHHHPHhHHk..',
  '.......kttssssHhhhhHHHHHkHHHHk..',
  '.......ktseessHhhhhHHHHHkkHHHk..',
  '.......ksseesSHhhhhHHHHHkkHHk...',
  '......kssseesSHhhhhHHHHHk.kHk...',
  '.......kSsqqsSHhhhHHHHHHk..k....',
  '........kSSSSSkHHHHHHHHk........',
  '.........kkkkkSSSkkkkkk.........',
  '...........kkqqSSSPkk...........',
  '..........kqqqqpppPPk...........',
  '..........kqpqqpppPPk...........',
  '..........kppPPPPPPPk...........',
  '..........kppPSSSPpPk...........',
  '..........kpPssssPpPk...........',
  '..........kJJssssJJJk...........',
  '..........kjjssssjJJk...........',
  '..........kjjSSSSjJJk...........',
  '..........kjjjjjjjJJk...........',
  '.........kjjjjjkJJJJk...........',
  '........kjjjjjk.kJJJJk..........',
  '.......kbbbbbk...kbbbbk.........',
  '......kbbbbbbk...kbbbbk.........',
  '......kbbbbbbk...kbbbbk.........',
  '......kbbbbbbk...kbbbbk.........',
  '.......kkkkkk.....kkkk..........',
];

const heroRight = [
  '............kkkkkkkk............',
  '..........kkllllllhhkk..........',
  '.........klllllllhhhhHk.........',
  '........kllllllhhhhhhHHk........',
  '....kk..klllhhhhhhhhhhHk........',
  '...kllkklhhhhhhhhhhhhhHHk.......',
  '..klhhhPhhhhhhhhhhhhhHHHk.......',
  '..khhhHPhhhhhhhhhHhhhHhHk.......',
  '..khhHHkhhhhhhhhhHtssssSk.......',
  '..kHhHkkhhhhhhhhhHtseesSk.......',
  '...kHHkkhhhhhhhhhHsseesSk.......',
  '...kHk.khhhhhhhhhHsseessSk......',
  '....k..khhhhhhhhHHssqqsSk.......',
  '........kHHHHHHHHkSSSSSk........',
  '.........kkkkkkSSSkkkkk.........',
  '...........kkqSSSpPkk...........',
  '...........kqqqqpppPPk..........',
  '...........kqqqpppPpPk..........',
  '...........kpPPPPPPpPk..........',
  '...........kpPSSSPppPk..........',
  '...........kpPssssPpPk..........',
  '...........kJJssssJJJk..........',
  '...........kjjssssjJJk..........',
  '...........kjjSSSSjJJk..........',
  '...........kJJjjjjjjjk..........',
  '...........kJJJJkjjjjjk.........',
  '..........kJJJJk.kjjjjjk........',
  '.........kbbbbk...kbbbbbk.......',
  '.........kbbbbk...kbbbbbbk......',
  '.........kbbbbk...kbbbbbbk......',
  '.........kbbbbk...kbbbbbbk......',
  '..........kkkk.....kkkkkk.......',
];

const heroHold = [
  '...kkkk.....kkkkkkkk.....kkkk...',
  '..kssssk..kkllllllhhkk..kssssk..',
  '..kssssk.klllllllhhhhHk.kssssk..',
  '..ksssskkllllllhhhhhhHHkkssssk..',
  '..kSSSSkklllhhhhhhhhhhHkkSSSSk..',
  '...kssSklhhhhhhhhhhhhhHHkssSk...',
  '...kssSkhhhhhhhhhhhhhHHHkssSk...',
  '...kssSkhhhhhhhhhhhhhHHHkssSk...',
  '...kssSkhhHhhHHhhHhhHHHHkssSk...',
  '...kssSkhtsscesssscessSHkssSk...',
  '...kssSkhtsseesssseessSHkssSk...',
  '...kssSkhtsseesssseessSHkssSk...',
  '...kqqqkHsqqssseesssqqSHkpPPk...',
  '..kqqqqpkkssssssssssSSkkppPPPk..',
  '..kqqqqqpkkkkkSSSSkkkkkppPPPPk..',
  '..kkqqqqqqqqqPSSSSPppPPPPPPPkk..',
  '....kkqqqqppppPPpppppPPPPPkk....',
  '......kkqqpppppppppppPPPkk......',
  '........kkppppqpqpppPPkk........',
  '..........kpPpqqqpPpPk..........',
  '..........kpPppqppPpPk..........',
  '..........kpPpppppPpPk..........',
  '..........kJJJJJJJJJJk..........',
  '..........kjjjjjjjjjJk..........',
  '..........kjjjjJJjjjJk..........',
  '..........kjjjJkkjjjJk..........',
  '..........kjjjJkkjjjJk..........',
  '..........kbbbbkkbbbbk..........',
  '.........kbbbbbkkbbbbbk.........',
  '.........kbbbbbkkbbbbbk.........',
  '.........kbbbbbkkbbbbbk.........',
  '..........kkkkk..kkkkk..........',
];

// Patches spell out only the pixels that change, so "_" keeps whatever is underneath.
function patch(grid: Grid, column: number, row: number, block: Grid): string[] {
  return grid.map((line, vertical) => {
    const replacement = block[vertical - row];
    if (replacement === undefined) return line;
    return [...line].map((symbol, horizontal) => {
      const next = replacement[horizontal - column];
      return next === undefined || next === '_' ? symbol : next;
    }).join('');
  });
}

const mirrored = (block: Grid): string[] => block.map((line) => [...line].reverse().join(''));

// A hand reaching forward comes toward the camera and so sits lower, and the arm swinging back rises by the same amount, which keeps the silhouette area constant.
const armReach = {
  back: ['kssssk', 'kssssk', 'kssssk', 'kSSSSk', '.kkkkk', '.....k', '.....k'],
  rest: ['.kSSSk', 'kssssk', 'kssssk', 'kssssk', 'kSSSSk', '.kkkkk', '.....k'],
  forward: ['.kSSSk', '.ksssk', 'kssssk', 'kssssk', 'kssssk', 'kSSSSk', '.kkkkk'],
} as const;

// The trailing leg turns away from the light and its heel lifts behind the jeans, so the stride reads without the feet leaving the ground line.
const trailingLeg = ['JJJJ', 'JJJJ', 'JJJJ'];

function frontArms(grid: Grid, left: keyof typeof armReach, right: keyof typeof armReach): string[] {
  return patch(patch(grid, 5, 19, armReach[left]), 21, 19, mirrored(armReach[right]));
}

const sideArm = {
  left: {
    back: ['kpppPSSSPPk', 'kppPssssPPk', 'kJJJssssJJk', 'kjjjssssJJk', 'kjjjSSSSJJk'],
    forward: ['kpPSSSPppPk', 'kPssssPppPk', 'kJssssJJJJk', 'kjssssjjJJk', 'kjSSSSjjJJk'],
  },
  right: {
    back: ['kPSSSPpppPk', 'kPssssPppPk', 'kJssssJJJJk', 'kjssssjjJJk', 'kjSSSSjjJJk'],
    forward: ['kppPSSSPpPk', 'kppPssssPPk', 'kJJJssssJJk', 'kjjjssssJJk', 'kjjjSSSSJJk'],
  },
} as const;

const sideLegsSwapped = {
  left: ['__kJJJJjjjjjk', '_kJJJJJkjjjjk', 'kJJJJJk.kjjjjk'],
  right: ['_kjjjjjJJJJk', '_kjjjjkJJJJJk', 'kjjjjk.kJJJJJk'],
} as const;

const shoulders: Record<Facing, { readonly dipped: Grid; readonly raised: Grid }> = {
  down: {
    dipped: ['________kkpppPSSSSPPPPkk', '______kkpqqqpppPPpppppPPkk', '_____kqqqqqpppppppppPPpPPPk'],
    raised: ['________kkqqqqSSSSqppPkk', '______kkqqqqppppppppppPPkk'],
  },
  up: {
    dipped: ['________kkppppSSSSPPPPkk', '______kkpqqqpppppppppPPPkk', '_____kqqqqqpppppppppPPpPPPk'],
    raised: ['________kkqqqqSSSSqqpPkk', '______kkqqqqppppppppppPPkk'],
  },
  left: {
    dipped: ['___________kkppSSSPkk', '__________kpqqqpppPPk', '__________kqqqqpppPPk'],
    raised: ['___________kkqqSSSqkk', '__________kqqqqppppPk'],
  },
  right: {
    dipped: ['___________kkpSSSPPkk', '___________kpqqqppPPPk', '___________kqqqqpppPPk'],
    raised: ['___________kkqSSSqPkk', '___________kqqqqppppPk'],
  },
};

const closedEyes: Record<Facing, ((grid: Grid) => string[]) | null> = {
  down: (grid) => patch(grid, 12, 9, ['ss____ss', 'ss____ss', 'ee____ee']),
  up: null,
  left: (grid) => patch(grid, 10, 9, ['ss', 'ss', 'ee']),
  right: (grid) => patch(grid, 20, 9, ['ss', 'ss', 'ee']),
};

const heroStand: Record<Facing, Grid> = { down: heroDown, up: heroUp, left: heroLeft, right: heroRight };

function walk(facing: Facing, pose: number): Grid {
  const stand = heroStand[facing];
  const passing = patch(stand, 0, 15, shoulders[facing].dipped);
  if (pose % 2 === 1) return passing;
  const leading = pose === 0 ? 'left' : 'right';
  if (facing === 'down' || facing === 'up') {
    const arms = frontArms(stand, leading === 'left' ? 'back' : 'forward', leading === 'left' ? 'forward' : 'back');
    return patch(arms, leading === 'left' ? 17 : 11, 25, trailingLeg);
  }
  if (pose === 0) return patch(stand, facing === 'left' ? 10 : 11, 19, sideArm[facing].back);
  const swapped = patch(stand, facing === 'left' ? 10 : 11, 19, sideArm[facing].forward);
  return patch(swapped, facing === 'left' ? 8 : 10, 24, sideLegsSwapped[facing]);
}

// The overlay recolors hair only inside the head, so the follow-through never changes the outline or the silhouette area.
const hairLag = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
const isHair = (symbol: string | undefined): boolean => symbol !== undefined && 'hHl'.includes(symbol);

function hair(stand: Grid, [across, down]: readonly [number, number]): Art {
  return {
    legend: heroColors,
    rows: stand.map((line, row) => [...line].map((symbol, column) => {
      if (!isHair(symbol)) return '.';
      const lagging = stand[row + down]?.[column + across];
      return isHair(lagging) ? lagging! : symbol;
    }).join('')),
  };
}

const holdUp = patch(patch(heroHold, 8, 2, heroUp.slice(2, 14).map((line) => line.slice(8, 24))), 14, 18, ['ppp', 'ppp', '_p']);
const heroHolding: Record<Facing, Grid> = { down: heroHold, up: holdUp, left: heroHold, right: heroHold };

const build = (rows: Grid): Art => ({ legend: heroColors, rows });

function heroDirection(facing: Facing): HeroDirectionArt {
  const stand = heroStand[facing];
  const art = build(stand);
  const blink = closedEyes[facing];
  return {
    stand: art,
    settle: art,
    breathe: build(patch(stand, 0, 15, shoulders[facing].raised)),
    blink: blink ? build(blink(stand)) : null,
    walk: [0, 1, 2, 3].map((pose) => build(walk(facing, pose))),
    hair: hairLag.map((lag) => hair(stand, lag)),
    holding: build(heroHolding[facing]),
  };
}

export const heroArt: HeroArt = { down: heroDirection('down'), up: heroDirection('up'), left: heroDirection('left'), right: heroDirection('right') };
export const heroHoldingArt = heroArt.down.holding!;

const stoneShapes = [
  [ // rounded boulder
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
  [ // flat slab
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
  [ // pointed rock
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
const stoneDetails: readonly { shape: number; crack: readonly (readonly [number, number])[]; chips?: readonly (readonly [number, number, string])[] }[] = [
  { shape: 0, crack: [[10, 15], [11, 15], [12, 16], [13, 16], [14, 17], [15, 17], [16, 18]] },
  { shape: 1, crack: [[7, 17], [8, 17], [9, 17], [10, 16], [11, 16], [12, 16]] },
  { shape: 2, crack: [[12, 13], [13, 14], [14, 15], [15, 16], [16, 17], [17, 18]] },
  {
    shape: 0,
    crack: [[13, 14], [14, 14], [15, 14], [16, 15], [17, 15], [18, 15]],
    chips: [[19, 11, '.'], [20, 11, '.'], [18, 11, 'k'], [19, 12, 'k'], [20, 12, 'k']],
  },
  { shape: 1, crack: [[15, 15], [16, 15], [17, 16], [18, 16], [19, 17], [20, 17]] },
];

function stone({ shape, crack, chips = [] }: (typeof stoneDetails)[number]): Art {
  const grid = new PixelGrid(32, 32);
  stoneShapes[shape]!.forEach((line, row) => [...line].forEach((symbol, column) => {
    if (symbol !== '.') grid.put(column, row + stoneTops[shape]!, symbol);
  }));
  for (const [column, row] of crack) if (grid.get(column, row) === 'a') grid.put(column, row, 'b');
  for (const [column, row, symbol] of chips) grid.put(column, row, symbol);
  return grid.build(stoneColors);
}

export const stoneVariants = stoneDetails.map(stone);
export const stoneArt = stoneVariants[0]!;

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
      const edge = [[column - 1, row], [column + 1, row], [column, row - 1], [column, row + 1]].some(([x, y]) => !inside(x!, y!));
      grid.put(column, row, edge ? 'k' : light > 0.38 ? 'a' : 'b');
    }
  }
  // A small hard highlight and a faint bounce light on the far rim are what make the sphere read as glass.
  for (const [column, row] of [[7, 6], [8, 6], [9, 6], [6, 7], [7, 7], [6, 8]] as const) grid.put(column, row, 'c');
  for (const [column, row] of [[15, 16], [16, 15], [17, 14]] as const) grid.put(column, row, 'a');
  const shape = orbSymbols[symbol];
  const left = 12 - Math.ceil(shape[0]!.length / 2);
  const top = 12 - Math.floor(shape.length / 2);
  const carved = (column: number, row: number): boolean => shape[row - top]?.[column - left] === 'x';
  for (let row = top; row <= top + shape.length; row++) {
    for (let column = left; column <= left + shape[0]!.length; column++) {
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
export const violetOrbArt = orbArt.violet;

export const lightMote: Art = { legend: { p: 'Paper' }, rows: ['p'] };

export function groundShadow(width: number, code: 'G1' | 'E2' | 'N2'): Art {
  const grid = new PixelGrid(width, 5);
  grid.rectangle(0, 0, width, 1, 'd');
  grid.rectangle(2, 1, width - 4, 3, 'd');
  grid.rectangle(4, 4, width - 8, 1, 'd');
  return grid.build({ d: code });
}

export const heroShadowArt = { grass: groundShadow(14, 'G1'), path: groundShadow(14, 'E2') };
