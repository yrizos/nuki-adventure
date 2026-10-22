import { expect, test } from 'vitest';
import { arc, between } from './movement';

const from = { x: 0, y: 40 };
const to = { x: 100, y: 40 };

test('an arc starts at its first point and ends at its last', () => {
  expect(arc(from, to, 0, 6)).toEqual(from);
  expect(arc(from, to, 1, 6)).toEqual(to);
});

test('an arc halfway is midway across and as high as its height', () => {
  expect(arc(from, to, 0.5, 6)).toEqual({ x: 50, y: 34 });
});

test('an arc eases off and onto a stop instead of moving at a steady speed', () => {
  expect(arc(from, to, 0.25, 0).x).toBe(16);
  expect(arc(from, to, 0.75, 0).x).toBe(84);
});

test('an arc subtracts its wobble from the height and keeps whole pixels', () => {
  expect(arc(from, to, 0, 6, 3)).toEqual({ x: 0, y: 37 });
  for (let step = 0; step <= 20; step++) {
    const place = arc(from, { x: 37, y: 11 }, step / 20, 5, 1.3);
    expect(Number.isInteger(place.x) && Number.isInteger(place.y)).toBe(true);
  }
});

test('the distance between two points is straight-line', () => {
  expect(between({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  expect(between({ x: 7, y: 7 }, { x: 7, y: 7 })).toBe(0);
});
