import { expect, test } from 'vitest';
import { check2dObstacles } from '../infrastructure/check2d-obstacles';
import { LevelCompleted, OrbCollected } from '../domain/level-events';
import { orbCount } from '../domain/level';
import type { Random } from '../domain/random';
import { Direction, Heading, TilePosition, tileKey } from '../domain/position';
import { Ground } from '../domain/scenery';
import type { Shuffle } from '../domain/shuffle';
import { keepOrder, lowestRoll, seededRandom } from '../testing/draws';
import { collectEveryOrb, follow, pathTo } from '../testing/walk-level';
import { authoredLevels as catalog } from './catalog';
import { firstLevel } from './first';
import { fourthLevel } from './fourth';

const authoredLevels = catalog.map(({ id, create }) => ({
  name: id.value,
  create: (shuffle: Shuffle, random: Random = lowestRoll) => create(shuffle, check2dObstacles, random),
}));
const seeds = Array.from({ length: 60 }, (_, seed) => seed);
// Random orbs land elsewhere on every start, so a rule about orbs is checked over many plays.
type CreateLevel = (shuffle: Shuffle, random: Random) => ReturnType<typeof firstLevel>;
const plays = new Map<CreateLevel, readonly ReturnType<typeof firstLevel>[]>();
const everyPlayOf = (create: CreateLevel) => {
  let levels = plays.get(create);
  if (!levels) {
    levels = seeds.map((seed) => create(keepOrder, seededRandom(seed)));
    plays.set(create, levels);
  }
  return levels;
};

for (const { name, create } of authoredLevels) {
  // The gate and any boulder count as open, because she can always open the gate and move the boulder.
  test(`the ${name} level leaves no open ground cut off from where the hero starts`, () => {
    const level = create(keepOrder);
    const open = (tile: TilePosition): boolean =>
      level.scenery.isWalkable(tile) &&
      !level.stones.some((stone) => stone.position.equals(tile)) &&
      !level.door.covers(tile);
    const reached = [level.hero.position];
    const seen = new Set([tileKey(level.hero.position)]);
    for (let index = 0; index < reached.length; index++) {
      for (const direction of [Direction.Up, Direction.Down, Direction.Left, Direction.Right]) {
        const neighbor = reached[index]!.neighbor(direction);
        if (seen.has(tileKey(neighbor)) || !open(neighbor)) continue;
        seen.add(tileKey(neighbor));
        reached.push(neighbor);
      }
    }
    const { columns, rows } = level.scenery.size;
    const cutOff = Array.from({ length: columns * rows }, (_, index) =>
      TilePosition.at(index % columns, Math.floor(index / columns)),
    )
      .filter((tile) => open(tile) && !seen.has(tileKey(tile)))
      .map((tile) => `${tile.column}, ${tile.row}`);
    expect(cutOff).toEqual([]);
  });

  test(`the ${name} level starts in view, facing inward and far from the exit`, () => {
    const level = create(keepOrder);
    const start = level.hero.position;
    expect(level.hero.facing).toBe(Direction.Up);
    expect(
      level.scenery.trees.some((tree) => tree.hides(start)) || level.scenery.hides(start) || level.door.hides(start),
      'no canopy or door may cover the start',
    ).toBe(false);
    expect(
      Math.min(...level.door.footprint.map((tile) => start.row - tile.row)),
      'the exit must stay beyond the seven-row minimum game view from the entry',
    ).toBeGreaterThanOrEqual(7);
  });

  // The woodland canopy covers the open row above the woodland, so only what is drawn counts as free ground.
  test(`the ${name} level starts on visibly free ground, one tile from the bottom boundary, near where a path begins`, () => {
    const level = create(keepOrder);
    const start = level.hero.position;
    const { columns, rows } = level.scenery.size;
    const tiles = Array.from({ length: columns * rows }, (_, index) =>
      TilePosition.at(index % columns, Math.floor(index / columns)),
    );
    const covered = (tile: TilePosition): boolean =>
      level.scenery.trees.some((tree) => tree.hides(tile)) || level.scenery.hides(tile) || level.door.hides(tile);
    const visiblyOpen = (tile: TilePosition): boolean => level.scenery.isWalkable(tile) && !covered(tile);
    const ring = tiles.filter(
      (tile) => !tile.equals(start) && Math.abs(tile.column - start.column) <= 1 && Math.abs(tile.row - start.row) <= 1,
    );
    const blockedRing = ring
      .filter(
        (tile) =>
          !visiblyOpen(tile) ||
          level.stones.some((stone) => stone.position.equals(tile)) ||
          level.scenery.flowers.some((flower) => flower.position.equals(tile)),
      )
      .map((tile) => `${tile.column}, ${tile.row}`);
    expect(blockedRing, 'every tile around the start must be drawn as free open ground').toEqual([]);
    const crowded = everyPlayOf(create)
      .flatMap((play) => play.orbs.map((orb) => orb.position))
      .filter((orb) => [start, ...ring].some((tile) => tile.equals(orb)))
      .map((tile) => `${tile.column}, ${tile.row}`);
    expect(crowded, 'no orb may lie on or around the start').toEqual([]);
    const lowestVisibleRow = Math.max(...tiles.filter(visiblyOpen).map((tile) => tile.row));
    expect(lowestVisibleRow - start.row, 'one visibly free row, then the bottom boundary').toBe(1);
    const isPath = (tile: TilePosition): boolean =>
      level.scenery.size.contains(tile) && level.scenery.groundAt(tile).equals(Ground.Path);
    const pathEnds = tiles.filter(
      (tile) =>
        isPath(tile) &&
        [Direction.Up, Direction.Down, Direction.Left, Direction.Right].filter((direction) =>
          isPath(tile.neighbor(direction)),
        ).length === 1,
    );
    expect(
      Math.min(...pathEnds.map((end) => Math.max(Math.abs(end.column - start.column), Math.abs(end.row - start.row)))),
      'the start lies within two tiles of where a path ends',
    ).toBeLessThanOrEqual(2);
  });
}

