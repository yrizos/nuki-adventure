import { expect, test } from 'vitest';
import { frogArt, frogFrameLength, frogRipple } from '../../graphics/sprite-library';
import { type Frog, frogDiveLength, frogLeapLength } from '../dressing/world-dressing';
import { frogPlace } from './frog-motion';

const left = { x: 20, y: 30 };
const right = { x: 50, y: 30 };
const rest = 300;
// Rests, leaps right, rests croaking, then dives back left.
const frog: Frog = {
  cycle: 2 * rest + frogLeapLength + frogDiveLength,
  phase: 0,
  legs: [
    { from: left, to: right, facing: 'right', rest, croaks: false, dive: false },
    { from: right, to: left, facing: 'left', rest, croaks: true, dive: true },
  ],
};
const leapStart = rest;
const secondRest = leapStart + frogLeapLength;
const diveStart = secondRest + rest;
const rippleLength = frogRipple.length * frogFrameLength;

test('a resting frog sits on its pad facing its way and blinks for one beat', () => {
  const sitting = frogPlace(frog, frogFrameLength)!;
  expect(sitting).toMatchObject({ ...left, art: frogArt.right.sit[0] });
  expect(frogPlace(frog, 0)!.art).toBe(frogArt.right.sit.at(-1));
});

test('a frog that croaks does it in the middle of its rest and a quiet one never does', () => {
  const croaking = frogPlace(frog, secondRest + rest / 2)!;
  expect(frogArt.left.croak).toContain(croaking.art);
  expect(frogArt.right.croak).not.toContain(frogPlace(frog, rest / 2)!.art);
});

test('a leaping frog arcs to the next pad facing the way it jumps', () => {
  expect(frogPlace(frog, leapStart)).toMatchObject({ ...left });
  const middle = frogPlace(frog, leapStart + frogLeapLength / 2)!;
  expect(middle).toMatchObject({ x: 35, y: 24 });
  expect(frogArt.right.leap).toContain(middle.art);
  const leaps = frogArt.right.leap;
  expect(middle.art).toBe(leaps[Math.floor(0.5 * leaps.length)]);
});

test('a diving frog leaves a ripple where it goes under, is hidden and surfaces in a ripple', () => {
  const under = frogPlace(frog, diveStart)!;
  expect(under).toMatchObject({ ...right, art: frogRipple[0] });
  const surfaced = frogPlace(frog, diveStart + frogDiveLength - 1)!;
  expect(surfaced).toMatchObject({ ...left });
  expect(frogRipple).toContain(surfaced.art);
  const hidden = Array.from({ length: frogDiveLength }, (_, since) => frogPlace(frog, diveStart + since)).filter(
    (place) => place === undefined,
  );
  expect(hidden).toHaveLength(frogDiveLength - 2 * rippleLength);
});

test('a frog repeats the same cycle and a phase starts it part-way in', () => {
  for (const frame of [0, 5, secondRest + 10, diveStart + 3]) {
    expect(frogPlace(frog, frame + frog.cycle)).toEqual(frogPlace(frog, frame));
  }
  const shifted = { ...frog, phase: leapStart };
  expect(frogPlace(shifted, 0)).toEqual(frogPlace(frog, leapStart));
});

test('a frog whose cycle outlasts its legs is gone for the rest of it', () => {
  const patient = { ...frog, cycle: frog.cycle + 50 };
  expect(frogPlace(patient, frog.cycle + 10)).toBeUndefined();
});
