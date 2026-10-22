import { expect, test } from 'vitest';
import { orbFloat, popSpeck, popSpecks } from './orb-motion';

test('an orb floats two pixels up and down over 150 frames and sways one pixel sideways over 60', () => {
  const offsets = Array.from({ length: 300 }, (_, frame) => orbFloat(frame));
  const ups = offsets.map(({ y }) => y);
  const sides = offsets.map(({ x }) => x);
  expect([Math.min(...ups), Math.max(...ups)]).toEqual([-2, 2]);
  expect([Math.min(...sides), Math.max(...sides)]).toEqual([-1, 1]);
  const jumps = offsets.filter(
    ({ x, y }, frame) =>
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      Math.abs(x - offsets[(frame + 1) % 300]!.x) > 1 ||
      Math.abs(y - offsets[(frame + 1) % 300]!.y) > 1,
  );
  expect(jumps).toEqual([]);
  for (let frame = 0; frame < 300; frame++) {
    expect(orbFloat(frame + 150).y + 0).toBe(orbFloat(frame).y + 0);
    expect(orbFloat(frame + 60).x + 0).toBe(orbFloat(frame).x + 0);
  }
});

const shown = (frame: number): number =>
  Array.from({ length: popSpecks }, (_, index) => popSpeck(index, frame)).filter((speck) => speck !== undefined).length;

test('a pop starts with every speck past the hero and spreads them around a circle', () => {
  expect(shown(0)).toBe(popSpecks);
  const first = popSpeck(0, 0)!;
  const third = popSpeck(2, 0)!;
  expect([first.x + 0, first.y + 0]).toEqual([12, 0]);
  expect([third.x + 0, third.y + 0]).toEqual([0, 12]);
});

test('specks move outward and ease to a stop', () => {
  const reach = (frame: number): number => Math.hypot(popSpeck(0, frame)!.x, popSpeck(0, frame)!.y);
  const reaches = Array.from({ length: 20 }, (_, frame) => reach(frame));
  expect(reaches.every((distance, frame) => frame === 0 || distance >= reaches[frame - 1]!)).toBe(true);
  expect(reaches.at(-1)! - reaches.at(-2)!).toBeLessThan(reaches[1]! - reaches[0]!);
});

test('specks drop out one by one until the pop is gone', () => {
  expect([shown(22), shown(30), shown(35), shown(40)]).toEqual([6, 2, 0, 0]);
});
