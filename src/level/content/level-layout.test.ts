import { describe, expect, test } from 'vitest';
import { check2dObstacles } from '../infrastructure/check2d-obstacles';
import { Door } from '../domain/door';
import { Stone } from '../domain/level';
import { LevelId } from '../domain/level-id';
import { Direction, TilePosition } from '../domain/position';
import { Fence, Flower, FlowerVariant, Ground, LevelSize, Scenery, Tree, TreeVariant } from '../domain/scenery';
import { levelFromLayout } from './level-layout';
import { SwingGate } from '../domain/swing-gate';
import { Boulder } from '../domain/boulder';
import { lowestRoll, seededRandom } from '../testing/draws';
import { follow, openGate, pathTo } from '../testing/walk-level';

const at = TilePosition.at;
const keepOrder = (positions: readonly TilePosition[]): readonly TilePosition[] => positions;
const layout = ['.DDD..', 'Tt...F', '#H*o~.', '.....Q'];

describe('a level built from a layout', () => {
  const level = levelFromLayout(LevelId.of('layout'), layout, keepOrder, check2dObstacles, lowestRoll);

  test('places the hero facing up and a closed door', () => {
    expect(level.id.value).toBe('layout');
    expect(level.hero.position).toEqual(at(1, 2));
    expect(level.hero.facing).toBe(Direction.Up);
    expect(level.door).toEqual(Door.closedAt(at(1, 0)));
  });

  test('lays paths under the path, door and hero symbols, water under waves and grass elsewhere', () => {
    expect(level.scenery.size).toEqual({ columns: 6, rows: 4 });
    expect(level.scenery.groundAt(at(0, 2))).toBe(Ground.Path);
    expect(level.scenery.groundAt(at(2, 0))).toBe(Ground.Path);
    expect(level.scenery.groundAt(at(1, 2))).toBe(Ground.Path);
    expect(level.scenery.groundAt(at(4, 2))).toBe(Ground.Water);
    for (const position of [at(0, 1), at(1, 1), at(5, 1), at(2, 2), at(3, 2), at(5, 2), at(0, 3), at(5, 3)])
      expect(level.scenery.groundAt(position)).toBe(Ground.Grass);
  });

  test('places stones, trees, flowers and fences', () => {
    expect(level.stones).toEqual([Stone.at(at(3, 2))]);
    expect(level.scenery.trees).toEqual([Tree.at(at(0, 1), TreeVariant.NoFruit)]);
    expect(level.scenery.flowers).toEqual([Flower.at(at(2, 2))]);
    expect(level.scenery.fences).toEqual([Fence.at(at(5, 1))]);
  });

  test('grows woodland on grass under each woodland symbol', () => {
    const wooded = levelFromLayout(
      LevelId.of('wooded'),
      ['WDDDW', 'W.H.W', 'WQ..W'],
      keepOrder,
      check2dObstacles,
      lowestRoll,
    );
    expect(wooded.scenery.woodland.tiles).toEqual([at(0, 0), at(4, 0), at(0, 1), at(4, 1), at(0, 2), at(4, 2)]);
    expect(wooded.scenery.groundAt(at(0, 1))).toBe(Ground.Grass);
    expect(wooded.scenery.isWalkable(at(0, 1))).toBe(false);
  });

  test('defaults to all flower variants when contents omit the selection', () => {
    expect(level.scenery.flowerVariants).toEqual(FlowerVariant.All);
  });

  test('passes a non-prefix flower selection from contents to scenery in the supplied order', () => {
    const flowerVariants = [FlowerVariant.Violet, FlowerVariant.Coral];
    const selected = levelFromLayout(LevelId.of('layout'), layout, keepOrder, check2dObstacles, lowestRoll, {
      flowerVariants,
    });
    expect(selected.scenery.flowerVariants).toEqual(flowerVariants);
  });

  test.each([
    ['T', TreeVariant.NoFruit],
    ['N', TreeVariant.Oranges],
    ['A', TreeVariant.Apples],
    ['L', TreeVariant.Lemons],
  ])('plants a tree of the variant its base symbol %s picks', (symbol, variant) => {
    const planted = levelFromLayout(
      LevelId.of('layout'),
      [layout[0]!, `${symbol}t...F`, ...layout.slice(2)],
      keepOrder,
      check2dObstacles,
      lowestRoll,
    );
    expect(planted.scenery.trees).toEqual([Tree.at(at(0, 1), variant)]);
  });

  test('places a permanent orb on each orb symbol, with grass under it', () => {
    expect([level.orbs.map((orb) => orb.position), level.permanentOrbs]).toEqual([[at(5, 3)], [at(5, 3)]]);
    expect(level.scenery.groundAt(at(5, 3))).toBe(Ground.Grass);
  });

  test.each([
    ['no hero', ['.DDD..', 'Tt...F', '#.*o~.', '.....Q'], 'The layout of level layout needs exactly one "H"'],
    ['two heroes', ['.DDD..', 'Tt...F', '#H*o~.', '.H...Q'], 'The layout of level layout needs exactly one "H"'],
    ['no door', ['......', 'Tt...F', '#H*o~.', '.....Q'], 'The layout of level layout needs exactly one door'],
    ['a split door', ['.DD.D.', 'Tt...F', '#H*o~.', '.....Q'], 'The layout of level layout needs exactly one door'],
    ['two doors', ['DDDDDD', '......', '#H*o~.', '.....Q'], 'The layout of level layout needs exactly one door'],
  ])('rejects a layout with %s', (_, given, message) => {
    expect(() => levelFromLayout(LevelId.of('layout'), given, keepOrder, check2dObstacles, lowestRoll)).toThrow(
      message,
    );
  });

  test('fills the rest of the orbs at random around the permanent ones', () => {
    const rows = [
      'DDD' + '.'.repeat(22),
      ...Array.from({ length: 12 }, () => '.'.repeat(25)),
      'Q.........H..............',
    ];
    const placed = (seed: number) =>
      levelFromLayout(LevelId.of('field'), rows, keepOrder, check2dObstacles, seededRandom(seed));
    const plays = [1, 2, 3].map((seed) => placed(seed).orbs.map((orb) => orb.position));
    expect(plays.every((orbs) => orbs[0]!.equals(at(0, 13)) && orbs.length > 1)).toBe(true);
    expect(plays[0]).not.toEqual(plays[1]);
  });
});

