import type { LevelView } from '../application/level-view';
import { tileSize } from '../domain/level/position';

export { tileSize };

export const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export function heroPixels(level: LevelView): { x: number; y: number } {
  const { feet } = level.hero;
  return { x: Math.round(feet.x) - 16, y: Math.round(feet.y) - 28 };
}

export function cameraPosition(level: LevelView, width: number, height: number): { x: number; y: number } {
  const hero = heroPixels(level);
  const follow = (heroStart: number, view: number, map: number, start = 0): number => {
    // A view larger than the map cannot follow the hero, so the map is centered in it instead.
    if (view >= map - start) return Math.floor((start + map - view) / 2);
    return clamp(heroStart + tileSize / 2 - Math.floor(view / 2), start, map - view);
  };
  return {
    x: follow(hero.x, width, level.scenery.size.columns * tileSize),
    y: follow(hero.y, height, level.scenery.size.rows * tileSize, -2 * tileSize),
  };
}
