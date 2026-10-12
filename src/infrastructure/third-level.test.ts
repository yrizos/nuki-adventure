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
const tiles = Array.from({ length: 25 * 25 }, (_, index) => at(index % 25, Math.floor(index / 25)));
const goldKey = at(7, 10);
const islandSpot = at(18, 9);
const islandLink = at(18, 11);
const starSpots = [
  at(16, 2),
  at(4, 3),
  at(1, 6),
  at(10, 3),
  at(20, 5),
  at(22, 8),
  islandSpot,
  at(14, 10),
  at(2, 11),
  at(22, 11),
  at(22, 14),
  at(2, 15),
  at(9, 16),
  at(15, 17),
  at(19, 18),
  at(3, 20),
  at(6, 21),
  at(20, 21),
  at(16, 22),
  at(9, 22),
];
const inOrchard = (tile: TilePosition): boolean =>
  tile.column >= 5 && tile.column <= 9 && tile.row >= 8 && tile.row <= 11;

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

test('the third level is a 25 by 25 map with a top door, an orchard gate and one gold key', () => {
  const level = thirdLevel(keepOrder);
  expect(level.id).toBe(thirdLevelId);
  expect(level.scenery.size).toEqual({ columns: 25, rows: 25 });
  expect(level.hero.position).toEqual(at(12, 21));
  expect(level.door).toEqual(Door.closedAt(at(11, 1)));
  expect(level.gate).toEqual(SwingGate.closedAt(at(7, 12)));
  expect(level.keys.map((key) => [key.position, key.material])).toEqual([[goldKey, KeyMaterial.Gold]]);
});

test('the third level marks twenty star spots and lets the shuffle choose its stars', () => {
  const spots = starSpotsOf(thirdLevel);
  expect(spots).toHaveLength(20);
  expect(spots).toEqual(expect.arrayContaining(starSpots));
  expect(spots.filter(inOrchard)).toEqual([]);
  expect(thirdLevel(reverseOrder).stars.map((star) => star.position)).toEqual([...spots].reverse().slice(0, 5));
});

test('the third level keeps the orchard and its key shut until the gate opens', () => {
  const level = thirdLevel(keepOrder);
  const reachable = covered(reachedFromStart(level, false));
  expect(reachable(level.gate!.approach)).toBe(true);
  expect(tiles.filter((tile) => inOrchard(tile) && reachable(tile))).toEqual([]);
  expect(starSpots.filter((spot) => !reachable(spot))).toEqual([]);
  expect(pathTo(level, (tile) => inOrchard(tile))).toBeUndefined();
});

test('the third level joins its pond island, which holds a star spot, to the shore by a single path tile', () => {
  const level = thirdLevel(keepOrder);
  expect(covered(reachedFromStart(level, true))(islandSpot)).toBe(true);
  expect(covered(reachedFromStart(level, true, islandLink))(islandSpot)).toBe(false);
});

test('the third level is played through the gate, to the key and out of the door', () => {
  const level = thirdLevel(keepOrder);
  expect(pathTo(level, (tile) => tile.equals(goldKey))).toBeUndefined();
  openGate(level);
  collect(level, goldKey);
  leaveThroughDoor(level);
});
