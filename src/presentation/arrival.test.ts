import { expect, test } from 'vitest';
import { arrivalMotes, revealed } from './arrival';

const shown = (age: number): number => {
  let count = 0;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (revealed(age, x, y)) count++;
  return count;
};
const shownInRows = (age: number, from: number, to: number): number => {
  let count = 0;
  for (let y = from; y < to; y++) for (let x = 0; x < 32; x++) if (revealed(age, x, y)) count++;
  return count;
};

test.each([0, 1, 2])('nothing is revealed at age %i', (age) => {
  expect(shown(age)).toBe(0);
});

test('the reveal grows from the feet through ages 3 to 8', () => {
  for (let age = 3; age <= 8; age++) {
    expect(shown(age)).toBeGreaterThan(shown(age - 1));
    expect(shown(age)).toBeLessThan(32 * 32);
    expect(shownInRows(age, 16, 32)).toBeGreaterThan(shownInRows(age, 0, 16));
  }
  expect(shownInRows(3, 0, 26)).toBe(0);
});

test.each([9, 10, 11])('every pixel is revealed at age %i', (age) => {
  expect(shown(age)).toBe(32 * 32);
});

test('motes converge through age 2, sway in place through age 8 and rise until age 11', () => {
  expect(arrivalMotes(0)).toEqual([
    { x: 4, y: 2 },
    { x: 28, y: -2 },
    { x: 16, y: -8 },
  ]);
  expect(arrivalMotes(1)).toEqual([
    { x: 6, y: 5 },
    { x: 26, y: 2 },
    { x: 16, y: -3 },
  ]);
  const settled = [
    { x: 8, y: 8 },
    { x: 24, y: 6 },
    { x: 16, y: 2 },
  ];
  expect(arrivalMotes(2)).toEqual(settled);
  for (let age = 3; age <= 8; age++) {
    arrivalMotes(age).forEach((mote, index) => {
      expect(mote.y).toBe(settled[index]!.y);
      expect(Math.abs(mote.x - settled[index]!.x)).toBeLessThanOrEqual(1);
    });
  }
  expect(arrivalMotes(3).map(({ x }) => x)).not.toEqual(arrivalMotes(4).map(({ x }) => x));
  for (let age = 9; age <= 11; age++) {
    arrivalMotes(age).forEach((mote, index) => {
      expect(mote).toEqual({ x: settled[index]!.x, y: settled[index]!.y - 3 * (age - 8) });
    });
  }
  expect(arrivalMotes(12)).toEqual([]);
});
