export interface Point {
  readonly x: number;
  readonly y: number;
}

export const between = (first: Point, second: Point): number => Math.hypot(first.x - second.x, first.y - second.y);
