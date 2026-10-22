import { expect, test } from 'vitest';
import { check2dObstacles } from '../infrastructure/check2d-obstacles';
import { Door } from '../domain/door';
import type { Level } from '../domain/level';
import { LevelCompleted, OrbCollected } from '../domain/level-events';
import { Direction, TilePosition, tileKey } from '../domain/position';
import { Ground } from '../domain/scenery';
import { SwingGate } from '../domain/swing-gate';
import { mandatoryRoute } from '../testing/routes';
import { keepOrder, lowestRoll } from '../testing/draws';
import { collectEveryOrb, follow, openGate, pathTo } from '../testing/walk-level';
import { sixthLevel, sixthLevelId } from './sixth';

const at = TilePosition.at;
const ruinsOrb = at(3, 3);
const gardenOrb = at(19, 4);
const gate = at(17, 4);
const label = ({ column, row }: TilePosition): string => `${column}, ${row}`;

function tilesOf(level: Level): readonly TilePosition[] {
  const { columns, rows } = level.scenery.size;
  return Array.from({ length: columns * rows }, (_, index) => at(index % columns, Math.floor(index / columns)));
}

function hidden(level: Level, tile: TilePosition): boolean {
  return level.scenery.hides(tile) || level.scenery.trees.some((tree) => tree.hides(tile));
}

function blocking(level: Level, tile: TilePosition): boolean {
  return (
    !level.scenery.size.contains(tile) ||
    !level.scenery.isWalkable(tile) ||
    level.stones.some((stone) => stone.position.equals(tile)) ||
    level.door.covers(tile)
  );
}

// Following blocking tiles from outside the map, corners included, reaches every obstacle the boundary joins.
function obstaclesJoinedToBoundary(level: Level, alsoBlocking: (tile: TilePosition) => boolean): readonly string[] {
  const { columns, rows } = level.scenery.size;
  const obstacle = (tile: TilePosition): boolean =>
    level.scenery.size.contains(tile) &&
    (level.scenery.groundAt(tile).equals(Ground.Water) ||
      level.scenery.trees.some((tree) => tree.covers(tile)) ||
      level.scenery.fences.some((fence) => fence.position.equals(tile)) ||
      level.stones.some((stone) => stone.position.equals(tile)));
  const outside = [
    ...Array.from({ length: columns + 2 }, (_, index) => [at(index - 1, -1), at(index - 1, rows)]),
    ...Array.from({ length: rows }, (_, index) => [at(-1, index), at(columns, index)]),
  ].flat();
  const seen = new Set(outside.map(tileKey));
  const reached = [...outside];
  const joined: string[] = [];
  for (let index = 0; index < reached.length; index++) {
    for (const row of [-1, 0, 1]) {
      for (const column of [-1, 0, 1]) {
        const next = at(reached[index]!.column + column, reached[index]!.row + row);
        if (!level.scenery.size.contains(next) || seen.has(tileKey(next))) continue;
        if (!blocking(level, next) && !alsoBlocking(next)) continue;
        seen.add(tileKey(next));
        reached.push(next);
        if (obstacle(next)) joined.push(label(next));
      }
    }
  }
  return joined;
}

test('the sixth level is a 25 by 25 map with a door right of center, permanent orbs in the ruins, behind a gate and near the start', () => {
  const level = sixthLevel(keepOrder, check2dObstacles, lowestRoll);
  expect(level.id).toBe(sixthLevelId);
  expect(level.scenery.size).toEqual({ columns: 25, rows: 25 });
  expect(level.door).toEqual(Door.closedAt(at(14, 1)));
  expect(level.gates).toEqual([SwingGate.closedAt(gate, Direction.Left)]);
  expect(level.permanentOrbs).toEqual([ruinsOrb, gardenOrb, at(10, 21)]);
});

test('the mandatory route climbs the lake shore to the ruins and winds through the grove and orchard to the garden', () => {
  const route = mandatoryRoute(sixthLevel(keepOrder, check2dObstacles, lowestRoll));
  const places = {
    'lake shore': at(5, 12),
    ruins: at(4, 6),
    grove: at(11, 12),
    orchard: at(17, 11),
    courtyard: at(16, 4),
    garden: at(18, 4),
  };
  expect(
    Object.entries(places)
      .filter(([, tile]) => !route.covers(tile))
      .map(([place]) => place),
  ).toEqual([]);
});

