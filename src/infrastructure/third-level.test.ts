import { expect, test } from 'vitest';
import { KeyMaterial } from '../domain/level/collectibles';
import { Door } from '../domain/level/door';
import type { Level } from '../domain/level/level';
import { KeyCollected, LevelCompleted } from '../domain/level/level-events';
import { Direction, Heading, TilePosition } from '../domain/level/position';
import { SwingGate } from '../domain/level/swing-gate';
import { keepOrder, reverseOrder, starSpotsOf } from '../test-support/star-spots';
import { follow, openGate, pathTo } from '../test-support/walk-level';
import { thirdLevel, thirdLevelId } from './third-level';

const at = TilePosition.at;
const tiles = Array.from({ length: 30 * 30 }, (_, index) => at(index % 30, Math.floor(index / 30)));
const goldKey = at(7, 9);
const silverKey = at(22, 10);
const islandLink = at(21, 12);
const orchardSpots = [at(7, 7), at(5, 11), at(10, 11)];
const otherSpots = [
  at(17, 2),
  at(7, 4),
  at(20, 4),
  at(3, 8),
  at(25, 7),
  at(26, 9),
  at(19, 10),
  at(3, 13),
  at(26, 13),
  at(4, 18),
  at(11, 18),
  at(19, 18),
  at(26, 19),
  at(6, 21),
  at(23, 23),
  at(10, 25),
  at(18, 27),
];
const inOrchard = (tile: TilePosition): boolean =>
  tile.column >= 5 && tile.column <= 10 && tile.row >= 7 && tile.row <= 11;

function reachedFromStart(level: Level, gateOpen: boolean, blocked?: TilePosition): readonly TilePosition[] {
  const open = (tile: TilePosition): boolean =>
    level.scenery.isWalkable(tile) &&
    !level.stones.some((stone) => stone.position.equals(tile)) &&
    !level.door.covers(tile) &&
    (gateOpen || !level.gate!.covers(tile)) &&
    !blocked?.equals(tile);
  const reached = [level.hero.position];
  for (let index = 0; index < reached.length; index++) {
    for (const direction of [Direction.Up, Direction.Down, Direction.Left, Direction.Right]) {
      const neighbor = reached[index]!.neighbor(direction);
      if (open(neighbor) && !reached.some((tile) => tile.equals(neighbor))) reached.push(neighbor);
    }
  }
  return reached;
}

const covered = (reached: readonly TilePosition[]) => (tile: TilePosition) =>
  reached.some((other) => other.equals(tile));

function collect(level: Level, key: TilePosition): void {
  const path = pathTo(level, (tile) => tile.equals(key));
  expect(path, `key ${key.column}, ${key.row} must be reachable`).toBeDefined();
  expect(follow(level, path!).filter((event) => event instanceof KeyCollected)).toHaveLength(1);
}

function leaveThroughDoor(level: Level): void {
  expect(level.door.isOpen).toBe(false);
  level.openDoor();
  const events = follow(
    level,
    pathTo(level, (tile) => level.door.covers(tile))!,
  );
  expect(events.filter((event) => event instanceof LevelCompleted)).toEqual([new LevelCompleted(thirdLevelId)]);
  expect(level.isComplete).toBe(true);
  expect(level.tick(Heading.of(Direction.Up))).toEqual([]);
}

function expectDoorShut(level: Level): void {
  expect(level.keys).toHaveLength(1);
  expect(level.door.isOpen).toBe(false);
  expect(() => level.openDoor()).toThrow();
  expect(pathTo(level, (tile) => level.door.covers(tile))).toBeUndefined();
}

