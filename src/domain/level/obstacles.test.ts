import { expect, test } from 'vitest';
import { Outline, wholeTile } from './obstacles';
import { TilePosition, WorldPosition } from './position';

const center = WorldPosition.at(16, 16);

test.each([
  [0, 8],
  [8, 0],
  [-1, 8],
  [8, Number.NaN],
  [Number.POSITIVE_INFINITY, 8],
])('rejects a %s × %s outline', (width, height) => {
  expect(() => Outline.box(center, width, height)).toThrow(RangeError);
  expect(() => Outline.oval(center, width, height)).toThrow(RangeError);
});

test('spans edges measured within a tile', () => {
  expect(Outline.spanning(TilePosition.at(1, 2), 4, 8, 20, 32)).toEqual(Outline.box(WorldPosition.at(44, 84), 16, 24));
});

test('fills a whole tile', () => {
  expect(wholeTile(TilePosition.at(1, 2))).toEqual(Outline.box(WorldPosition.at(48, 80), 32, 32));
});

test('keeps its form and size when placed elsewhere', () => {
  const elsewhere = WorldPosition.at(40, 50);
  expect(Outline.oval(center, 18, 12).at(elsewhere)).toEqual(Outline.oval(elsewhere, 18, 12));
});

test('is equal only with the same form, center and size', () => {
  const box = Outline.box(center, 18, 12);
  expect(box.equals(Outline.box(center, 18, 12))).toBe(true);
  expect(box.equals(Outline.oval(center, 18, 12))).toBe(false);
  expect(box.equals(Outline.box(WorldPosition.at(17, 16), 18, 12))).toBe(false);
  expect(box.equals(Outline.box(center, 12, 18))).toBe(false);
});
