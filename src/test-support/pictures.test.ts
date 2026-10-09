import { expect, test } from 'vitest';
import { Picture } from '../presentation/picture';
import { pixelDifference } from './pictures';

function picture(width = 3, height = 2): Picture {
  const created = new Picture(width, height);
  created.pixels.forEach((_, index) => (created.pixels[index] = index % 251));
  return created;
}

test('identical pictures have no difference', () => {
  expect(pixelDifference(picture(), picture())).toBeUndefined();
});

test('a changed color byte is reported with its pixel, channel and values', () => {
  const changed = picture();
  changed.pixels[(1 * 3 + 2) * 4 + 1] = 0;
  expect(pixelDifference(changed, picture())).toBe(`pixel 2, 1 channel 1: 0 ≠ ${(1 * 3 + 2) * 4 + 1}`);
});

test('a change to alpha alone is reported', () => {
  const changed = picture();
  changed.pixels[3] = 0;
  expect(pixelDifference(changed, picture())).toBe('pixel 0, 0 channel 3: 0 ≠ 3');
});

test('pictures of different sizes are reported by their sizes', () => {
  expect(pixelDifference(picture(3, 2), picture(2, 3))).toBe('size 3 x 2 ≠ 2 x 3');
});
