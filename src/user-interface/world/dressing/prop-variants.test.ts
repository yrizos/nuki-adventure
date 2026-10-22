import { expect, test } from 'vitest';
import { TilePosition } from '../../../level/domain/position';
import { propVariants } from './prop-variants';

const at = (column: number, row: number): readonly TilePosition[] => [TilePosition.at(column, row)];

test('a lone prop starts from a choice derived from its position', () => {
  expect(propVariants([at(1, 1)], 3)).toEqual([2]);
  expect(propVariants([at(1, 1)], 3)).toEqual(propVariants([at(1, 1)], 3));
});

test('props that touch never share a choice', () => {
  expect(propVariants([at(0, 0), at(1, 0)], 3)).toEqual([0, 1]);
  expect(propVariants([at(0, 0), at(0, 1)], 3)[0]).not.toBe(propVariants([at(0, 0), at(0, 1)], 3)[1]);
});

test('choices come back in the order the props were given', () => {
  expect(propVariants([at(1, 0), at(0, 0)], 3)).toEqual([1, 0]);
});

test('props that only touch at a corner may share a choice', () => {
  expect(propVariants([at(0, 0), at(1, 1)], 1)).toEqual([0, 0]);
});

test('a prop spanning several tiles touches whatever is beside any of them', () => {
  const wide = [TilePosition.at(0, 0), TilePosition.at(1, 0)];
  const [first, second] = propVariants([wide, at(2, 0)], 3);
  expect(first).not.toBe(second);
});

test('touching props with no art left to tell them apart is an error', () => {
  expect(() => propVariants([at(0, 0), at(1, 0)], 1)).toThrow(RangeError);
});

test('no props need no choices', () => {
  expect(propVariants([], 3)).toEqual([]);
});
