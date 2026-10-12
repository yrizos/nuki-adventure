import { describe, expect, test } from 'vitest';
import { StarCount } from '../domain/shared/star-count';
import { KeyMaterial } from '../domain/level/collectibles';
import { Door } from '../domain/level/door';
import { Stone } from '../domain/level/level';
import { LevelId } from '../domain/shared/level-id';
import { Direction, TilePosition } from '../domain/level/position';
import { Fence, Flower, FlowerVariant, Ground, LevelSize, Scenery, Tree, TreeVariant } from '../domain/level/scenery';
import { levelFromLayout } from './level-layout';
import { SwingGate } from '../domain/level/swing-gate';
import { Boulder } from '../domain/level/boulder';

const at = TilePosition.at;
const keepOrder = (positions: readonly TilePosition[]): readonly TilePosition[] => positions;
const layout = ['.DDD..', 'Tt...F', '#H*o~.', 'Y....R'];
const contents = {
  keys: {
    Y: { restores: (position: TilePosition) => position.column < 3 },
    R: { restores: (position: TilePosition) => position.column >= 3 },
  },
  starCount: StarCount.of(2),
};

describe('a level built from a layout', () => {
  const level = levelFromLayout(LevelId.of('layout'), layout, keepOrder, contents);

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
    const wooded = levelFromLayout(LevelId.of('wooded'), ['WDDDW', 'W.H.W', 'WK..W'], keepOrder, {
      keys: { K: { restores: () => true } },
    });
    expect(wooded.scenery.woodland.tiles).toEqual([at(0, 0), at(4, 0), at(0, 1), at(4, 1), at(0, 2), at(4, 2)]);
    expect(wooded.scenery.groundAt(at(0, 1))).toBe(Ground.Grass);
    expect(wooded.scenery.isWalkable(at(0, 1))).toBe(false);
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

  test('gives each key the area its rule selects', () => {
    expect(level.keys.map((key) => key.position)).toEqual([at(0, 3), at(5, 3)]);
    const [teal, red] = level.keys;
    expect(teal!.restores.tiles).toHaveLength(12);
    expect(teal!.restores.tiles.every((tile) => tile.column < 3)).toBe(true);
    expect(red!.restores.tiles).toHaveLength(12);
    expect(red!.restores.tiles.every((tile) => tile.column >= 3)).toBe(true);
  });

  test('scatters the star count through the shuffle', () => {
    expect(level.stars.map((star) => star.position)).toEqual([at(1, 3), at(0, 2)]);
  });

  test.each([
    ['no hero', ['.DDD..', 'Tt...F', '#.*o~.', 'Y....R'], 'The layout of level layout needs exactly one "H"'],
    ['two heroes', ['.DDD..', 'Tt...F', '#H*o~.', 'YH...R'], 'The layout of level layout needs exactly one "H"'],
    ['no door', ['......', 'Tt...F', '#H*o~.', 'Y....R'], 'The layout of level layout needs exactly one door'],
    ['a split door', ['.DD.D.', 'Tt...F', '#H*o~.', 'Y....R'], 'The layout of level layout needs exactly one door'],
    ['two doors', ['DDDDDD', '......', '#H*o~.', 'Y....R'], 'The layout of level layout needs exactly one door'],
    [
      'star spots and a star count',
      ['.DDD..', 'Tt...F', '#H*o~.', 'Y.+..R'],
      'The layout of level layout marks star spots, so it takes no star count',
    ],
    ['a missing key', ['.DDD..', 'Tt...F', '#H*o~.', '.....R'], 'The layout of level layout needs exactly one "Y"'],
  ])('rejects a layout with %s', (_, given, message) => {
    expect(() => levelFromLayout(LevelId.of('layout'), given, keepOrder, contents)).toThrow(message);
  });

  test('offers the star spots it marks on grass and on paths and lets the shuffle choose five', () => {
    const { starCount: _, ...unscattered } = contents;
    const marked = [...layout, '++++++', '+++===', '===...'];
    const reverseOrder = (positions: readonly TilePosition[]): readonly TilePosition[] => [...positions].reverse();
    const placed = levelFromLayout(LevelId.of('layout'), marked, reverseOrder, unscattered);
    expect(placed.stars.map((star) => star.position)).toEqual([at(2, 6), at(1, 6), at(0, 6), at(5, 5), at(4, 5)]);
    expect(placed.scenery.groundAt(at(0, 4))).toBe(Ground.Grass);
    expect(placed.scenery.groundAt(at(5, 5))).toBe(Ground.Path);
  });
});

describe('key materials in a layout', () => {
  test('gives each key the material its contents name, gold by default', () => {
    const level = levelFromLayout(LevelId.of('metals'), ['.DDD.', '.K.S.', '.....', '..H..'], keepOrder, {
      keys: {
        K: { restores: (position: TilePosition) => position.column < 2 },
        S: { restores: (position: TilePosition) => position.column >= 2, material: KeyMaterial.Silver },
      },
    });
    expect(level.keys.map((key) => key.material)).toEqual([KeyMaterial.Gold, KeyMaterial.Silver]);
  });
});

describe('a gate in a layout', () => {
  const gated = (rows: readonly string[]) =>
    levelFromLayout(LevelId.of('gated'), rows, keepOrder, { keys: { K: { restores: () => true } } });

  test('hangs a closed gate on path ground between two fences', () => {
    const level = gated(['.DDD.', '.K...', 'WFGFW', '..H..']);
    expect(level.gate).toEqual(SwingGate.closedAt(at(2, 2)));
    expect(level.scenery.groundAt(at(2, 2))).toBe(Ground.Path);
  });

  test('leaves a layout without a gate symbol ungated', () => {
    expect(gated(['.DDD.', '.K...', '.....', '..H..']).gate).toBeUndefined();
  });

  test('places a boulder on grass under each boulder symbol', () => {
    const level = gated(['.DDD.', '.K...', '..O..', '..H..']);
    expect(level.boulders).toEqual([Boulder.at(at(2, 2))]);
    expect(level.scenery.groundAt(at(2, 2))).toBe(Ground.Grass);
  });

  test('hangs a gate between fences above and below it as one approached from the west', () => {
    const level = gated(['.DDD..', '...F..', '.P.G.K', '...F..', '..H...']);
    expect(level.gate).toEqual(SwingGate.closedAt(at(3, 2), Direction.Left));
    expect(level.plate).toEqual(at(1, 2));
  });

  test('starts the one boulder on the spot the shuffle picks among its symbols', () => {
    const rows = ['.DDD.', '.K...', '.O.O.', '..H..'];
    const reversed = (positions: readonly TilePosition[]) => [...positions].reverse();
    const level = levelFromLayout(LevelId.of('spots'), rows, reversed, { keys: { K: { restores: () => true } } });
    expect(level.boulders).toEqual([Boulder.at(at(3, 2))]);
  });

  test('rejects boulder spots where any one of them would break the level', () => {
    expect(() => gated(['.DDD.', '.K...', 'WFGFW', '.OO..', '...H.'])).toThrow('boulder');
  });

  test.each([
    ['two gates', ['.DDD.', '.K...', 'FGFGF', '..H..'], 'at most one gate'],
    ['a gate without a fence on one side', ['.DDD.', '.K...', 'W.GFW', '..H..'], 'between two fences'],
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
