import { describe, expect, test } from 'vitest';
import { OrbColor } from '../domain/level/collectibles';
import { StarCount } from '../domain/shared/star-count';
import { Door } from '../domain/level/door';
import { Stone } from '../domain/level/level';
import { LevelId } from '../domain/shared/level-id';
import { Direction, TilePosition } from '../domain/level/position';
import { Fence, Flower, Ground, Tree } from '../domain/level/scenery';
import { Signpost, SignpostText } from '../domain/level/signpost';
import { levelFromLayout } from './level-layout';

const at = TilePosition.at;
const keepOrder = (positions: readonly TilePosition[]): readonly TilePosition[] => positions;
const layout = ['Tt...F', '.DDD..', '#H*o~P', 'O....R'];
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
    expect(level.door.equals(Door.closedAt(at(1, 1)))).toBe(true);
  });

  test('lays paths under the path, door and hero symbols, water under waves and grass elsewhere', () => {
    expect(level.scenery.size).toEqual({ columns: 6, rows: 4 });
    expect(level.scenery.groundAt(at(0, 2))).toBe(Ground.Path);
    expect(level.scenery.groundAt(at(2, 1))).toBe(Ground.Path);
    expect(level.scenery.groundAt(at(1, 2))).toBe(Ground.Path);
    expect(level.scenery.groundAt(at(4, 2))).toBe(Ground.Water);
    for (const position of [at(0, 0), at(1, 0), at(5, 0), at(2, 2), at(3, 2), at(5, 2), at(0, 3), at(5, 3)])
      expect(level.scenery.groundAt(position)).toBe(Ground.Grass);
  });

  test('places stones, trees, flowers and fences', () => {
    expect(level.stones).toEqual([Stone.at(at(3, 2))]);
    expect(level.scenery.trees).toEqual([Tree.at(at(0, 0))]);
    expect(level.scenery.flowers).toEqual([Flower.at(at(2, 2))]);
    expect(level.scenery.fences).toEqual([Fence.at(at(5, 0))]);
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
    ['no hero', ['Tt...F', '.DDD..', '#.*o~P', 'O....R'], 'The layout of level layout needs exactly one "H"'],
    ['two heroes', ['Tt...F', '.DDD..', '#H*o~P', 'OH...R'], 'The layout of level layout needs exactly one "H"'],
    ['no door', ['Tt...F', '......', '#H*o~P', 'O....R'], 'The layout of level layout needs exactly one door'],
    ['a split door', ['Tt...F', '.DD.D.', '#H*o~P', 'O....R'], 'The layout of level layout needs exactly one door'],
    ['two doors', ['DDDDDD', '......', '#H*o~P', 'O....R'], 'The layout of level layout needs exactly one door'],
    [
      'stars placed by hand and a star count',
      ['Tt...F', '.DDD..', '#H*o~P', 'O.+..R'],
      'The layout of level layout places its stars by hand, so it takes no star count',
    ],
    ['a missing orb', ['Tt...F', '.DDD..', '#H*o~P', '.....R'], 'The layout of level layout needs exactly one "O"'],
    [
      'a missing signpost',
      ['Tt...F', '.DDD..', '#H*o~.', 'O....R'],
      'The layout of level layout needs exactly one "P"',
    ],
  ])('rejects a layout with %s', (_, given, message) => {
    expect(() => levelFromLayout(LevelId.of('layout'), given, keepOrder, contents)).toThrow(message);
  });

  test('places stars on grass and on paths where the layout marks them', () => {
    const { starCount: _, ...unscattered } = contents;
    const placed = levelFromLayout(
      LevelId.of('layout'),
      ['Tt...F', '.DDD..', '#H*o~P', 'O.+.=R'],
      keepOrder,
      unscattered,
    );
    expect(placed.stars.map((star) => star.position)).toEqual([at(2, 3), at(4, 3)]);
    expect(placed.scenery.groundAt(at(2, 3))).toBe(Ground.Grass);
    expect(placed.scenery.groundAt(at(4, 3))).toBe(Ground.Path);
  });
});
