import { Direction } from '../domain/level/position';

export interface KnobOffset {
  readonly x: number;
  readonly y: number;
}

// The knob glides home and overshoots by one panel pixel, so a child sees that letting go is what stopped the hero.
const returnFractions = [0.5, 0.15] as const;

export function heldOffset(direction: Direction, reach: number): KnobOffset {
  const travel = reach / (direction.isDiagonal ? Math.SQRT2 : 1);
  return { x: direction.columnStep * travel, y: direction.rowStep * travel };
}

export function steer(x: number, y: number, reach: number): { offset: KnobOffset; direction: Direction | null } {
  const distance = Math.hypot(x, y);
  const offset = distance > reach ? { x: (x / distance) * reach, y: (y / distance) * reach } : { x, y };
  // A dead zone keeps a resting thumb from walking the hero by accident.
  if (reach === 0 || distance < reach * 0.3) return { offset, direction: null };
  // Wider straight sectors suit grid movement, since a thumb aimed straight often drifts a little off the line.
  const threshold = Math.tan(Math.PI / 6);
  const horizontal =
    Math.abs(offset.x) > Math.abs(offset.y) * threshold ? (offset.x > 0 ? Direction.Right : Direction.Left) : null;
  const vertical =
    Math.abs(offset.y) > Math.abs(offset.x) * threshold ? (offset.y > 0 ? Direction.Down : Direction.Up) : null;
  return { offset, direction: Direction.combine(horizontal, vertical) };
}

// Snapping toward the center keeps the knob on whole panel pixels without pushing it past its reach.
export function snapTowardCenter(value: number, pixel: number): number {
  return pixel > 0 ? Math.trunc(value / pixel) * pixel : 0;
}

export function returnOffset(released: KnobOffset, frame: number, pixel: number): KnobOffset | null {
  const fraction = returnFractions[frame];
  if (fraction !== undefined) return { x: released.x * fraction, y: released.y * fraction };
  if (frame === returnFractions.length) return { x: -Math.sign(released.x) * pixel, y: -Math.sign(released.y) * pixel };
  return null;
}
