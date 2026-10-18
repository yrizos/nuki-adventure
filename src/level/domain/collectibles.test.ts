import { expect, test } from 'vitest';
import { Area, Orb } from './collectibles';
import { TilePosition } from './position';
import { LevelSize } from './scenery';

const at = TilePosition.at;
const size = LevelSize.of(30, 30);

test('rejects an area without tiles', () => {
  expect(() => Area.of([])).toThrow(RangeError);
});

test('a whole area covers every tile of the level', () => {
  const whole = Area.whole(LevelSize.of(3, 2));
  expect(whole.tiles).toHaveLength(6);
  expect(whole.covers(at(2, 1))).toBe(true);
});

test('an orb restores every tile whose center lies within its radius, and none outside the level', () => {
  const orb = Orb.at(at(1, 10), 4, size);
  const covered = (column: number, row: number) => orb.restores.covers(at(column, row));
  expect([covered(5, 10), covered(4, 12), covered(1, 6), covered(4, 13), covered(6, 10)]).toEqual([
    true,
    true,
    true,
    false,
    false,
  ]);
  expect(orb.restores.tiles.every((tile) => size.contains(tile))).toBe(true);
});

test.each([3, 7, 4.5])('rejects an orb radius of %s', (radius) => {
  expect(() => Orb.at(at(10, 10), radius, size)).toThrow(RangeError);
});

test('two orbs touch unless three faded tiles lie between their circles', () => {
  const orb = Orb.at(at(4, 4), 4, size);
  expect(orb.touches(Orb.at(at(15, 4), 4, size))).toBe(true);
  expect(orb.touches(Orb.at(at(16, 4), 4, size))).toBe(false);
  expect(orb.touches(Orb.at(at(14, 14), 4, size))).toBe(false);
});