test.each(authoredLevels)('every path tile of the $name level shares an edge with another path tile', ({ create }) => {
  const level = create(keepOrder);
  const isPath = (tile: TilePosition): boolean =>
    level.scenery.size.contains(tile) && level.scenery.groundAt(tile).equals(Ground.Path);
  const { columns, rows } = level.scenery.size;
  const alone = Array.from({ length: columns * rows }, (_, index) =>
    TilePosition.at(index % columns, Math.floor(index / columns)),
  )
    .filter(
      (tile) =>
        isPath(tile) &&
        ![Direction.Up, Direction.Down, Direction.Left, Direction.Right].some((direction) =>
          isPath(tile.neighbor(direction)),
        ),
    )
    .map((tile) => `${tile.column}, ${tile.row}`);
  expect(alone).toEqual([]);
});

test.each(authoredLevels)('she can walk a full loop around every fenced enclosure of the $name level', ({ create }) => {
  const level = create(keepOrder);
  const posts = [...level.scenery.fences.map((fence) => fence.position), ...level.gates.map((gate) => gate.position)];
  const blocked: string[] = [];
  for (const start of posts) {
    const group = [start];
    for (let index = 0; index < group.length; index++) {
      for (const direction of [Direction.Up, Direction.Down, Direction.Left, Direction.Right]) {
        const neighbor = group[index]!.neighbor(direction);
        if (posts.some((post) => post.equals(neighbor)) && !group.some((tile) => tile.equals(neighbor)))
          group.push(neighbor);
      }
    }
    const left = Math.min(...group.map((tile) => tile.column));
    const right = Math.max(...group.map((tile) => tile.column));
    const top = Math.min(...group.map((tile) => tile.row));
    const bottom = Math.max(...group.map((tile) => tile.row));
    if (!start.equals(TilePosition.at(left, top)) || right - left < 2 || bottom - top < 2) continue;
    for (let row = top - 1; row <= bottom + 1; row++) {
      for (let column = left - 1; column <= right + 1; column++) {
        const tile = TilePosition.at(column, row);
        const outside = row < top || row > bottom || column < left || column > right;
        if (outside && (!level.scenery.isWalkable(tile) || level.stones.some((stone) => stone.position.equals(tile))))
          blocked.push(`${column}, ${row}`);
      }
    }
  }
  expect(blocked).toEqual([]);
});