test('the third level is a 30 by 30 map with a top door, an orchard gate, a gold key and a silver key', () => {
  const level = thirdLevel(keepOrder);
  expect(level.id).toBe(thirdLevelId);
  expect(level.scenery.size).toEqual({ columns: 30, rows: 30 });
  expect(level.hero.position).toEqual(at(14, 26));
  expect(level.hero.facing).toBe(Direction.Up);
  expect(level.door.equals(Door.closedAt(at(13, 1)))).toBe(true);
  expect(level.door.footprint).toEqual([at(13, 1), at(14, 1), at(15, 1)]);
  expect(level.gate?.equals(SwingGate.closedAt(at(8, 12)))).toBe(true);
  expect(level.keys.map((key) => [key.position, key.material])).toEqual([
    [goldKey, KeyMaterial.Gold],
    [silverKey, KeyMaterial.Silver],
  ]);
});

test('the third level marks twenty star spots and lets the shuffle choose its stars', () => {
  const spots = starSpotsOf(thirdLevel);
  expect(spots).toHaveLength(20);
  expect(spots).toEqual(expect.arrayContaining([...orchardSpots, ...otherSpots]));
  expect(thirdLevel(reverseOrder).stars.map((star) => star.position)).toEqual([...spots].reverse().slice(0, 5));
});

test('the third level keeps the orchard, its key and its star spots shut until the gate opens', () => {
  const level = thirdLevel(keepOrder);
  const reachable = covered(reachedFromStart(level, false));
  expect(reachable(level.gate!.approach)).toBe(true);
  expect(tiles.filter((tile) => inOrchard(tile) && reachable(tile))).toEqual([]);
  expect(reachable(silverKey)).toBe(true);
  expect(otherSpots.filter((spot) => !reachable(spot))).toEqual([]);
  expect(pathTo(level, (tile) => inOrchard(tile))).toBeUndefined();
});

test('the third level leaves no open ground cut off once the gate opens', () => {
  const level = thirdLevel(keepOrder);
  const reachable = covered(reachedFromStart(level, true));
  const open = (tile: TilePosition): boolean =>
    level.scenery.isWalkable(tile) &&
    !level.stones.some((stone) => stone.position.equals(tile)) &&
    !level.door.covers(tile);
  expect(tiles.filter((tile) => open(tile) && !reachable(tile))).toEqual([]);
  expect([goldKey, ...orchardSpots].filter((tile) => !reachable(tile))).toEqual([]);
});

test('the third level joins its pond island to the shore by a single path tile', () => {
  const level = thirdLevel(keepOrder);
  expect(covered(reachedFromStart(level, true))(silverKey)).toBe(true);
  expect(covered(reachedFromStart(level, true, islandLink))(silverKey)).toBe(false);
});

test('the third level splits its 900 tiles between the orchard key and the pond key', () => {
  const level = thirdLevel(keepOrder);
  const [gold, silver] = level.keys.map((key) => key.restores);
  expect(gold!.tiles).toHaveLength(452);
  expect(silver!.tiles).toHaveLength(448);
  expect(tiles.filter((tile) => gold!.covers(tile) === silver!.covers(tile))).toEqual([]);
  expect(gold!.covers(goldKey)).toBe(true);
  expect(silver!.covers(silverKey)).toBe(true);
  expect(tiles.filter(inOrchard).filter((tile) => !gold!.covers(tile))).toEqual([]);
});

test('the third level is played gold first: through the gate, to the island and out of the door', () => {
  const level = thirdLevel(keepOrder);
  expect(pathTo(level, (tile) => tile.equals(goldKey))).toBeUndefined();
  openGate(level);
  collect(level, goldKey);
  expectDoorShut(level);
  collect(level, silverKey);
  leaveThroughDoor(level);
});

test('the third level is played silver first: to the island, then through the gate and out of the door', () => {
  const level = thirdLevel(keepOrder);
  collect(level, silverKey);
  expectDoorShut(level);
  expect(pathTo(level, (tile) => tile.equals(goldKey))).toBeUndefined();
  openGate(level);
  collect(level, goldKey);
  leaveThroughDoor(level);
});

test('the third level can open its gate before either key and still take the silver key first', () => {
  const level = thirdLevel(keepOrder);
  openGate(level);
  collect(level, silverKey);
  expectDoorShut(level);
  collect(level, goldKey);
  leaveThroughDoor(level);
});
