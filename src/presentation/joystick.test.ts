import { expect, test } from 'vitest';
import { Direction } from '../domain/level/position';
import { heldOffset, returnOffset, snapTowardCenter, steer } from './joystick';

test('a thumb inside the dead zone or on a joystick without reach steers nowhere', () => {
  expect(steer(29, 0, 100).direction).toBeNull();
  expect(steer(30, 0, 100).direction).toBe(Direction.Right);
  expect(steer(5, 5, 0)).toEqual({ offset: { x: 0, y: 0 }, direction: null });
});

test('straight directions cover sixty degrees and diagonals the thirty degrees between them', () => {
  const at = (degrees: number): Direction | null =>
    steer(Math.cos((degrees * Math.PI) / 180) * 50, Math.sin((degrees * Math.PI) / 180) * 50, 100).direction;
  expect(at(0)).toBe(Direction.Right);
  expect(at(29)).toBe(Direction.Right);
  expect(at(31)).toBe(Direction.DownRight);
  expect(at(59)).toBe(Direction.DownRight);
  expect(at(61)).toBe(Direction.Down);
  expect(at(-90)).toBe(Direction.Up);
  expect(at(180)).toBe(Direction.Left);
});

test('a thumb past the rim keeps the knob at the edge of its reach', () => {
  expect(steer(300, 400, 50).offset).toEqual({ x: 30, y: 40 });
  expect(steer(3, 4, 50).offset).toEqual({ x: 3, y: 4 });
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
