import { expect, test } from 'vitest';
import { LevelCompleted, KeyCollected } from '../domain/level/level-events';
import { Direction, Heading, TilePosition } from '../domain/level/position';
import { Ground } from '../domain/level/scenery';
import { keepOrder, reverseOrder, starSpotsOf } from '../test-support/star-spots';
import { follow, pathTo } from '../test-support/walk-level';
import { fifthLevel } from './fifth-level';
import { firstLevel } from './first-level';
import { secondLevel } from './second-level';
import { fourthLevel } from './fourth-level';
import { thirdLevel } from './third-level';

const authoredLevels = [
  { name: 'first', create: firstLevel },
  { name: 'second', create: secondLevel },
  { name: 'third', create: thirdLevel },
  { name: 'fourth', create: fourthLevel },
  { name: 'fifth', create: fifthLevel },
];

for (const { name, create } of authoredLevels) {
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

test.each(authoredLevels)('she can walk a full loop around every fenced area of the $name level', ({ create }) => {
  const level = create(keepOrder);
  const posts = [...level.scenery.fences.map((fence) => fence.position), ...(level.gate ? [level.gate.position] : [])];
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
    // Each fenced area is checked once, from its top-left post.
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

test.each(authoredLevels)('the $name level holds exactly five stars', ({ create }) => {
  expect(create(keepOrder).stars).toHaveLength(5);
});

test.each(authoredLevels)('the $name level marks at least fifteen star spots', ({ create }) => {
  expect(starSpotsOf(create).length).toBeGreaterThanOrEqual(15);
});

test.each(authoredLevels)('the $name level holds different stars under a different shuffle', ({ create }) => {
  const stars = (shuffle: typeof keepOrder) => create(shuffle).stars.map((star) => star.position);
  expect(stars(reverseOrder)).not.toEqual(stars(keepOrder));
});

test('the fourth level is finished by pushing the boulder out of the gap to the glade', () => {
  const level = fourthLevel(keepOrder);
  const key = level.keys[0]!.position;
  expect(
    pathTo(level, (tile) => tile.equals(key)),
    'the boulder must close the only way to the key',
  ).toBeUndefined();
  follow(
    level,
    pathTo(level, (tile) => tile.equals(TilePosition.at(6, 11)))!,
  );
  for (let tick = 0; tick < 20 && !level.canGrip; tick++) level.tick(Heading.of(Direction.Up));
  expect(level.canGrip).toBe(true);
  level.grip();
  for (let push = 0; push < 2; push++) {
    level.tick(Heading.of(Direction.Up));
    for (let tick = 0; tick < 16; tick++) level.tick(null);
  }
  level.release();
  const toKey = pathTo(level, (tile) => tile.equals(key));
  expect(toKey, 'the key must open up once the boulder is pushed into the glade').toBeDefined();
  expect(follow(level, toKey!).some((event) => event instanceof KeyCollected)).toBe(true);
  level.openDoor();
  const toDoor = pathTo(level, (tile) => level.door.covers(tile));
  expect(toDoor, 'the door must stay reachable with the boulder in the glade').toBeDefined();
  expect(follow(level, toDoor!).some((event) => event instanceof LevelCompleted)).toBe(true);
});
