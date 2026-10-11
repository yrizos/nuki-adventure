import { expect, test } from 'vitest';
import { LevelCompleted, KeyCollected } from '../domain/level/level-events';
import { Direction } from '../domain/level/position';
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
}

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