test('the first level leaves no diagonal gap between two blocking tiles that meet only at a corner', () => {
  const level = firstLevel(keepOrder, check2dObstacles, lowestRoll);
  const { columns, rows } = level.scenery.size;
  const blocking = (column: number, row: number): boolean => {
    const tile = TilePosition.at(column, row);
    return (
      !level.scenery.isWalkable(tile) ||
      level.stones.some((stone) => stone.position.equals(tile)) ||
      level.door.covers(tile)
    );
  };
  const gaps: string[] = [];
  for (let row = 0; row < rows - 1; row++) {
    for (let column = 0; column < columns - 1; column++) {
      const [topLeft, topRight, bottomLeft, bottomRight] = [
        blocking(column, row),
        blocking(column + 1, row),
        blocking(column, row + 1),
        blocking(column + 1, row + 1),
      ];
      if (topLeft === bottomRight && topRight === bottomLeft && topLeft !== topRight) gaps.push(`${column}, ${row}`);
    }
  }
  expect(gaps).toEqual([]);
});

test('the first level hides no usable item under a tree canopy', () => {
  const level = firstLevel(keepOrder, check2dObstacles, lowestRoll);
  const items = [
    ...everyPlayOf(authoredLevels[0]!.create).flatMap((play) => play.orbs.map((orb) => orb.position)),
    ...level.boulders.map((boulder) => boulder.position),
    ...(level.plate ? [level.plate] : []),
    ...level.gates.flatMap((gate) => [gate.position, gate.approach]),
  ];
  const hidden = items.filter((item) => level.scenery.trees.some((tree) => tree.hides(item)));
  expect(hidden.map((item) => `${item.column}, ${item.row}`)).toEqual([]);
});

test.each(authoredLevels)(
  'the $name level keeps every orb clearly visible, with no canopy above it or on both sides',
  ({ create }) => {
    const level = create(keepOrder);
    const canopy = (column: number, row: number): boolean => {
      const tile = TilePosition.at(column, row);
      return level.scenery.woodland.covers(tile) || level.scenery.trees.some((tree) => tree.covers(tile));
    };
    const random = everyPlayOf(create).flatMap((play) =>
      play.orbs
        .filter((orb) => !play.permanentOrbs.some((tile) => tile.equals(orb.position)))
        .map((orb) => orb.position),
    );
    const crowded = random.filter(
      ({ column, row }) =>
        canopy(column - 1, row - 1) ||
        canopy(column, row - 1) ||
        canopy(column + 1, row - 1) ||
        (canopy(column - 1, row) && canopy(column + 1, row)),
    );
    expect(crowded.map(({ column, row }) => `${column}, ${row}`)).toEqual([]);
  },
);

function canopyHides(level: ReturnType<typeof firstLevel>, tile: TilePosition): boolean {
  return level.scenery.hides(tile) || level.scenery.trees.some((tree) => tree.hides(tile));
}

test('the first level lets her reach every orb and the door without stepping on a hidden tile', () => {
  const level = firstLevel(keepOrder, check2dObstacles, lowestRoll);
  const open = (tile: TilePosition): boolean =>
    level.scenery.isWalkable(tile) &&
    !level.stones.some((stone) => stone.position.equals(tile)) &&
    !level.door.covers(tile) &&
    !canopyHides(level, tile);
  const reached = [level.hero.position];
  const seen = new Set([tileKey(level.hero.position)]);
  for (let index = 0; index < reached.length; index++) {
    for (const direction of [Direction.Up, Direction.Down, Direction.Left, Direction.Right]) {
      const neighbor = reached[index]!.neighbor(direction);
      if (seen.has(tileKey(neighbor)) || !open(neighbor)) continue;
      seen.add(tileKey(neighbor));
      reached.push(neighbor);
    }
  }
  const objectives = [
    ...everyPlayOf(authoredLevels[0]!.create).flatMap((play) => play.orbs.map((orb) => orb.position)),
    ...level.door.footprint.map((tile) => tile.neighbor(Direction.Down)),
  ];
  const cutOff = objectives.filter((tile) => !seen.has(tileKey(tile)));
  expect(cutOff.map((tile) => `${tile.column}, ${tile.row}`)).toEqual([]);
});

