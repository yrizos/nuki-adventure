import { expect, test } from 'vitest';
import { check2dObstacles } from '../infrastructure/check2d-obstacles';
import { Door } from '../domain/door';
import type { Level } from '../domain/level';
import { LevelCompleted, OrbCollected } from '../domain/level-events';
import { Direction, Heading, TilePosition } from '../domain/position';
import { FlowerVariant, Ground, TreeVariant } from '../domain/scenery';
import { SwingGate } from '../domain/swing-gate';
import { fitCanvas } from '../../user-interface/shell/viewport-layout';
import { cameraPosition, tileSize } from '../../user-interface/world/world-geometry';
import { keepOrder, lowestRoll } from '../testing/draws';
import { collectEveryOrb, follow, pathTo, settleGate } from '../testing/walk-level';
import { secondLevel, secondLevelId } from './second';

const at = TilePosition.at;
const tiles = Array.from({ length: 25 * 25 }, (_, index) => at(index % 25, Math.floor(index / 25)));
const gardenOrb = at(21, 6);

function reachedFromStart(level: Level, gateOpen: boolean): readonly TilePosition[] {
  const open = (tile: TilePosition): boolean =>
    level.scenery.isWalkable(tile) &&
    !level.stones.some((stone) => stone.position.equals(tile)) &&
    !level.door.covers(tile) &&
    (gateOpen || !level.gates[0]!.covers(tile));
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
    pathTo(level, (tile) => tile.equals(level.gates[0]!.approach))!,
  );
  level.tick(Heading.of(Direction.Up));
  level.tick(null);
  level.operateGate();
  settleGate(level);
}

test('the second level selects only white-violet and coral-blue flowers', () => {
  expect(secondLevel(keepOrder, check2dObstacles, lowestRoll).scenery.flowerVariants).toEqual([
    FlowerVariant.WhiteViolet,
    FlowerVariant.CoralBlue,
  ]);
});

test('the second level fences a lemon garden into its north-east corner with one straight horizontal fence, one gate, a garden orb and a southern orb', () => {
  const level = secondLevel(keepOrder, check2dObstacles, lowestRoll);
  expect(level.id).toBe(secondLevelId);
  expect(level.scenery.size).toEqual({ columns: 25, rows: 25 });
  expect(level.hero.position).toEqual(at(6, 21));
  expect(level.door).toEqual(Door.closedAt(at(18, 1)));
  expect(level.gates).toEqual([SwingGate.closedAt(at(19, 7), Direction.Down)]);
  expect(level.permanentOrbs).toEqual([gardenOrb, at(7, 19)]);
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
  const { trees } = secondLevel(keepOrder, check2dObstacles, lowestRoll).scenery;
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
  const { scenery } = secondLevel(keepOrder, check2dObstacles, lowestRoll);
  const water = tiles.filter((tile) => scenery.groundAt(tile).equals(Ground.Water));
  expect(water.filter((tile) => tile.column > 17)).toEqual([]);
  expect(water).toHaveLength(17);
  expect(water.every((tile) => tile.column >= 6 && tile.column <= 12 && tile.row >= 13 && tile.row <= 16)).toBe(true);
});

test('the second level places its permanent orb at least six tiles from the exit', () => {
  const level = secondLevel(keepOrder, check2dObstacles, lowestRoll);
  for (const orb of level.permanentOrbs) {
    const distance = Math.min(
      ...level.door.footprint.map((tile) => Math.abs(tile.column - orb.column) + Math.abs(tile.row - orb.row)),
    );
    expect(distance).toBeGreaterThanOrEqual(6);
  }
});

test('the second level keeps the walled garden, its permanent orb and the door out of reach until the gate opens', () => {
  const level = secondLevel(keepOrder, check2dObstacles, lowestRoll);
  const closed = reachedFromStart(level, false);
  const reachable = (tile: TilePosition): boolean => closed.some((other) => other.equals(tile));
  expect(reachable(level.gates[0]!.approach)).toBe(true);
  expect(reachable(gardenOrb)).toBe(false);
  expect(level.door.footprint.map((tile) => tile.neighbor(Direction.Down)).filter(reachable)).toEqual([]);
  expect(reachedFromStart(level, true).some((other) => other.equals(gardenOrb))).toBe(true);
});

test('the second level is played through the gate, to every orb and out of the door', () => {
  const level = secondLevel(keepOrder, check2dObstacles, lowestRoll);
  const toGarden = (tile: TilePosition): boolean => tile.equals(gardenOrb);
  expect(pathTo(level, toGarden)).toBeUndefined();
  openGate(level);
  expect(level.gates[0]?.state).toBe('open');
  expect(follow(level, pathTo(level, toGarden)!).some((event) => event instanceof OrbCollected)).toBe(true);
  collectEveryOrb(level);
  level.openDoor();
  const events = follow(
    level,
    pathTo(level, (tile) => level.door.covers(tile))!,
  );
  expect(events).toContainEqual(new LevelCompleted(secondLevelId));
  expect(level.gates[0]?.state).toBe('open');
});

test.each([
  ['desktop', 1280, 900, 1],
  ['desktop', 1280, 900, 2],
  ['desktop', 1280, 900, 3],
  ['mobile', 390, 844, 1],
  ['mobile', 390, 844, 2],
  ['mobile', 390, 844, 3],
] as const)(
  'the second level initially shows no part of its northern orb on %s %sx%s at pixel ratio %s',
  (_, width, height, ratio) => {
    const level = secondLevel(keepOrder, check2dObstacles, lowestRoll);
    const columnWidth = width >= 600 ? Math.max(320, Math.min(width, (height * 360) / 544)) : width;
    const deviceWidth = Math.floor(columnWidth * ratio);
    const panelPixel = Math.max(1, Math.floor(deviceWidth / 180));
    const deviceHeight = height * ratio - 92 * panelPixel;
    const fit = fitCanvas(deviceWidth, deviceHeight);
    const camera = cameraPosition(level, fit.width, fit.height);
    const visibleWidth = deviceWidth / fit.scale;
    const visibleHeight = deviceHeight / fit.scale;
    for (const orb of level.permanentOrbs.slice(0, 1)) {
      const left = orb.column * tileSize + 4 - camera.x;
      const top = orb.row * tileSize + 4 - camera.y;
      const overlapWidth = Math.max(0, Math.min(left + 24, visibleWidth) - Math.max(left, 0));
      const overlapHeight = Math.max(0, Math.min(top + 24, visibleHeight) - Math.max(top, 0));
      expect(overlapWidth * overlapHeight).toBe(0);
    }
  },
);
