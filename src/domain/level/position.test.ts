import { describe, expect, test } from 'vitest';
import { Direction, Heading, TilePosition, TilePositions, WorldPosition } from './position';

const at = TilePosition.at;
const all = [
  Direction.Up,
  Direction.Down,
  Direction.Left,
  Direction.Right,
  Direction.UpLeft,
  Direction.UpRight,
  Direction.DownLeft,
  Direction.DownRight,
];

describe('a direction', () => {
  test.each([
    [null, null, null],
    [Direction.Left, null, Direction.Left],
    [Direction.Right, null, Direction.Right],
    [null, Direction.Up, Direction.Up],
    [null, Direction.Down, Direction.Down],
    [Direction.Left, Direction.Up, Direction.UpLeft],
    [Direction.Right, Direction.Up, Direction.UpRight],
    [Direction.Left, Direction.Down, Direction.DownLeft],
    [Direction.Right, Direction.Down, Direction.DownRight],
  ])('combines %s and %s into %s', (horizontal, vertical, combined) => {
    expect(Direction.combine(horizontal, vertical)).toBe(combined);
  });

  test.each(all)('%s splits into parts that combine back into it', (direction) => {
    expect(Direction.combine(direction.horizontal, direction.vertical)).toBe(direction);
  });

  test.each([
    [Direction.Up, Direction.Up, false],
    [Direction.Down, Direction.Down, false],
    [Direction.Left, Direction.Left, false],
    [Direction.Right, Direction.Right, false],
    [Direction.UpLeft, Direction.Up, true],
    [Direction.UpRight, Direction.Up, true],
    [Direction.DownLeft, Direction.Down, true],
    [Direction.DownRight, Direction.Down, true],
  ])('%s faces %s and is diagonal: %s', (direction, facing, diagonal) => {
    expect(direction.facing).toBe(facing);
    expect(direction.isDiagonal).toBe(diagonal);
  });
});

describe('a tile position', () => {
  test.each([
    [1.5, 0],
    [0, -0.5],
    [Number.NaN, 0],
    [0, Number.POSITIVE_INFINITY],
  ])('rejects %s, %s', (column, row) => {
    expect(() => TilePosition.at(column, row)).toThrow(RangeError);
  });

  test('is equal only with the same column and row', () => {
    expect(at(2, 3).equals(at(2, 3))).toBe(true);
    expect(at(2, 3).equals(at(3, 2))).toBe(false);
  });

  test.each([
    [Direction.Up, at(5, 4)],
    [Direction.Down, at(5, 6)],
    [Direction.Left, at(4, 5)],
    [Direction.Right, at(6, 5)],
    [Direction.UpLeft, at(4, 4)],
    [Direction.UpRight, at(6, 4)],
    [Direction.DownLeft, at(4, 6)],
    [Direction.DownRight, at(6, 6)],
  ])('has its %s neighbor at %j', (direction, neighbor) => {
    expect(at(5, 5).neighbor(direction)).toEqual(neighbor);
  });
});

describe('a set of tile positions', () => {
  test('covers exactly the held tiles, matched by column and row', () => {
    const tiles = TilePositions.of([at(1, 2), at(3, 4)]);
    expect(tiles.covers(at(1, 2))).toBe(true);
    expect(tiles.covers(at(3, 4))).toBe(true);
    expect(tiles.covers(at(2, 1))).toBe(false);
    expect(tiles.covers(at(1, 4))).toBe(false);
  });

  test('adds tiles after the held ones and leaves the original unchanged', () => {
    const original = TilePositions.of([at(1, 1)]);
    const extended = original.with([at(2, 2), at(3, 3)]);
    expect(extended.tiles).toEqual([at(1, 1), at(2, 2), at(3, 3)]);
    expect(extended.covers(at(3, 3))).toBe(true);
    expect(original.tiles).toEqual([at(1, 1)]);
    expect(original.covers(at(2, 2))).toBe(false);
  });

  test('keeps only the first occurrence of a repeated tile', () => {
    expect(TilePositions.of([at(1, 1), at(2, 2), at(1, 1)]).tiles).toEqual([at(1, 1), at(2, 2)]);
  });

  test('skips added tiles it already holds', () => {
    expect(TilePositions.of([at(1, 1)]).with([at(1, 1), at(2, 2)]).tiles).toEqual([at(1, 1), at(2, 2)]);
  });

  test('is equal only when both hold the same tiles, in any order', () => {
    const tiles = TilePositions.of([at(1, 1), at(2, 2)]);
    expect(tiles.equals(TilePositions.of([at(2, 2), at(1, 1)]))).toBe(true);
    expect(tiles.equals(TilePositions.of([at(1, 1)]))).toBe(false);
    expect(tiles.equals(TilePositions.of([at(1, 1), at(2, 2), at(3, 3)]))).toBe(false);
  });
});

describe('a world position', () => {
  test.each([
    [Number.NaN, 0],
    [0, Number.NaN],
    [Number.POSITIVE_INFINITY, 0],
    [0, Number.NEGATIVE_INFINITY],
  ])('rejects %s, %s', (x, y) => {
    expect(() => WorldPosition.at(x, y)).toThrow(RangeError);
  });

  test('is equal only with the same coordinates', () => {
    expect(WorldPosition.at(1.5, 2).equals(WorldPosition.at(1.5, 2))).toBe(true);
    expect(WorldPosition.at(1.5, 2).equals(WorldPosition.at(2, 1.5))).toBe(false);
  });

  test('is measured from the top left corner of a tile', () => {
    expect(WorldPosition.within(at(2, 3), 5, 6)).toEqual(WorldPosition.at(69, 102));
  });

  test.each([
    [0, 0, at(0, 0)],
    [31.9, 31.9, at(0, 0)],
    [32, 32, at(1, 1)],
    [-0.1, -0.1, at(-1, -1)],
  ])('at %s, %s lies on tile %j', (x, y, tile) => {
    expect(WorldPosition.at(x, y).tile).toEqual(tile);
  });

  test('moves the given distance along a heading', () => {
    expect(WorldPosition.at(10, 10).moved(Heading.toward(3, 4), 10)).toEqual(WorldPosition.at(16, 18));
  });
});

describe('a heading', () => {
  test.each([
    [0, 0],
    [Number.NaN, 1],
    [Number.POSITIVE_INFINITY, 0],
  ])('rejects %s, %s', (x, y) => {
    expect(() => Heading.toward(x, y)).toThrow(RangeError);
  });

  test('keeps only the direction it is given, not its length', () => {
    const heading = Heading.toward(6, 8);
    expect(heading.equals(Heading.toward(3, 4))).toBe(true);
    expect(heading.x).toBeCloseTo(0.6);
    expect(heading.y).toBeCloseTo(0.8);
  });

  test.each([
    [Direction.Right, 1],
    [Direction.Left, -1],
    [Direction.Up, 0],
    [Direction.Down, 0],
  ])('heading right aligns with %s by %s', (direction, alignment) => {
    expect(Heading.of(Direction.Right).alignment(direction)).toBe(alignment);
  });
});
