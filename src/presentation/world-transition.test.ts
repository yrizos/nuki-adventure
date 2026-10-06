import { expect, test } from 'vitest';
import { TilePosition } from '../domain/level/position';
import { LevelSize } from '../domain/level/scenery';
import { closingLength, isDarkened, isRestored, restorationLength } from './world-transition';

test('spreads restoration one ring of tiles every four frames until it reaches the farthest edge', () => {
  expect(restorationLength(LevelSize.of(18, 20), TilePosition.at(15, 9))).toBe(15 * 4 + 16);
  expect(isRestored(15 * 32, 9 * 32, TilePosition.at(15, 9), 0)).toBe(true);
  expect(isRestored(16 * 32, 9 * 32, TilePosition.at(15, 9), 3)).toBe(false);
  expect(isRestored(16 * 32, 9 * 32, TilePosition.at(15, 9), 4)).toBe(true);
});

test('darkens every pixel to Ink over forty-eight frames', () => {
  expect(closingLength).toBe(48);
  expect(isDarkened(0, 0, 2)).toBe(false);
  expect(isDarkened(0, 0, 3)).toBe(true);
  expect(isDarkened(0, 3, 47)).toBe(false);
  expect(isDarkened(0, 3, 48)).toBe(true);
});
