import type { ButterflyLeg } from '../dressing/world-dressing';

export type Point = ButterflyLeg['from'];

// Smoothstep eases each flight off and onto a stop, and the arc and flutter are whole pixels like every other motion.
export function arc(from: Point, to: Point, progress: number, height: number, wobble = 0): Point {
  const eased = progress * progress * (3 - 2 * progress);
  return {
    x: Math.round(from.x + (to.x - from.x) * eased),
    y: Math.round(from.y + (to.y - from.y) * eased - Math.sin(Math.PI * progress) * height - wobble),
  };
}

export const between = (first: Point, second: Point): number => Math.hypot(first.x - second.x, first.y - second.y);
