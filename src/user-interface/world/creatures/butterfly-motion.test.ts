import { expect, test } from 'vitest';
import type { Butterfly } from '../dressing/butterfly-routes';
import { butterflyPlace } from './butterfly-motion';

const there = { x: 10, y: 20 };
const away = { x: 50, y: 20 };
// Rests 30 frames and flies 40, then rests 10 and flies 20 back, so one cycle is 100 frames.
const butterfly: Butterfly = {
  frames: [],
  cycle: 100,
  phase: 0,
  legs: [
    { from: there, to: away, rest: 30, flight: 40 },
    { from: away, to: there, rest: 10, flight: 20 },
  ],
};

test('a butterfly rests on its first stop before it takes off', () => {
  expect(butterflyPlace(butterfly, 0)).toEqual({ ...there, flying: false });
  expect(butterflyPlace(butterfly, 29)).toEqual({ ...there, flying: false });
});

test('a butterfly flies from one stop to the next and rises over the middle of the flight', () => {
  expect(butterflyPlace(butterfly, 30)).toEqual({ ...there, flying: true });
  const middle = butterflyPlace(butterfly, 50);
  expect(middle).toMatchObject({ x: 30, y: 14, flying: true });
});

test('a butterfly rests again on the stop where it landed', () => {
  expect(butterflyPlace(butterfly, 70)).toEqual({ ...away, flying: false });
  expect(butterflyPlace(butterfly, 79)).toEqual({ ...away, flying: false });
});

test('a butterfly flies back and repeats the same cycle', () => {
  expect(butterflyPlace(butterfly, 85).flying).toBe(true);
  for (let frame = 0; frame < butterfly.cycle; frame++) {
    expect(butterflyPlace(butterfly, frame + butterfly.cycle)).toEqual(butterflyPlace(butterfly, frame));
  }
});

test('a phase starts a butterfly part-way into its cycle', () => {
  const shifted = { ...butterfly, phase: 30 };
  expect(butterflyPlace(shifted, 0)).toEqual(butterflyPlace(butterfly, 30));
  expect(butterflyPlace(shifted, 40)).toEqual(butterflyPlace(butterfly, 70));
});

test('a butterfly only ever stands on whole pixels', () => {
  for (let frame = 0; frame < butterfly.cycle; frame++) {
    const { x, y } = butterflyPlace(butterfly, frame);
    expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
  }
});

test('a butterfly whose cycle outlasts its legs waits on its first stop', () => {
  const patient = { ...butterfly, cycle: 150 };
  expect(butterflyPlace(patient, 120)).toEqual({ ...there, flying: false });
});
