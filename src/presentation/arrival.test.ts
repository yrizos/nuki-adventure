import { expect, test } from 'vitest';
import { arrivalMotes } from './arrival';

const center = { x: 16, y: 17 };
const distance = ({ x, y }: { x: number; y: number }): number => Math.hypot(x - center.x, y - center.y);

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
