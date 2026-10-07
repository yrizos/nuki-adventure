import { Direction, Heading } from '../domain/level/position';

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

// Starting needs a firmer push than stopping, so a thumb resting near the edge of the dead zone does not start and stop the hero.
const startsAt = 0.3;
const stopsBelow = 0.25;
// An arrow lights once the thumb leans more than 22.5 degrees its way, which splits the ring into eight equal parts.
const lean = Math.sin(Math.PI / 8);

export function thumbHeading(x: number, y: number, travel: number, moving: boolean): Heading | null {
  if (travel < (moving ? stopsBelow : startsAt) || (x === 0 && y === 0)) return null;
  return Heading.toward(x, y);
}

export function litArrows(heading: Heading): Direction | null {
  const horizontal = heading.x > lean ? Direction.Right : heading.x < -lean ? Direction.Left : null;
  const vertical = heading.y > lean ? Direction.Down : heading.y < -lean ? Direction.Up : null;
  return Direction.combine(horizontal, vertical);
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
