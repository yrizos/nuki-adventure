import { expect, test } from 'vitest';
import type { LevelView } from '../application/level-view';
import { HeroState } from '../domain/level/hero';
import { Direction, TilePosition } from '../domain/level/position';
import { LevelSize } from '../domain/level/scenery';
import { cameraPosition } from './world-geometry';

const standingAt = (column: number, row: number, columns = 20, rows = 20): LevelView =>
  ({
    hero: HeroState.of(TilePosition.at(column, row), Direction.Down, null),
    scenery: { size: LevelSize.of(columns, rows) },
  }) as LevelView;

test('centers the hero in pixels away from the map edges', () => {
  expect(cameraPosition(standingAt(10, 10), 224, 320)).toEqual({ x: 320 + 16 - 112, y: 320 + 16 - 160 });
});

test('stops at the map edges', () => {
  expect(cameraPosition(standingAt(0, 0), 224, 320)).toEqual({ x: 0, y: 0 });
  expect(cameraPosition(standingAt(19, 19), 224, 320)).toEqual({ x: 640 - 224, y: 640 - 320 });
});

test('centers a map smaller than the view', () => {
  expect(cameraPosition(standingAt(1, 1, 5, 5), 224, 320)).toEqual({ x: -32, y: -80 });
});
