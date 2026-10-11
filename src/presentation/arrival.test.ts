import { expect, test } from 'vitest';
import { arrivalMotes, revealed, risingEdge, shadowShown } from './arrival';

const shown = (age: number): number => {
  let count = 0;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (revealed(age, x, y)) count++;
  return count;
};
const highestShown = (age: number): number => {
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (revealed(age, x, y)) return y;
  return 32;
};
const center = { x: 16, y: 17 };
const distance = ({ x, y }: { x: number; y: number }): number => Math.hypot(x - center.x, y - center.y);

test.each([0, 8, 15])('nothing is revealed and no shadow is shown at age %i', (age) => {
  expect(shown(age)).toBe(0);
  expect(shadowShown(age)).toBe(false);
  expect(risingEdge(age)).toBeUndefined();
});

test('the reveal rises from the feet to the top of the head through ages 16 to 39', () => {
  expect(shadowShown(16)).toBe(true);
  expect(highestShown(16)).toBeGreaterThanOrEqual(30);
  for (let age = 17; age <= 38; age++) {
    expect(shown(age)).toBeGreaterThan(shown(age - 1));
    expect(highestShown(age)).toBeLessThanOrEqual(highestShown(age - 1));
  }
  expect(shown(37)).toBeLessThan(32 * 32);
});

test.each([39, 40, 47, 48])('every pixel is revealed at age %i', (age) => {
  expect(shown(age)).toBe(32 * 32);
});

test('the rising edge climbs inside the dithered band and stops with the reveal', () => {
  let previous = 32;
  for (let age = 16; age <= 37; age++) {
    const edge = risingEdge(age)!;
    expect(edge).toBeLessThanOrEqual(previous);
    expect(edge).toBeGreaterThanOrEqual(highestShown(age));
    previous = edge;
  }
  for (const age of [38, 39, 40]) expect(risingEdge(age)).toBeUndefined();
});

test('eight motes with two trail positions spiral inward from about 20 pixels through age 15', () => {
  expect(arrivalMotes(0)).toHaveLength(8);
  expect(arrivalMotes(1)).toHaveLength(16);
  expect(arrivalMotes(2)).toHaveLength(24);
  for (const mote of arrivalMotes(0)) expect(Math.abs(distance(mote) - 20)).toBeLessThanOrEqual(1);
  for (const mote of arrivalMotes(15).filter((_, index) => index % 3 === 0))
    expect(distance(mote)).toBeLessThanOrEqual(12);
  const heads = (age: number) => arrivalMotes(age).filter((_, index) => index % 3 === 0);
  expect(heads(4)).not.toEqual(heads(5));
  for (let age = 1; age <= 15; age++)
    expect(Math.max(...heads(age).map(distance))).toBeLessThanOrEqual(Math.max(...heads(age - 1).map(distance)) + 0.5);
});

test('each mote trails its own previous two positions', () => {
  const heads = (age: number) => arrivalMotes(age).filter((_, index) => index % 3 === 0);
  const trails = arrivalMotes(20);
  heads(20).forEach((_, mote) => {
    expect(trails[mote * 3 + 1]).toEqual(heads(19)[mote]);
    expect(trails[mote * 3 + 2]).toEqual(heads(18)[mote]);
  });
});

test('motes circle her during the reveal and rise and spread from age 40', () => {
  const heads = (age: number) => arrivalMotes(age).filter((_, index) => index % 3 === 0);
  for (let age = 16; age <= 39; age++)
    for (const mote of heads(age)) expect(Math.abs(distance(mote) - 11)).toBeLessThanOrEqual(1);
  expect(heads(16)).not.toEqual(heads(24));
  for (let age = 40; age <= 47; age++) {
    heads(age).forEach((mote, index) => {
      const before = heads(age - 1)[index]!;
      expect(mote.y).toBeLessThan(before.y);
      expect(Math.abs(mote.x - center.x)).toBeGreaterThanOrEqual(Math.abs(before.x - center.x));
    });
  }
  expect(arrivalMotes(48)).toEqual([]);
});
