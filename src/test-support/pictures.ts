import type { Picture } from '../presentation/picture';

// Vitest's deep equality walks a typed array element by element through generic machinery, which dominated
// the rendering tests' run time, so whole pictures are compared with a plain loop instead.
export function pixelDifference(actual: Picture, expected: Picture): string | undefined {
  if (actual.width !== expected.width || actual.height !== expected.height)
    return `size ${actual.width} x ${actual.height} ≠ ${expected.width} x ${expected.height}`;
  const a = actual.pixels;
  const b = expected.pixels;
  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) {
      const pixel = index >> 2;
      return `pixel ${pixel % actual.width}, ${Math.floor(pixel / actual.width)} channel ${index & 3}: ${a[index]} ≠ ${b[index]}`;
    }
  }
  return undefined;
}
