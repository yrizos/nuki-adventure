import { describe, expect, test } from 'vitest';
import { Outline } from './obstacles';
import { Direction, TilePosition } from './position';
import { Fence, Flower, FlowerVariant, Ground, LevelSize, Scenery, Tree, TreeVariant } from './scenery';

const at = TilePosition.at;
const tree = (base: TilePosition): Tree => Tree.at(base, TreeVariant.NoFruit);
const ground = (layout: readonly string[]): Ground[][] =>
  layout.map((line) =>
    [...line].map((symbol) => (symbol === '~' ? Ground.Water : symbol === '=' ? Ground.Path : Ground.Grass)),
  );
const scenery = (
  layout: readonly string[],
  trees: readonly Tree[] = [],
  flowers: readonly Flower[] = [],
  fences: readonly Fence[] = [],
  variants?: readonly FlowerVariant[],
): Scenery =>
  Scenery.of(LevelSize.of(layout[0]!.length, layout.length), ground(layout), trees, flowers, fences, variants);

describe('a level size', () => {
  test.each([
    [0, 1],
    [1, 0],
    [1.5, 1],
    [1, Number.NaN],
  ])('rejects %s × %s', (columns, rows) => {
    expect(() => LevelSize.of(columns, rows)).toThrow(RangeError);
  });

  test.each([
    [at(0, 0), true],
    [at(2, 1), true],
    [at(3, 1), false],
    [at(2, 2), false],
    [at(-1, 0), false],
    [at(0, -1), false],
  ])('of 3 × 2 contains %j: %s', (position, contained) => {
    expect(LevelSize.of(3, 2).contains(position)).toBe(contained);
  });

  test('is equal only with the same columns and rows', () => {
    expect(LevelSize.of(3, 2).equals(LevelSize.of(3, 2))).toBe(true);
    expect(LevelSize.of(3, 2).equals(LevelSize.of(2, 3))).toBe(false);
  });
});

describe('scenery', () => {
  test.each([
    ['ground missing a row', () => Scenery.of(LevelSize.of(2, 2), ground(['..']), [], [])],
    ['ground missing a tile', () => Scenery.of(LevelSize.of(2, 2), ground(['..', '.']), [], [])],
    ['a tree reaching outside the level', () => scenery(['..'], [tree(at(1, 0))])],
    ['a tree on a path', () => scenery(['.='], [tree(at(0, 0))])],
    ['overlapping trees', () => scenery(['...'], [tree(at(0, 0)), tree(at(1, 0))])],
    ['a flower in water', () => scenery(['.~'], [], [Flower.at(at(1, 0))])],
    ['a flower outside the level', () => scenery(['..'], [], [Flower.at(at(2, 0))])],
    ['a fence in water', () => scenery(['.~'], [], [], [Fence.at(at(1, 0))])],
    ['a fence outside the level', () => scenery(['..'], [], [], [Fence.at(at(0, 1))])],
    ['a fence on a tree', () => scenery(['..'], [tree(at(0, 0))], [], [Fence.at(at(1, 0))])],
    ['two fences on one tile', () => scenery(['..'], [], [], [Fence.at(at(0, 0)), Fence.at(at(0, 0))])],
    ['no flower variants', () => scenery(['..'], [], [], [], [])],
    ['a repeated flower variant', () => scenery(['..'], [], [], [], [FlowerVariant.Blue, FlowerVariant.Blue])],
  ])('rejects %s', (_, create) => {
    expect(create).toThrow(RangeError);
  });

  test('is unaffected by later changes to the lists it was given', () => {
    const trees = [tree(at(0, 0))];
    const subject = scenery(['....'], trees);
    trees.push(tree(at(2, 0)));
    expect(subject.trees).toEqual([tree(at(0, 0))]);
  });

  test('has no ground outside the level', () => {
    expect(() => scenery(['..']).groundAt(at(2, 0))).toThrow(RangeError);
  });

  test.each([
    [at(0, 0), true],
    [at(1, 0), false],
    [at(2, 0), true],
    [at(0, 1), false],
    [at(1, 1), false],
    [at(2, 1), false],
    [at(3, 0), false],
  ])('is walkable at %j: %s', (position, walkable) => {
    const subject = scenery(['.~=', '...'], [tree(at(0, 1))], [], [Fence.at(at(2, 1))]);
    expect(subject.isWalkable(position)).toBe(walkable);
  });

  test('joins neighboring fences with rails reaching toward each other only', () => {
    const outlines = scenery(['...'], [], [], [Fence.at(at(0, 0)), Fence.at(at(1, 0))]).obstacles(() => false);
    expect(outlines).toContainEqual(Outline.spanning(at(0, 0), 12, 17, 32, 32));
    expect(outlines).toContainEqual(Outline.spanning(at(1, 0), 0, 17, 20, 32));
    expect(outlines).not.toContainEqual(Outline.spanning(at(1, 0), 12, 17, 32, 32));
  });

  test('joins a fence to a neighbor it is told to join', () => {
    const outlines = scenery(['..']).obstacles(() => false);
    const joined = scenery(['..'], [], [], [Fence.at(at(0, 0))]).obstacles((position) => position.equals(at(1, 0)));
    expect(outlines).not.toContainEqual(Outline.spanning(at(0, 0), 12, 17, 32, 32));
    expect(joined).toContainEqual(Outline.spanning(at(0, 0), 12, 17, 32, 32));
  });
});

describe('a tree', () => {
  test('hides exactly the row above its footprint', () => {
    const subject = tree(at(2, 2));
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 6; column++) {
        expect(subject.hides(at(column, row))).toBe(row === 1 && (column === 2 || column === 3));
      }
    }
  });
});

describe('a fence', () => {
  test('is a lone post when it joins nothing', () => {
    expect(Fence.at(at(1, 1)).obstacles(() => false)).toEqual([Outline.spanning(at(1, 1), 12, 17, 20, 32)]);
  });

  test.each([
    [Direction.Left, [0, 17, 20, 32]],
    [Direction.Right, [12, 17, 32, 32]],
    [Direction.Up, [12, 0, 20, 32]],
    [Direction.Down, [12, 17, 20, 32]],
  ])('reaches the tile edge toward a joined %s neighbor', (direction, [left, top, right, bottom]) => {
    expect(Fence.at(at(1, 1)).obstacles((joined) => joined === direction)).toContainEqual(
      Outline.spanning(at(1, 1), left!, top!, right!, bottom!),
    );
  });

  test('is equal only on the same tile', () => {
    expect(Fence.at(at(1, 1)).equals(Fence.at(at(1, 1)))).toBe(true);
    expect(Fence.at(at(1, 1)).equals(Fence.at(at(1, 2)))).toBe(false);
  });
});

describe('a flower', () => {
  test('is equal only on the same tile', () => {
    expect(Flower.at(at(1, 1)).equals(Flower.at(at(1, 1)))).toBe(true);
    expect(Flower.at(at(1, 1)).equals(Flower.at(at(1, 2)))).toBe(false);
  });
});
