import { expect, test } from 'vitest';
import { Door } from '../domain/level/door';
import type { Level } from '../domain/level/level';
import { KeyCollected, LevelCompleted } from '../domain/level/level-events';
import { Direction, Heading, TilePosition } from '../domain/level/position';
import { Ground } from '../domain/level/scenery';
import { SwingGate } from '../domain/level/swing-gate';
import { keepOrder, reverseOrder, starSpotsOf } from '../test-support/star-spots';
import { follow, pathTo } from '../test-support/walk-level';
import { secondLevel, secondLevelId } from './second-level';

const at = TilePosition.at;
const tiles = Array.from({ length: 25 * 25 }, (_, index) => at(index % 25, Math.floor(index / 25)));
const northernSpots = [
  at(15, 3),
  at(21, 3),
  at(5, 4),
  at(2, 6),
  at(11, 6),
  at(19, 6),
  at(20, 9),
  at(5, 11),
  at(10, 11),
  at(21, 12),
];
const southernSpots = [
  at(13, 14),
  at(4, 16),
  at(8, 16),
  at(22, 17),
  at(10, 18),
  at(2, 19),
  at(15, 19),
  at(22, 20),
  at(5, 21),
  at(18, 22),
];

function reachedFromStart(level: Level, gateOpen: boolean): readonly TilePosition[] {
  const open = (tile: TilePosition): boolean =>
    level.scenery.isWalkable(tile) &&
    !level.stones.some((stone) => stone.position.equals(tile)) &&
    !level.door.covers(tile) &&
    (gateOpen || !level.gate!.covers(tile));
  const reached = [level.hero.position];
  for (let index = 0; index < reached.length; index++) {
    for (const direction of [Direction.Up, Direction.Down, Direction.Left, Direction.Right]) {
      const neighbor = reached[index]!.neighbor(direction);
      if (open(neighbor) && !reached.some((tile) => tile.equals(neighbor))) reached.push(neighbor);
    }
  }
  return reached;
}

function openGate(level: Level): void {
  follow(
    level,
    pathTo(level, (tile) => tile.equals(level.gate!.approach))!,
  );
  level.tick(Heading.of(Direction.Up));
  level.tick(null);
  level.operateGate();
  level.finishGate();
}

test('the second level holds a lakeside behind a swing gate and one key that restores the whole level', () => {
  const level = secondLevel(keepOrder);
  expect(level.id).toBe(secondLevelId);
  expect(level.scenery.size).toEqual({ columns: 25, rows: 25 });
  expect(level.hero.position).toEqual(at(11, 21));
  expect(level.hero.facing).toBe(Direction.Up);
  expect(level.gate?.equals(SwingGate.closedAt(at(17, 13)))).toBe(true);
  expect(level.door.equals(Door.closedAt(at(11, 2)))).toBe(true);
  expect(level.keys.map((key) => key.position)).toEqual([at(2, 8)]);
  expect(level.keys[0]!.restores.tiles).toHaveLength(625);
  expect(tiles.filter((tile) => level.scenery.groundAt(tile) === Ground.Water)).toHaveLength(28);
});

test('the second level marks twenty star spots, ten on each side of the gate, and lets the shuffle choose its stars', () => {
  const spots = starSpotsOf(secondLevel);
  expect(spots).toHaveLength(20);
  expect(spots).toEqual(expect.arrayContaining([...northernSpots, ...southernSpots]));
  expect(secondLevel(reverseOrder).stars.map((star) => star.position)).toEqual([...spots].reverse().slice(0, 5));
});

test('the second level keeps the lakeside, its key and its star spots out of reach until the gate opens', () => {
  const level = secondLevel(keepOrder);
  const closed = reachedFromStart(level, false);
  const reachable = (tile: TilePosition): boolean => closed.some((other) => other.equals(tile));
  expect(reachable(level.gate!.approach)).toBe(true);
  expect(reachable(at(2, 8))).toBe(false);
  expect(northernSpots.filter(reachable)).toEqual([]);
  expect(southernSpots.filter((spot) => !reachable(spot))).toEqual([]);
});

test('the second level leaves no open ground cut off once the gate opens', () => {
  const level = secondLevel(keepOrder);
  const reached = reachedFromStart(level, true);
  const open = (tile: TilePosition): boolean =>
    level.scenery.isWalkable(tile) &&
    !level.stones.some((stone) => stone.position.equals(tile)) &&
    !level.door.covers(tile);
  expect(tiles.filter((tile) => open(tile) && !reached.some((other) => other.equals(tile)))).toEqual([]);
});

test('the second level lets the hero materialize with every surrounding tile free', () => {
  const level = secondLevel(keepOrder);
  const spots = starSpotsOf(secondLevel);
  const start = level.hero.position;
  const blocked = [-1, 0, 1]
    .flatMap((rows) => [-1, 0, 1].map((columns) => at(start.column + columns, start.row + rows)))
    .filter(
      (tile) =>
        !level.scenery.isWalkable(tile) ||
        level.stones.some((stone) => stone.position.equals(tile)) ||
        level.scenery.flowers.some((flower) => flower.position.equals(tile)) ||
        level.keys.some((key) => key.position.equals(tile)) ||
        spots.some((spot) => spot.equals(tile)) ||
        level.scenery.trees.some((tree) => tree.hides(tile)) ||
        level.scenery.hides(tile),
    );
  expect(blocked).toEqual([]);
});

test('the second level is played through the gate, to the key and out of the door', () => {
  const level = secondLevel(keepOrder);
  const toKey = (tile: TilePosition): boolean => tile.equals(at(2, 8));
  expect(pathTo(level, toKey)).toBeUndefined();
  openGate(level);
  expect(level.gate?.state).toBe('open');
  expect(follow(level, pathTo(level, toKey)!).some((event) => event instanceof KeyCollected)).toBe(true);
  level.openDoor();
  const events = follow(
    level,
    pathTo(level, (tile) => level.door.covers(tile))!,
  );
  expect(events).toContainEqual(new LevelCompleted(secondLevelId));
  expect(level.gate?.state).toBe('open');
});
