import { expect, test } from 'vitest';
import { Area, Key, KeyMaterial } from './collectibles';
import { TilePosition } from './position';

const at = TilePosition.at;

test('rejects an area without tiles', () => {
  expect(() => Area.of([])).toThrow(RangeError);
});

test('a key is gold unless made of another material', () => {
  const area = Area.of([at(0, 0)]);
  expect(Key.at(at(1, 1), area).material).toBe(KeyMaterial.Gold);
  expect(Key.at(at(1, 1), area, KeyMaterial.Silver).material).toBe(KeyMaterial.Silver);
});