// Counting hidden tiles as blocking, an obstacle joined to the boundary has no loop around it on visible ground.
test('the first level lets her walk a full loop around every obstacle without stepping on a hidden tile', () => {
  const level = firstLevel(keepOrder, check2dObstacles, lowestRoll);
  const { columns, rows } = level.scenery.size;
  const inside = (tile: TilePosition): boolean => level.scenery.size.contains(tile);
  const stone = (tile: TilePosition): boolean => level.stones.some((each) => each.position.equals(tile));
  const blocking = (tile: TilePosition): boolean =>
    !inside(tile) ||
    !level.scenery.isWalkable(tile) ||
    stone(tile) ||
    level.door.covers(tile) ||
    canopyHides(level, tile);
  const obstacle = (tile: TilePosition): boolean =>
    inside(tile) &&
    (level.scenery.groundAt(tile).equals(Ground.Water) ||
      level.scenery.trees.some((tree) => tree.covers(tile)) ||
      level.scenery.fences.some((fence) => fence.position.equals(tile)) ||
      stone(tile));
  const outside = [
    ...Array.from({ length: columns + 2 }, (_, index) => [
      TilePosition.at(index - 1, -1),
      TilePosition.at(index - 1, rows),
    ]),
    ...Array.from({ length: rows }, (_, index) => [TilePosition.at(-1, index), TilePosition.at(columns, index)]),
  ].flat();
  const seen = new Set(outside.map(tileKey));
  const reached = [...outside];
  const joined: string[] = [];
  for (let index = 0; index < reached.length; index++) {
    for (const row of [-1, 0, 1]) {
      for (const column of [-1, 0, 1]) {
        const next = TilePosition.at(reached[index]!.column + column, reached[index]!.row + row);
        if (!inside(next) || seen.has(tileKey(next)) || !blocking(next)) continue;
        seen.add(tileKey(next));
        reached.push(next);
        if (obstacle(next)) joined.push(`${next.column}, ${next.row}`);
      }
    }
  }
  expect(joined).toEqual([]);
});

test.each(authoredLevels)(
  'the $name level holds three to nine orbs in every play, its permanent orbs first',
  ({ create }) => {
    const violations = everyPlayOf(create).flatMap((play, seed) => [
      ...(play.orbs.length < orbCount.fewest || play.orbs.length > orbCount.most
        ? [`seed ${seed}: ${play.orbs.length}`]
        : []),
      ...(play.permanentOrbs.every((tile, index) => play.orbs[index]!.position.equals(tile))
        ? []
        : [`seed ${seed}: order`]),
    ]);
    expect(violations).toEqual([]);
  },
);

test.each(authoredLevels)('the $name level places different orbs in a different play', ({ create }) => {
  const placements = everyPlayOf(create).map((play) =>
    play.orbs.map(({ position }) => `${position.column},${position.row}`).join(';'),
  );
  expect(new Set(placements).size).toBeGreaterThan(1);
});

test('the fourth level is finished by pushing the boulder out of the gap to the glade', () => {
  const level = fourthLevel(keepOrder, check2dObstacles, lowestRoll);
  const glade = level.permanentOrbs[0]!;
  expect(
    pathTo(level, (tile) => tile.equals(glade)),
    'the boulder must close the only way to the permanent orb',
  ).toBeUndefined();
  follow(
    level,
    pathTo(level, (tile) => tile.equals(TilePosition.at(21, 8)))!,
  );
  for (let tick = 0; tick < 20 && !level.canGrip; tick++) level.tick(Heading.of(Direction.Up));
  expect(level.canGrip).toBe(true);
  level.grip();
  for (let push = 0; push < 2; push++) {
    level.tick(Heading.of(Direction.Up));
    for (let tick = 0; tick < 16; tick++) level.tick(null);
  }
  level.release();
  const toGlade = pathTo(level, (tile) => tile.equals(glade));
  expect(toGlade, 'the permanent orb must open up once the boulder is pushed into the glade').toBeDefined();
  expect(follow(level, toGlade!).some((event) => event instanceof OrbCollected)).toBe(true);
  collectEveryOrb(level);
  level.openDoor();
  const toDoor = pathTo(level, (tile) => level.door.covers(tile));
  expect(toDoor, 'the door must stay reachable with the boulder in the glade').toBeDefined();
  expect(follow(level, toDoor!).some((event) => event instanceof LevelCompleted)).toBe(true);
});