describe('a gate in a layout', () => {
  const gated = (rows: readonly string[]) =>
    levelFromLayout(LevelId.of('gated'), rows, keepOrder, check2dObstacles, lowestRoll);

  test('hangs a closed gate on path ground between two fences', () => {
    const level = gated(['.DDD.', '.Q...', 'WFGFW', '..H..']);
    expect(level.gates).toEqual([SwingGate.closedAt(at(2, 2))]);
    expect(level.scenery.groundAt(at(2, 2))).toBe(Ground.Path);
  });

  test('leaves a layout without a gate symbol ungated', () => {
    expect(gated(['.DDD.', '.Q...', '.....', '..H..']).gates).toEqual([]);
  });

  test('places a boulder on grass under each boulder symbol', () => {
    const level = gated(['.DDD.', '.Q...', '..O..', '..H..']);
    expect(level.boulders).toEqual([Boulder.at(at(2, 2))]);
    expect(level.scenery.groundAt(at(2, 2))).toBe(Ground.Grass);
  });

  test('hangs a gate between fences above and below it as one approached from the west', () => {
    const level = gated(['.DDD..', '...F..', '.P.G.Q', '...F..', '..H...']);
    expect(level.gates).toEqual([SwingGate.closedAt(at(3, 2), Direction.Left)]);
    expect(level.plate).toEqual(at(1, 2));
  });

  test('hangs two gates that she opens one at a time, in through one and out through the other', () => {
    const level = gated([
      '.DDD....',
      '........',
      'FFFFGFF.',
      'F.....F.',
      'F....QF.',
      'FFGFFFF.',
      '........',
      '..H.....',
    ]);
    const [exit, entry] = level.gates;
    expect(level.gates).toEqual([SwingGate.closedAt(at(4, 2)), SwingGate.closedAt(at(2, 5))]);
    expect(pathTo(level, (tile) => tile.equals(at(5, 4)))).toBeUndefined();
    openGate(level, entry);
    expect(level.gates.map((gate) => gate.state)).toEqual(['closed', 'open']);
    follow(
      level,
      pathTo(level, (tile) => tile.equals(at(5, 4)))!,
    );
    expect(level.orbs.some((orb) => orb.position.equals(at(5, 4)))).toBe(false);
    openGate(level, exit);
    expect(pathTo(level, (tile) => tile.equals(at(4, 1)))).toBeDefined();
  });

  test('starts the one boulder on the spot the shuffle picks among its symbols', () => {
    const rows = ['.DDD.', '.Q...', '.O.O.', '..H..'];
    const reversed = (positions: readonly TilePosition[]) => [...positions].reverse();
    const level = levelFromLayout(LevelId.of('spots'), rows, reversed, check2dObstacles, lowestRoll);
    expect(level.boulders).toEqual([Boulder.at(at(3, 2))]);
  });

  test('rejects boulder spots where any one of them would break the level', () => {
    expect(() => gated(['.DDD.', '.Q...', 'WFGFW', '.OO..', '...H.'])).toThrow('boulder');
  });

  test.each([
    ['three gates', ['.DDD.....', '.Q.......', 'FGFFGFFGF', '.........', '..H......'], 'at most two gates'],
    ['a gate without a fence on one side', ['.DDD.', '.Q...', 'W.GFW', '..H..'], 'between two fences'],
  ])('rejects %s', (_, rows, message) => {
    expect(() => gated(rows)).toThrow(message);
  });
});

