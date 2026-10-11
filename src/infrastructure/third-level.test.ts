import { expect, test } from 'vitest';
import { Door } from '../domain/level/door';
import { Direction, TilePosition } from '../domain/level/position';
import { keepOrder, reverseOrder, starSpotsOf } from '../test-support/star-spots';
import { thirdLevel, thirdLevelId } from './third-level';

const at = TilePosition.at;
const orchardKey = () => thirdLevel(keepOrder).keys[0]!;
const lakeKey = () => thirdLevel(keepOrder).keys[1]!;

test('the third level opens at the foot of its orchard and lake with an orchard key and a lake key', () => {
  const level = thirdLevel(keepOrder);
  expect(level.id).toBe(thirdLevelId);
  expect(level.scenery.size).toEqual({ columns: 25, rows: 25 });
  expect(level.hero.position).toEqual(at(12, 23));
  expect(level.hero.facing).toBe(Direction.Up);
  expect(level.door.equals(Door.closedAt(at(11, 2)))).toBe(true);
  expect(level.keys).toHaveLength(2);
  expect(orchardKey().position).toEqual(at(4, 12));
  expect(lakeKey().position).toEqual(at(19, 12));
});

test('the restore areas of the two keys split the map between them', () => {
  const level = thirdLevel(keepOrder);
  const red = orchardKey().restores;
  const blue = lakeKey().restores;
  expect(red.tiles).toHaveLength(347);
  expect(blue.tiles).toHaveLength(278);
  expect(red.tiles.length + blue.tiles.length).toBe(level.scenery.size.columns * level.scenery.size.rows);
  for (let row = 0; row < level.scenery.size.rows; row++) {
    for (let column = 0; column < level.scenery.size.columns; column++) {
      const tile = at(column, row);
      expect(red.covers(tile) !== blue.covers(tile), `tile ${column}, ${row} must be restored by exactly one key`).toBe(
        true,
      );
    }
  }
});

test.each([
  ['orchard', orchardKey],
  ['lake', lakeKey],
])('the %s key stands inside the area it restores', (_, keyOf) => {
  const key = keyOf();
  expect(key.restores.covers(key.position)).toBe(true);
});

test('the third level has a hint for each key that names its place and an exit sign that never does', () => {
  const level = thirdLevel(keepOrder);
  const texts = level.signposts.map((signpost) => signpost.text.value);
  expect(texts).toHaveLength(3);
  expect(texts.filter((text) => text.includes('ΜΗΛΕΩΝΑ') && !text.includes('ΛΙΜΝΗ'))).toHaveLength(1);
  expect(texts.filter((text) => text.includes('ΛΙΜΝΗ') && !text.includes('ΜΗΛΕΩΝΑ'))).toHaveLength(1);
  const [exit, ...others] = texts.filter((text) => !/ΜΗΛΕΩΝ|ΛΙΜΝ/u.test(text));
  expect(others).toEqual([]);
  expect(exit).toContain('ΔΥΟ ΚΛΕΙΔΙΑ');
});

test('the third level marks fifteen star spots and lets the shuffle choose its stars', () => {
  const spots = starSpotsOf(thirdLevel);
  expect(spots).toHaveLength(15);
  expect(spots).toEqual(
    expect.arrayContaining([
      at(1, 3),
      at(22, 3),
      at(23, 13),
      at(23, 17),
      at(1, 21),
      at(5, 4),
      at(18, 4),
      at(3, 7),
      at(1, 14),
      at(23, 8),
      at(13, 9),
      at(2, 16),
      at(7, 19),
      at(18, 20),
      at(23, 23),
    ]),
  );
  expect(thirdLevel(reverseOrder).stars.map((star) => star.position)).toEqual([...spots].reverse().slice(0, 5));
});
