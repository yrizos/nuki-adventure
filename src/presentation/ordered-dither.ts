const bayer = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export const ditherSteps = bayer.length * bayer.length;

export function ditherThreshold(x: number, y: number): number {
  return bayer[y & 3]![x & 3]!;
}
