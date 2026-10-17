import { expect, test } from 'vitest';
import { Direction, Heading } from '../../level';
import { litArrows } from './joystick';

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
