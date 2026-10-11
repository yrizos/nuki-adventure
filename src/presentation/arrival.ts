import { ditherThreshold } from './ordered-dither';

const moteStarts = [
  [4, 2],
  [28, -2],
  [16, -8],
] as const;
const moteEnds = [
  [8, 8],
  [24, 6],
  [16, 2],
] as const;

// Each row needs four more steps than the row below it, so the dither feathers the rising edge across about two rows.
export function revealed(age: number, spriteX: number, spriteY: number): boolean {
  return 4 * (31 - spriteY) + 2 * ditherThreshold(spriteX, spriteY) < 24 * (age - 2);
}

export function arrivalMotes(age: number): readonly { readonly x: number; readonly y: number }[] {
  if (age >= 12) return [];
  return moteEnds.map(([endX, endY], index) => {
    if (age <= 2) {
      const [startX, startY] = moteStarts[index]!;
      return {
        x: Math.round(startX + ((endX - startX) * age) / 2),
        y: Math.round(startY + ((endY - startY) * age) / 2),
      };
    }
    if (age <= 8) return { x: endX + ((age + index) % 2), y: endY };
    return { x: endX, y: endY - 3 * (age - 8) };
  });
}
