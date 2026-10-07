import { describe, expect, test } from 'vitest';
import { OrbColor } from '../domain/level/collectibles';
import { StarCount } from '../domain/shared/star-count';
import { Door } from '../domain/level/door';
import { Stone } from '../domain/level/level';
import { LevelId } from '../domain/shared/level-id';
import { Direction, TilePosition } from '../domain/level/position';
import { Fence, Flower, FlowerVariant, Ground, LevelSize, Scenery, Tree, TreeVariant } from '../domain/level/scenery';
import { Signpost, SignpostText } from '../domain/level/signpost';
import { levelFromLayout } from './level-layout';

const at = TilePosition.at;
const keepOrder = (positions: readonly TilePosition[]): readonly TilePosition[] => positions;
const layout = ['.DDD..', 'Tt...F', '#H*o~P', 'O....R'];
const contents = {
  orbs: {
    O: { color: OrbColor.Teal, restores: (position: TilePosition) => position.column < 3 },
    R: { color: OrbColor.Red, restores: (position: TilePosition) => position.column >= 3 },
  },
  signposts: { P: 'ΔΙΑΒΑΣΕ ΜΕ' },
  starCount: StarCount.of(2),
};

describe('a level built from a layout', () => {
  const level = levelFromLayout(LevelId.of('layout'), layout, keepOrder, contents);

  test('places the hero facing up and a closed door', () => {
    expect(level.id.value).toBe('layout');
    expect(level.hero.position).toEqual(at(1, 2));
    expect(level.hero.facing).toBe(Direction.Up);
    expect(level.door.equals(Door.closedAt(at(1, 0)))).toBe(true);
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

  test('defaults to all flower variants when contents omit the selection', () => {
    expect(level.scenery.flowerVariants).toEqual(FlowerVariant.All);
  });

  test('passes a non-prefix flower selection from contents to scenery in the supplied order', () => {
    const flowerVariants = [FlowerVariant.Violet, FlowerVariant.Coral];
    const selected = levelFromLayout(LevelId.of('layout'), layout, keepOrder, { ...contents, flowerVariants });
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
      contents,
    );
    expect(planted.scenery.trees).toEqual([Tree.at(at(0, 1), variant)]);
  });

  test('gives each orb its color and the area its rule selects', () => {
    expect(level.orbs.map((orb) => [orb.position, orb.color])).toEqual([
      [at(0, 3), OrbColor.Teal],
      [at(5, 3), OrbColor.Red],
    ]);
    const [teal, red] = level.orbs;
    expect(teal!.restores.tiles).toHaveLength(12);
    expect(teal!.restores.tiles.every((tile) => tile.column < 3)).toBe(true);
    expect(red!.restores.tiles).toHaveLength(12);
    expect(red!.restores.tiles.every((tile) => tile.column >= 3)).toBe(true);
  });

  test('places signposts with their text', () => {
    expect(level.signposts).toEqual([Signpost.at(at(5, 2), SignpostText.of('ΔΙΑΒΑΣΕ ΜΕ'))]);
  });

  test('scatters the star count through the shuffle', () => {
    expect(level.stars.map((star) => star.position)).toEqual([at(1, 3), at(0, 2)]);
  });

  test.each([
    ['no hero', ['.DDD..', 'Tt...F', '#.*o~P', 'O....R'], 'The layout of level layout needs exactly one "H"'],
    ['two heroes', ['.DDD..', 'Tt...F', '#H*o~P', 'OH...R'], 'The layout of level layout needs exactly one "H"'],
    ['no door', ['......', 'Tt...F', '#H*o~P', 'O....R'], 'The layout of level layout needs exactly one door'],
    ['a split door', ['.DD.D.', 'Tt...F', '#H*o~P', 'O....R'], 'The layout of level layout needs exactly one door'],
    ['two doors', ['DDDDDD', '......', '#H*o~P', 'O....R'], 'The layout of level layout needs exactly one door'],
    [
      'stars placed by hand and a star count',
      ['.DDD..', 'Tt...F', '#H*o~P', 'O.+..R'],
      'The layout of level layout places its stars by hand, so it takes no star count',
    ],
    ['a missing orb', ['.DDD..', 'Tt...F', '#H*o~P', '.....R'], 'The layout of level layout needs exactly one "O"'],
    [
      'a missing signpost',
      ['.DDD..', 'Tt...F', '#H*o~.', 'O....R'],
      'The layout of level layout needs exactly one "P"',
    ],
  ])('rejects a layout with %s', (_, given, message) => {
    expect(() => levelFromLayout(LevelId.of('layout'), given, keepOrder, contents)).toThrow(message);
  });

  test('places stars on grass and on paths where the layout marks them', () => {
    const { starCount: _, ...unscattered } = contents;
    const placed = levelFromLayout(
      LevelId.of('layout'),
      ['.DDD..', 'Tt...F', '#H*o~P', 'O.+.=R'],
      keepOrder,
      unscattered,
    );
    expect(placed.stars.map((star) => star.position)).toEqual([at(2, 3), at(4, 3)]);
    expect(placed.scenery.groundAt(at(2, 3))).toBe(Ground.Grass);
    expect(placed.scenery.groundAt(at(4, 3))).toBe(Ground.Path);
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
