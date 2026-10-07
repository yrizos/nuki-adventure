import { expect, test } from 'vitest';
import { StarCount } from '../shared/star-count';
import { Playthrough, PlayTime } from './playthrough';

const playthrough = (frames: number, collectedStars: number, starCount = 5): Playthrough =>
  Playthrough.of(PlayTime.ofFrames(frames), StarCount.of(collectedStars), StarCount.of(starCount));

test('accepts a play time of zero frames', () => {
  expect(PlayTime.ofFrames(0).frames).toBe(0);
});

test('may collect every star the level holds', () => {
  expect(playthrough(10, 5, 5).collectedStars).toEqual(StarCount.of(5));
});

test('is equal only with the same time, collected stars and star count', () => {
  expect(playthrough(10, 3).equals(playthrough(10, 3))).toBe(true);
  expect(playthrough(10, 3).equals(playthrough(11, 3))).toBe(false);
  expect(playthrough(10, 3).equals(playthrough(10, 2))).toBe(false);
  expect(playthrough(10, 3).equals(playthrough(10, 3, 6))).toBe(false);
});