// Counting hidden tiles as blocking, an obstacle joined to the boundary has no loop around it on visible ground.
test('the sixth level lets her walk a full loop around every obstacle without stepping on a hidden tile', () => {
  const level = sixthLevel(keepOrder, check2dObstacles, lowestRoll);
  expect(obstaclesJoinedToBoundary(level, (tile) => hidden(level, tile))).toEqual([]);
});

test('the sixth level leaves no diagonal gap between two blocking tiles that meet only at a corner', () => {
  const level = sixthLevel(keepOrder, check2dObstacles, lowestRoll);
  const gaps = tilesOf(level).filter(({ column, row }) => {
    const [topLeft, topRight, bottomLeft, bottomRight] = [
      blocking(level, at(column, row)),
      blocking(level, at(column + 1, row)),
      blocking(level, at(column, row + 1)),
      blocking(level, at(column + 1, row + 1)),
    ];
    return topLeft === bottomRight && topRight === bottomLeft && topLeft !== topRight;
  });
  expect(gaps.map(label)).toEqual([]);
});

test('the sixth level joins its paths only along edges, never at a lone corner', () => {
  const level = sixthLevel(keepOrder, check2dObstacles, lowestRoll);
  const isPath = (column: number, row: number): boolean =>
    level.scenery.size.contains(at(column, row)) && level.scenery.groundAt(at(column, row)).equals(Ground.Path);
  const corners = tilesOf(level).filter(({ column, row }) => {
    const [topLeft, topRight, bottomLeft, bottomRight] = [
      isPath(column, row),
      isPath(column + 1, row),
      isPath(column, row + 1),
      isPath(column + 1, row + 1),
    ];
    return topLeft === bottomRight && topRight === bottomLeft && topLeft !== topRight;
  });
  expect(corners.map(label)).toEqual([]);
});

test('the sixth level hides no usable item under a canopy', () => {
  const level = sixthLevel(keepOrder, check2dObstacles, lowestRoll);
  const items = [...level.permanentOrbs, gate, level.gates[0]!.approach];
  expect(items.filter((item) => hidden(level, item)).map(label)).toEqual([]);
});

test('the sixth level lets her reach both permanent orbs and the door without stepping on a hidden tile', () => {
  const level = sixthLevel(keepOrder, check2dObstacles, lowestRoll);
  const reached = [level.hero.position];
  const seen = new Set([tileKey(level.hero.position)]);
  for (let index = 0; index < reached.length; index++) {
    for (const direction of [Direction.Up, Direction.Down, Direction.Left, Direction.Right]) {
      const next = reached[index]!.neighbor(direction);
      if (seen.has(tileKey(next)) || blocking(level, next) || hidden(level, next)) continue;
      seen.add(tileKey(next));
      reached.push(next);
    }
  }
  const objectives = [...level.permanentOrbs, ...level.door.footprint.map((tile) => tile.neighbor(Direction.Down))];
  expect(objectives.filter((tile) => !seen.has(tileKey(tile))).map(label)).toEqual([]);
});

test('from the gate approach the garden orb and the door fit in the seven by seven view', () => {
  const approach = sixthLevel(keepOrder, check2dObstacles, lowestRoll).gates[0]!.approach;
  const reach = (tile: TilePosition): number =>
    Math.max(Math.abs(tile.column - approach.column), Math.abs(tile.row - approach.row));
  expect(reach(gardenOrb)).toBeLessThanOrEqual(3);
  expect(Math.min(...Door.closedAt(at(14, 1)).footprint.map(reach))).toBeLessThanOrEqual(3);
});

test('the sixth level keeps the door shut after one orb and opens it once she has every orb', () => {
  const level = sixthLevel(keepOrder, check2dObstacles, lowestRoll);
  const toRuins = pathTo(level, (tile) => tile.equals(ruinsOrb));
  expect(toRuins, 'the ruins orb must be reachable from the start').toBeDefined();
  expect(follow(level, toRuins!).some((event) => event instanceof OrbCollected)).toBe(true);
  expect(
    pathTo(level, (tile) => tile.equals(gardenOrb)),
    'the gate must guard the garden orb',
  ).toBeUndefined();
  openGate(level);
  const toGarden = pathTo(level, (tile) => tile.equals(gardenOrb));
  expect(toGarden, 'the garden orb must open up once the gate swings').toBeDefined();
  expect(follow(level, toGarden!).some((event) => event instanceof OrbCollected)).toBe(true);
  collectEveryOrb(level);
  level.openDoor();
  const toDoor = pathTo(level, (tile) => level.door.covers(tile));
  expect(toDoor, 'the door must be reachable from the garden').toBeDefined();
  expect(follow(level, toDoor!).some((event) => event instanceof LevelCompleted)).toBe(true);
});
