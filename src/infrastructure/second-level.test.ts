import { expect, test } from 'vitest';
import { Door } from '../domain/level/door';
import { Direction, TilePosition } from '../domain/level/position';
import { keepOrder, reverseOrder, starSpotsOf } from '../test-support/star-spots';
import { secondLevel, secondLevelId } from './second-level';

const at = TilePosition.at;

test('the second level restores the lakeside garden with one key', () => {
  const level = secondLevel(keepOrder);
  expect(level.id).toBe(secondLevelId);
  expect(level.scenery.size).toEqual({ columns: 21, rows: 19 });
  expect(level.hero.position).toEqual(at(8, 17));
  expect(level.hero.facing).toBe(Direction.Up);
  expect(level.door.equals(Door.closedAt(at(9, 2)))).toBe(true);
  expect(level.keys.map((key) => key.position)).toEqual([at(17, 4)]);
  expect(level.keys[0]!.restores.tiles).toHaveLength(21 * 19);
  expect(level.stones.map((stone) => stone.position)).toEqual([
    at(17, 10),
    at(18, 10),
    at(2, 11),
    at(3, 11),
    at(18, 11),
    at(2, 12),
  ]);
});

test('the second level marks fifteen star spots and lets the shuffle choose its stars', () => {
  const spots = starSpotsOf(secondLevel);
  expect(spots).toHaveLength(15);
  expect(spots).toEqual(
    expect.arrayContaining([
      at(2, 3),
      at(19, 4),
      at(3, 10),
      at(2, 17),
      at(18, 17),
      at(6, 3),
      at(4, 7),
      at(12, 7),
      at(8, 9),
      at(19, 10),
      at(12, 12),
      at(1, 13),
      at(19, 13),
      at(5, 15),
      at(11, 15),
    ]),
  );
  expect(secondLevel(reverseOrder).stars.map((star) => star.position)).toEqual([...spots].reverse().slice(0, 5));
});
