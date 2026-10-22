import { expect, test } from 'vitest';
import { between } from './point';

test('the distance between two points is the straight line from one to the other', () => {
  expect(between({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  expect(between({ x: 7, y: 7 }, { x: 7, y: 7 })).toBe(0);
});
