import { expect, test } from 'vitest';
import { Direction, TilePosition } from '../../level/domain/position';
import { LevelSize } from '../../level/domain/scenery';
import { type LevelView } from '../../level/application/level-view';
import { Hero } from '../../level/domain/hero';
import { cameraPosition } from './world-geometry';

const standingAt = (column: number, row: number, columns = 20, rows = 20): LevelView =>
  ({
    hero: new Hero(TilePosition.at(column, row), Direction.Down).state,
    scenery: { size: LevelSize.of(columns, rows) },
  }) as LevelView;

test('centers a map smaller than the view', () => {
  expect(cameraPosition(standingAt(1, 1, 5, 5), 224, 320)).toEqual({ x: -32, y: -112 });
});
