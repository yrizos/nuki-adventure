import { expect, test } from 'vitest';
import { LevelCompleted, KeyCollected } from '../domain/level/level-events';
import { Direction, TilePosition } from '../domain/level/position';
import { keepOrder, reverseOrder, starSpotsOf } from '../test-support/star-spots';
import { follow, pathTo } from '../test-support/walk-level';
import { firstLevel } from './first-level';
import { secondLevel } from './second-level';
import { thirdLevel } from './third-level';

const authoredLevels = [
  { name: 'first', create: firstLevel },
  { name: 'second', create: secondLevel },
  { name: 'third', create: thirdLevel },
].map((authored) => ({ ...authored, keyCount: authored.create(keepOrder).keys.length }));
const multiKeyLevels = authoredLevels.filter(({ keyCount }) => keyCount > 1);

for (const { name, create } of authoredLevels) {
  test(`the ${name} level enters at its bottom playable edge, facing inward and far from the exit`, () => {
    const level = create(keepOrder);
    const bottomPlayableRow = Math.max(
      ...Array.from({ length: level.scenery.size.rows }, (_, row) =>
        Array.from({ length: level.scenery.size.columns }, (_, column) => TilePosition.at(column, row)),
      )
        .flat()
        .filter(
          (tile) =>
            level.scenery.isWalkable(tile) &&
            !level.stones.some((stone) => stone.position.equals(tile)) &&
            !level.door.covers(tile),
        )
        .map((tile) => tile.row),
    );
    expect(level.hero.facing).toBe(Direction.Up);
    expect(level.hero.position.row, 'the entry belongs on the bottom playable edge').toBe(bottomPlayableRow);
    expect(
      Math.min(...level.door.footprint.map((tile) => level.hero.position.row - tile.row)),
      'the exit must stay beyond the seven-row minimum game view from the entry',
    ).toBeGreaterThanOrEqual(7);
  });
}

test.each(authoredLevels)('the $name level holds exactly five stars', ({ create }) => {
  expect(create(keepOrder).stars).toHaveLength(5);
});

test.each(authoredLevels)('the $name level marks fifteen star spots', ({ create }) => {
  expect(starSpotsOf(create)).toHaveLength(15);
});

test.each(authoredLevels)('the $name level holds different stars under a different shuffle', ({ create }) => {
  const stars = (shuffle: typeof keepOrder) => create(shuffle).stars.map((star) => star.position);
  expect(stars(reverseOrder)).not.toEqual(stars(keepOrder));
});

test.each(authoredLevels.slice(1).map((next, index) => ({ previous: authoredLevels[index]!, next })))(
  'the $next.name level entry aligns with the $previous.name exit after normalizing map widths',
  ({ previous, next }) => {
    const exited = previous.create(keepOrder);
    const entered = next.create(keepOrder);
    const exitCenter = exited.door.footprint.reduce((sum, tile) => sum + tile.column, 0) / exited.door.footprint.length;
    const alignedColumn = (exitCenter / (exited.scenery.size.columns - 1)) * (entered.scenery.size.columns - 1);
    expect(
      Math.abs(entered.hero.position.column - alignedColumn),
      'the entry may differ from the normalized previous exit by at most one tile',
    ).toBeLessThanOrEqual(1);
  },
);

test.each(
  multiKeyLevels.flatMap(({ name, create, keyCount }) =>
    [
      Array.from({ length: keyCount }, (_, index) => index),
      Array.from({ length: keyCount }, (_, index) => keyCount - 1 - index),
    ].map((order) => ({
      name,
      create,
      order,
      label: order.join(' then '),
    })),
  ),
)('the $name level completes at its door after its keys are collected $label', ({ create, order }) => {
  const level = create(keepOrder);
  const keys = order.map((index) => level.keys[index]!);
  for (const [collected, key] of keys.entries()) {
    const path = pathTo(level, (position) => position.equals(key.position));
    expect(path, 'the key must be reachable from where she stands').toBeDefined();
    const events = follow(level, path!).filter((event) => event instanceof KeyCollected);
    expect(
      events.map((event) => event.position),
      'walking to a key must collect only that key',
    ).toEqual([key.position]);
    expect(level.keys).toHaveLength(keys.length - collected - 1);
    expect(level.door.isOpen).toBe(false);
    if (collected < keys.length - 1) {
      expect(() => level.openDoor(), 'the door must refuse to open while a key remains').toThrow();
      expect(level.door.isOpen).toBe(false);
    }
    expect(level.isComplete).toBe(false);
  }
  level.openDoor();
  expect(level.door.isOpen, 'the last key must allow the door to open').toBe(true);
  const toDoor = pathTo(level, (position) => level.door.covers(position));
  expect(toDoor, 'the open door must be reachable').toBeDefined();
  expect(follow(level, toDoor!).some((event) => event instanceof LevelCompleted)).toBe(true);
  expect(level.isComplete).toBe(true);
});
