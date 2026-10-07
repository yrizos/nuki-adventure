import { expect, test } from 'vitest';
import { Direction, Heading } from '../domain/level/position';
import { heldOffset, litArrows, returnOffset, snapTowardCenter, thumbHeading } from './joystick';

test('a thumb starts the hero at thirty percent of its travel and keeps her going down to twenty five', () => {
  expect(thumbHeading(1, 0, 0.29, false)).toBeNull();
  expect(thumbHeading(1, 0, 0.3, false)).toEqual(Heading.toward(1, 0));
  expect(thumbHeading(1, 0, 0.26, true)).toEqual(Heading.toward(1, 0));
  expect(thumbHeading(1, 0, 0.24, true)).toBeNull();
  expect(thumbHeading(0, 0, 1, true)).toBeNull();
});

test('arrows light once the heading leans more than 22.5 degrees their way', () => {
  const at = (degrees: number): Direction | null =>
    litArrows(Heading.toward(Math.cos((degrees * Math.PI) / 180), Math.sin((degrees * Math.PI) / 180)));
  expect(at(0)).toBe(Direction.Right);
  expect(at(22)).toBe(Direction.Right);
  expect(at(23)).toBe(Direction.DownRight);
  expect(at(67)).toBe(Direction.DownRight);
  expect(at(68)).toBe(Direction.Down);
  expect(at(-90)).toBe(Direction.Up);
  expect(at(180)).toBe(Direction.Left);
});

test('held arrows push the knob to its reach, shortened on diagonals to stay inside the ring', () => {
  expect(heldOffset(Direction.Left, 40)).toEqual({ x: -40, y: 0 });
  const diagonal = heldOffset(Direction.UpRight, 40);
  expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(40);
});

test('snapping moves toward the center onto whole panel pixels', () => {
  expect(snapTowardCenter(7.9, 2)).toBe(6);
  expect(snapTowardCenter(-7.9, 2)).toBe(-6);
  expect(snapTowardCenter(7.9, 0)).toBe(0);
});

test('a released knob returns to half, then fifteen percent, then one pixel past center before stopping', () => {
  const released = { x: 40, y: -20 };
  expect(returnOffset(released, 0, 2)).toEqual({ x: 20, y: -10 });
  expect(returnOffset(released, 1, 2)).toEqual({ x: 40 * 0.15, y: -20 * 0.15 });
  expect(returnOffset(released, 2, 2)).toEqual({ x: -2, y: 2 });
  expect(returnOffset(released, 3, 2)).toBeNull();
});
