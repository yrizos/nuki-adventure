import { expect, test } from 'vitest';
import { Door } from '../domain/level/door';
import type { Level } from '../domain/level/level';
import { KeyCollected, LevelCompleted } from '../domain/level/level-events';
import { Direction, Heading, TilePosition } from '../domain/level/position';
import { FlowerVariant, Ground, TreeVariant } from '../domain/level/scenery';
import { SwingGate } from '../domain/level/swing-gate';
import { fitCanvas } from '../presentation/viewport-layout';
import { cameraPosition, tileSize } from '../presentation/world-geometry';
import { keepOrder, reverseOrder, starSpotsOf } from '../test-support/star-spots';
import { follow, pathTo, settleGate } from '../test-support/walk-level';
import { secondLevel, secondLevelId } from './second-level';

const at = TilePosition.at;
const tiles = Array.from({ length: 25 * 25 }, (_, index) => at(index % 25, Math.floor(index / 25)));
const key = at(21, 6);
const permanentSpots = [at(3, 6), at(21, 17)];
const gardenSpots = [at(22, 6)];
const outerSpots = [
  at(4, 3),
  at(7, 3),
  at(2, 9),
  at(14, 9),
  at(22, 9),
  at(10, 10),
  at(19, 13),
  at(2, 14),
  at(22, 14),
  at(13, 15),
  at(17, 17),
  at(2, 18),
  at(3, 19),
  at(22, 19),
  at(18, 20),
  at(9, 21),
  at(16, 21),
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
  settleGate(level);
}

test('the second level selects only white-violet and coral-blue flowers', () => {
  expect(secondLevel(keepOrder).scenery.flowerVariants).toEqual([FlowerVariant.WhiteViolet, FlowerVariant.CoralBlue]);
});

test('the second level fences a lemon garden into its north-east corner with one straight horizontal fence, one gate and one key that restores the whole level', () => {
  const level = secondLevel(keepOrder);
  expect(level.id).toBe(secondLevelId);
  expect(level.scenery.size).toEqual({ columns: 25, rows: 25 });
  expect(level.hero.position).toEqual(at(6, 21));
  expect(level.door).toEqual(Door.closedAt(at(18, 1)));
  expect(level.gate).toEqual(SwingGate.closedAt(at(19, 7), Direction.Down));
  expect(level.keys.map((each) => each.position)).toEqual([key]);
  expect(level.keys[0]!.restores.tiles).toHaveLength(25 * 25);
  expect(level.scenery.fences.map((fence) => fence.position)).toEqual([
    at(17, 7),
    at(18, 7),
    ...Array.from({ length: 4 }, (_, index) => at(20 + index, 7)),
  ]);
  expect(level.stones.map((stone) => stone.position)).toEqual([
    at(3, 3),
    at(6, 3),
    at(4, 5),
    at(5, 5),
    at(2, 8),
    at(5, 8),
  ]);
  expect(level.scenery.flowers).toHaveLength(9);
});

test('the second level grows lemon trees only in the walled garden and orange trees only in the northern orchard', () => {
  const { trees } = secondLevel(keepOrder).scenery;
  expect(trees.filter((tree) => tree.variant.equals(TreeVariant.Lemons)).map((tree) => tree.base)).toEqual([
    at(19, 4),
    at(21, 4),
  ]);
  expect(trees.filter((tree) => tree.variant.equals(TreeVariant.Oranges)).map((tree) => tree.base)).toEqual([
    at(13, 6),
    at(10, 7),
    at(12, 9),
  ]);
  expect(trees).toHaveLength(5);
});

test('the second level holds one lake beside the western track and no water in the walled garden', () => {
  const { scenery } = secondLevel(keepOrder);
  const water = tiles.filter((tile) => scenery.groundAt(tile).equals(Ground.Water));
  expect(water.filter((tile) => tile.column > 17)).toEqual([]);
  expect(water).toHaveLength(17);
  expect(water.every((tile) => tile.column >= 6 && tile.column <= 12 && tile.row >= 13 && tile.row <= 16)).toBe(true);
});

test('the second level always holds stars in the ruined courtyard and in the forest clearing and lets the shuffle choose three of its eighteen other spots', () => {
  const spots = starSpotsOf(secondLevel);
  expect(spots).toHaveLength(18);
  expect(spots).toEqual(expect.arrayContaining([...gardenSpots, ...outerSpots]));
  expect(secondLevel(reverseOrder).stars.map((star) => star.position)).toEqual([
    ...permanentSpots,
    ...[...spots].reverse().slice(0, 3),
  ]);
});

test('the second level places its key at least six tiles from the exit', () => {
  const level = secondLevel(keepOrder);
  for (const each of level.keys) {
    const distance = Math.min(
      ...level.door.footprint.map(
        (tile) => Math.abs(tile.column - each.position.column) + Math.abs(tile.row - each.position.row),
      ),
    );
    expect(distance).toBeGreaterThanOrEqual(6);
  }
});

test('the second level keeps the walled garden, its key, the door and its star spots out of reach until the gate opens', () => {
  const level = secondLevel(keepOrder);
  const closed = reachedFromStart(level, false);
  const reachable = (tile: TilePosition): boolean => closed.some((other) => other.equals(tile));
  expect(reachable(level.gate!.approach)).toBe(true);
  expect(reachable(key)).toBe(false);
  expect(level.door.footprint.map((tile) => tile.neighbor(Direction.Down)).filter(reachable)).toEqual([]);
  expect(gardenSpots.filter(reachable)).toEqual([]);
  expect([...outerSpots, ...permanentSpots].filter((spot) => !reachable(spot))).toEqual([]);
  const opened = reachedFromStart(level, true);
  expect([key, ...gardenSpots].filter((tile) => !opened.some((other) => other.equals(tile)))).toEqual([]);
});

test('the second level is played through the gate, to the key and out of the door', () => {
  const level = secondLevel(keepOrder);
  const toKey = (tile: TilePosition): boolean => tile.equals(key);
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

test.each([
  ['desktop', 1280, 900, 1],
  ['desktop', 1280, 900, 2],
  ['desktop', 1280, 900, 3],
  ['mobile', 390, 844, 1],
  ['mobile', 390, 844, 2],
  ['mobile', 390, 844, 3],
] as const)(
  'the second level initially shows no part of its key on %s %sx%s at pixel ratio %s',
  (_, width, height, ratio) => {
    const level = secondLevel(keepOrder);
    const columnWidth = width >= 600 ? Math.max(320, Math.min(width, (height * 360) / 544)) : width;
    const deviceWidth = Math.floor(columnWidth * ratio);
    const panelPixel = Math.max(1, Math.floor(deviceWidth / 180));
    const deviceHeight = height * ratio - 92 * panelPixel;
    const fit = fitCanvas(deviceWidth, deviceHeight);
    const camera = cameraPosition(level, fit.width, fit.height);
    const visibleWidth = deviceWidth / fit.scale;
    const visibleHeight = deviceHeight / fit.scale;
    for (const each of level.keys) {
      const left = each.position.column * tileSize + 4 - camera.x;
      const top = each.position.row * tileSize + 4 - camera.y;
      const overlapWidth = Math.max(0, Math.min(left + 24, visibleWidth) - Math.max(left, 0));
      const overlapHeight = Math.max(0, Math.min(top + 24, visibleHeight) - Math.max(top, 0));
      expect(overlapWidth * overlapHeight).toBe(0);
    }
  },
);
