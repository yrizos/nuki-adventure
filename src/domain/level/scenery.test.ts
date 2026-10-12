import { isDeepStrictEqual } from 'node:util';
import { describe, expect, test } from 'vitest';
import { Door } from './door';
import { Outline } from './obstacles';
import { SwingGate } from './swing-gate';
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
  woodland: readonly TilePosition[] = [],
): Scenery =>
  Scenery.of(
    LevelSize.of(layout[0]!.length, layout.length),
    ground(layout),
    trees,
    flowers,
    fences,
    variants,
    woodland,
  );

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
    ['woodland outside the level', () => scenery(['..'], [], [], [], undefined, [at(2, 0)])],
    ['woodland in water', () => scenery(['.~'], [], [], [], undefined, [at(1, 0)])],
    ['woodland on a path', () => scenery(['.='], [], [], [], undefined, [at(1, 0)])],
    ['woodland on a tree', () => scenery(['..'], [tree(at(0, 0))], [], [], undefined, [at(1, 0)])],
    ['woodland on a flower', () => scenery(['..'], [], [Flower.at(at(1, 0))], [], undefined, [at(1, 0)])],
    ['woodland on a fence', () => scenery(['..'], [], [], [Fence.at(at(1, 0))], undefined, [at(1, 0)])],
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

  test('blocks every woodland tile and covers it with a whole-tile obstacle', () => {
    const subject = scenery(['...', '...'], [], [], [], undefined, [at(1, 0), at(1, 1)]);
    expect(subject.woodland.tiles).toEqual([at(1, 0), at(1, 1)]);
    expect(subject.isWalkable(at(1, 0))).toBe(false);
    expect(subject.isWalkable(at(1, 1))).toBe(false);
    expect(subject.isWalkable(at(0, 0))).toBe(true);
    expect(subject.obstacles(Door.closedAt(at(0, 0)))).toContainEqual(Outline.spanning(at(1, 1), 0, 0, 32, 32));
  });

  test('hides exactly the tile above each woodland tile', () => {
    const subject = scenery(['...', '...', '...'], [], [], [], undefined, [at(1, 2)]);
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 3; column++) {
        expect(subject.hides(at(column, row))).toBe(column === 1 && row === 1);
      }
    }
  });

  test('joins neighboring fences with rails reaching toward each other only', () => {
    const outlines = scenery(['...', '...'], [], [], [Fence.at(at(0, 1)), Fence.at(at(1, 1))]).obstacles(
      Door.closedAt(at(0, 0)),
    );
    expect(outlines).toContainEqual(Outline.spanning(at(0, 1), 12, 17, 32, 32));
    expect(outlines).toContainEqual(Outline.spanning(at(1, 1), 0, 17, 20, 32));
    expect(outlines).not.toContainEqual(Outline.spanning(at(1, 1), 12, 17, 32, 32));
  });

  test('joins a fence to the door and gate in every state', () => {
    const subject = scenery(['......'], [], [], [Fence.at(at(3, 0))]);
    const door = Door.closedAt(at(0, 0));
    const closed = SwingGate.closedAt(at(4, 0));
    const opening = closed.requestOpen();
    const open = opening.finishOpening();
    const failures: string[] = [];
    const rails = [Outline.spanning(at(3, 0), 0, 17, 20, 32), Outline.spanning(at(3, 0), 12, 17, 32, 32)];
    for (const exit of [door, door.opened()]) {
      for (const gate of [closed, opening, open, open.requestClose()]) {
        const outlines = subject.obstacles(exit, gate);
        if (!rails.every((rail) => outlines.some((outline) => isDeepStrictEqual(outline, rail))))
          failures.push(`door open: ${exit.isOpen}, gate: ${gate.state}`);
      }
    }
    expect(failures).toEqual([]);
  });

  test('connects only to fence, door and gate tiles from every direction', () => {
    const door = Door.closedAt(at(0, 0));
    const gate = SwingGate.closedAt(at(4, 2));
    const subject = scenery(['......', '......', '......', '......'], [], [], [Fence.at(at(2, 2))]);
    const joined = new Set(['0,0', '1,0', '2,0', '2,2', '4,2']);
    const failures: string[] = [];
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 6; column++) {
        for (const direction of [Direction.Up, Direction.Down, Direction.Left, Direction.Right]) {
          const neighbor = at(column, row).neighbor(direction);
          const expected = joined.has(`${neighbor.column},${neighbor.row}`);
          if (subject.joinsFence(neighbor, door, gate) !== expected)
            failures.push(`${column},${row} toward ${direction.name}`);
        }
      }
    }
    expect(failures).toEqual([]);
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