test('all flower variants follow the ten sprite indices', () => {
  expect(FlowerVariant.All).toEqual([
    FlowerVariant.WhiteCoral,
    FlowerVariant.BlueViolet,
    FlowerVariant.WhiteViolet,
    FlowerVariant.CoralBlue,
    FlowerVariant.CoralViolet,
    FlowerVariant.WhiteBlue,
    FlowerVariant.White,
    FlowerVariant.Coral,
    FlowerVariant.Blue,
    FlowerVariant.Violet,
  ]);
  expect(new Set(FlowerVariant.All).size).toBe(10);
});

describe('scenery flower selections', () => {
  const size = LevelSize.of(6, 4);
  const ground = Array.from({ length: 4 }, () => Array.from({ length: 6 }, () => Ground.Grass));

  test('defaults to all variants without requiring optional fences or flower variants', () => {
    const scenery = Scenery.of(size, ground, [], []);
    expect(scenery.flowerVariants).toEqual(FlowerVariant.All);
    expect(scenery.fences).toEqual([]);
  });

  test('copies the sixth argument and preserves its order without changing fences', () => {
    const flowerVariants = [FlowerVariant.Violet, FlowerVariant.Coral];
    const fences = [Fence.at(at(5, 0))];
    const scenery = Scenery.of(size, ground, [], [], fences, flowerVariants);
    flowerVariants.reverse();
    flowerVariants.push(FlowerVariant.White);
    expect(scenery.flowerVariants).toEqual([FlowerVariant.Violet, FlowerVariant.Coral]);
    expect(scenery.fences).toEqual(fences);
  });

  test.each([
    ['empty', []],
    ['duplicate', [FlowerVariant.Coral, FlowerVariant.Coral]],
  ] as const)('rejects an %s flower selection', (_, flowerVariants) => {
    expect(() => Scenery.of(size, ground, [], [], [], flowerVariants)).toThrow(RangeError);
  });
});
