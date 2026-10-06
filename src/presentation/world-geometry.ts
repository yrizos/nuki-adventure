import type { LevelView } from '../application/level-view';
import { Direction } from '../domain/level/position';

export const tileSize = 32;

export const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export function heroPixels(level: LevelView): { x: number; y: number } {
  const { position, step } = level.hero;
  const travelled = step ? Math.round((step.framesTaken / step.duration) * tileSize) : 0;
  const direction = step?.direction ?? Direction.Down;
  return {
    x: position.column * tileSize + (step ? direction.columnStep * travelled : 0),
    y: position.row * tileSize + (step ? direction.rowStep * travelled : 0),
  };
}

export function cameraPosition(level: LevelView, width: number, height: number): { x: number; y: number } {
  const hero = heroPixels(level);
  const follow = (heroStart: number, view: number, map: number): number => {
    // A view larger than the map cannot follow the hero, so the map is centered in it instead.
    if (view >= map) return Math.floor((map - view) / 2);
    return clamp(heroStart + tileSize / 2 - Math.floor(view / 2), 0, map - view);
  };
  return {
    x: follow(hero.x, width, level.scenery.size.columns * tileSize),
    y: follow(hero.y, height, level.scenery.size.rows * tileSize),
  };
}
