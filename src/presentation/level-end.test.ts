import { expect, test } from 'vitest';
import { continueHeight } from './art/panel';
import { continueTop, levelEndArt, levelEndText, playTime } from './level-end';
import { sprite } from './picture';

test.each([
  [0, '0:00'],
  [59, '0:00'],
  [60, '0:01'],
  [60 * 65, '1:05'],
  [60 * 60 * 120, '120:00'],
])('shows %s frames as %s', (frames, shown) => {
  expect(playTime(frames)).toBe(shown);
});

test('reads the time and the stars out for screen readers', () => {
  expect(levelEndText({ frames: 60 * 83, collectedStars: 3, starCount: 5 })).toBe('ΜΠΡΑΒΟ! ΧΡΟΝΟΣ 1:23. ΑΣΤΕΡΙΑ 3/5.');
});

test.each([
  [60 * 83, 0, 1],
  [60 * 83, 3, 5],
  [60 * 60 * 120, 12, 40],
])('builds from palette codes for %s frames and %s of %s stars, inside the narrowest column', (frames, collectedStars, starCount) => {
  const art = levelEndArt({ frames, collectedStars, starCount });
  expect(() => sprite(art)).not.toThrow();
  expect(art.rows[0]!.length).toBeLessThanOrEqual(180 - 32);
  expect(art.rows.length).toBeGreaterThan(continueTop + continueHeight);
});
