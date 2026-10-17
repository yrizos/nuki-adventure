import { expect, test } from 'vitest';
import { check2dObstacles } from '../infrastructure/check2d-obstacles';
import { KeyMaterial } from '../domain/collectibles';
import { Door } from '../domain/door';
import type { Level } from '../domain/level';
import { KeyCollected, LevelCompleted } from '../domain/level-events';
import { Direction, Heading, TilePosition } from '../domain/position';
import { TreeVariant } from '../domain/scenery';
import { SwingGate } from '../domain/swing-gate';
import { explorationArea, mandatoryRoute } from '../testing/routes';
import { keepOrder, reverseOrder, starSpotsOf } from '../testing/star-spots';
import { follow, openGate, pathTo } from '../testing/walk-level';
import { thirdLevel, thirdLevelId } from './third';

const at = TilePosition.at;
const tiles = Array.from({ length: 25 * 25 }, (_, index) => at(index % 25, Math.floor(index / 25)));
const start = at(15, 21);
const goldKey = at(14, 11);
const islandSpot = at(11, 16);
const islandLink = at(11, 17);
const farRight = at(22, 21);
const permanentSpots = [islandSpot, farRight];
const orchardSpots = [at(12, 9), at(19, 9)];
const outerSpots = [
  at(17, 2),
  at(18, 4),
  at(5, 6),
  at(2, 7),
  at(21, 7),
  at(3, 9),
  at(22, 11),
  at(9, 13),
  at(12, 14),
  at(4, 15),
  at(2, 16),
  at(4, 18),
  at(22, 19),
  at(5, 20),
  at(10, 21),
  at(13, 22),
];
const inOrchard = (tile: TilePosition): boolean =>
  tile.column >= 12 && tile.column <= 19 && tile.row >= 6 && tile.row <= 11;

function reachedFromStart(level: Level, gatesOpen: boolean, blocked?: TilePosition): readonly TilePosition[] {
  const open = (tile: TilePosition): boolean =>
    level.scenery.isWalkable(tile) &&
    !level.stones.some((stone) => stone.position.equals(tile)) &&
    !level.door.covers(tile) &&
    (gatesOpen || !level.gates.some((gate) => gate.covers(tile))) &&
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

test('the third level is a 25 by 25 map with a top-left door, gates in the top and bottom of the orchard fence and one gold key', () => {
  const level = thirdLevel(keepOrder, check2dObstacles);
  expect(level.id).toBe(thirdLevelId);
  expect(level.scenery.size).toEqual({ columns: 25, rows: 25 });
  expect(level.hero.position).toEqual(start);
  expect(level.door).toEqual(Door.closedAt(at(1, 1)));
  expect(level.gates).toEqual([
    SwingGate.closedAt(at(15, 5), Direction.Down),
    SwingGate.closedAt(at(16, 12), Direction.Down),
  ]);
  expect(level.keys.map((key) => [key.position, key.material])).toEqual([[goldKey, KeyMaterial.Gold]]);
});

test('the third level rings its apple orchard with one closed fence that holds both gates and grows apples only inside it', () => {
  const level = thirdLevel(keepOrder, check2dObstacles);
  const ring = tiles.filter(
    (tile) =>
      tile.column >= 11 &&
      tile.column <= 20 &&
      tile.row >= 5 &&
      tile.row <= 12 &&
      (tile.column === 11 || tile.column === 20 || tile.row === 5 || tile.row === 12),
  );
  const posts = [...level.scenery.fences.map((fence) => fence.position), ...level.gates.map((gate) => gate.position)];
  expect(posts).toHaveLength(ring.length);
  expect(ring.filter((tile) => !posts.some((post) => post.equals(tile)))).toEqual([]);
  const apples = (tree: (typeof level.scenery.trees)[number]): boolean => tree.variant.equals(TreeVariant.Apples);
  expect(level.scenery.trees.filter((tree) => inOrchard(tree.base) !== apples(tree))).toEqual([]);
});

test('the third level always holds stars on the pond island and at the far right of the start meadow and lets the shuffle choose three of its eighteen other spots', () => {
  const spots = starSpotsOf(thirdLevel);
  expect(spots).toHaveLength(18);
  expect(spots).toEqual(expect.arrayContaining([...orchardSpots, ...outerSpots]));
  expect(thirdLevel(reverseOrder, check2dObstacles).stars.map((star) => star.position)).toEqual([
    ...permanentSpots,
    ...[...spots].reverse().slice(0, 3),
  ]);
});

test('the third level keeps star spots off the mandatory route and at least half in exploration areas', () => {
  const level = thirdLevel(keepOrder, check2dObstacles);
  const spots = [...permanentSpots, ...starSpotsOf(thirdLevel)];
  const route = mandatoryRoute(level);
  const exploration = explorationArea(level);
  expect(spots.filter((spot) => route.covers(spot))).toEqual([]);
  expect(2 * spots.filter((spot) => exploration.covers(spot)).length).toBeGreaterThanOrEqual(spots.length);
});

test('the third level shows the key within the minimum view from the bottom gate approach', () => {
  const approach = thirdLevel(keepOrder, check2dObstacles).gates[1]!.approach;
  expect(approach).toEqual(at(16, 13));
  expect(Math.abs(goldKey.column - approach.column)).toBeLessThanOrEqual(3);
  expect(Math.abs(goldKey.row - approach.row)).toBeLessThanOrEqual(3);
});

test('the third level keeps the orchard and its key shut until a gate opens', () => {
  const level = thirdLevel(keepOrder, check2dObstacles);
  const reachable = covered(reachedFromStart(level, false));
  expect(reachable(level.gates[1]!.approach)).toBe(true);
  expect(tiles.filter((tile) => inOrchard(tile) && reachable(tile))).toEqual([]);
  expect([...outerSpots, ...permanentSpots].filter((spot) => !reachable(spot))).toEqual([]);
  expect(orchardSpots.filter((spot) => !covered(reachedFromStart(level, true))(spot))).toEqual([]);
  expect(pathTo(level, (tile) => inOrchard(tile))).toBeUndefined();
});

test('the third level joins its pond island to the shore by a single causeway', () => {
  const level = thirdLevel(keepOrder, check2dObstacles);
  expect(covered(reachedFromStart(level, true))(islandSpot)).toBe(true);
  expect(covered(reachedFromStart(level, true, islandLink))(islandSpot)).toBe(false);
});

test('the third level leads its mandatory route in through the bottom gate and out through the top gate', () => {
  const level = thirdLevel(keepOrder, check2dObstacles);
  const route = mandatoryRoute(level);
  expect(level.gates.filter((gate) => !route.covers(gate.position))).toEqual([]);
});

test('the third level is played in through the bottom gate, to the key, out through the top gate and out of the door', () => {
  const level = thirdLevel(keepOrder, check2dObstacles);
  expect(pathTo(level, (tile) => tile.equals(goldKey))).toBeUndefined();
  openGate(level, level.gates[1]);
  const toKey = pathTo(level, (tile) => tile.equals(goldKey));
  expect(toKey).toBeDefined();
  expect(follow(level, toKey!).filter((event) => event instanceof KeyCollected)).toHaveLength(1);
  openGate(level, level.gates[0]);
  level.openDoor();
  const events = follow(
    level,
    pathTo(level, (tile) => level.door.covers(tile))!,
  );
  expect(events.filter((event) => event instanceof LevelCompleted)).toEqual([new LevelCompleted(thirdLevelId)]);
  expect(level.isComplete).toBe(true);
  expect(level.tick(Heading.of(Direction.Up))).toEqual([]);
});
