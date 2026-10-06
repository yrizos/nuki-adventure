import type { TilePosition } from '../domain/level/position';
import type { LevelSize } from '../domain/level/scenery';
import { ditherSteps, ditherThreshold } from './ordered-dither';
import { tileSize } from './world-geometry';

const framesPerRing = 4;
const framesPerDarkening = 3;
export const closingLength = ditherSteps * framesPerDarkening;

export function restorationLength(size: LevelSize, origin: TilePosition): number {
  const { columns, rows } = size;
  const rings = Math.max(origin.column, columns - 1 - origin.column, origin.row, rows - 1 - origin.row);
  return rings * framesPerRing + ditherSteps;
}

export function isRestored(worldX: number, worldY: number, origin: TilePosition, framesSinceStart: number): boolean {
  const ring = Math.max(
    Math.abs(Math.floor(worldX / tileSize) - origin.column),
    Math.abs(Math.floor(worldY / tileSize) - origin.row),
  );
  return framesSinceStart >= ring * framesPerRing + ditherThreshold(worldX, worldY);
}

export function isDarkened(x: number, y: number, framesSinceStart: number): boolean {
  return framesSinceStart >= (ditherThreshold(x, y) + 1) * framesPerDarkening;
}
