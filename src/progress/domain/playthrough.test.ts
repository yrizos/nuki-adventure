import { expect, test } from 'vitest';
import { PlayTime } from './playthrough';

test('accepts a play time of zero frames', () => {
  expect(PlayTime.ofFrames(0).frames).toBe(0);
});
