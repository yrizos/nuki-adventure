import { expect, test } from 'vitest';
import { Door } from './door';
import { Outline } from './obstacles';
import { TilePosition, WorldPosition } from './position';

const at = TilePosition.at;

test('covers exactly three tiles from its left tile rightward', () => {
  const door = Door.closedAt(at(2, 2));
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 6; column++) {
      expect(door.covers(at(column, row))).toBe(row === 2 && column >= 2 && column <= 4);
    }
  }
});

test('blocks its whole footprint', () => {
  expect(Door.closedAt(at(2, 2)).obstacle).toEqual(Outline.box(WorldPosition.at(112, 80), 96, 32));
});

test('starts closed and opens in place', () => {
  const closed = Door.closedAt(at(2, 2));
  const opened = closed.opened();
  expect(closed.isOpen).toBe(false);
  expect(opened.isOpen).toBe(true);
  expect(opened.left).toEqual(at(2, 2));
});

test('is equal only with the same position and state', () => {
  expect(Door.closedAt(at(2, 2)).equals(Door.closedAt(at(2, 2)))).toBe(true);
  expect(Door.closedAt(at(2, 2)).equals(Door.closedAt(at(3, 2)))).toBe(false);
  expect(Door.closedAt(at(2, 2)).equals(Door.closedAt(at(2, 2)).opened())).toBe(false);
});
