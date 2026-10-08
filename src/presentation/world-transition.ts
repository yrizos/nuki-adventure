import type { Door } from '../domain/level/door';
import { Direction, type TilePosition } from '../domain/level/position';
import type { LevelSize } from '../domain/level/scenery';
import { ditherSteps, ditherThreshold } from './ordered-dither';
import { tileSize } from './world-geometry';

const framesPerTile = 4;
const pixelsPerFrame = tileSize / framesPerTile;
const framesPerDarkening = 3;
export const crestLength = 8;
export const closingLength = ditherSteps * framesPerDarkening;

// The farthest pixel is reached last, and its dither threshold and crest delay its final color further.
function settledBy(left: number, top: number, right: number, bottom: number, origin: TilePosition): number {
  const centerX = (origin.column + 0.5) * tileSize;
  const centerY = (origin.row + 0.5) * tileSize;
  const reachX = Math.max(centerX - (left + 0.5), right + 0.5 - centerX);
  const reachY = Math.max(centerY - (top + 0.5), bottom + 0.5 - centerY);
  return Math.ceil(Math.sqrt(reachX * reachX + reachY * reachY) / pixelsPerFrame) + ditherSteps + crestLength;
}

// The ground reaches half a tile past the map, so a whole tile of margin covers it, and the door art rises two tiles above the top edge.
export function restorationLength(size: LevelSize, origin: TilePosition): number {
  const { columns, rows } = size;
  return settledBy(-tileSize, -2 * tileSize, (columns + 1) * tileSize - 1, (rows + 1) * tileSize - 1, origin);
}

export function restorationCovers(tiles: readonly TilePosition[], origin: TilePosition): number {
  return Math.max(
    ...tiles.map((tile) =>
      settledBy(
        tile.column * tileSize,
        tile.row * tileSize,
        (tile.column + 1) * tileSize - 1,
        (tile.row + 1) * tileSize - 1,
        origin,
      ),
    ),
  );
}

// The door art rises two tiles above its footprint, and it reads as open only once color covers all of it.
export function doorOpeningLength(door: Door, size: LevelSize, origin: TilePosition): number {
  const tiles = door.footprint.flatMap((tile) => {
    const above = tile.neighbor(Direction.Up);
    return [tile, above, above.neighbor(Direction.Up)];
  });
  return Math.min(restorationCovers(tiles, origin), restorationLength(size, origin));
}

// Negative before the wave reaches the pixel, then the frames since it arrived, so the front and the crest share one dithered arrival time.
export function restorationAge(worldX: number, worldY: number, origin: TilePosition, framesSinceStart: number): number {
  const across = worldX + 0.5 - (origin.column + 0.5) * tileSize;
  const down = worldY + 0.5 - (origin.row + 0.5) * tileSize;
  return framesSinceStart - Math.sqrt(across * across + down * down) / pixelsPerFrame - ditherThreshold(worldX, worldY);
}

export function isRestored(worldX: number, worldY: number, origin: TilePosition, framesSinceStart: number): boolean {
  return restorationAge(worldX, worldY, origin, framesSinceStart) >= 0;
}

export function isDarkened(x: number, y: number, framesSinceStart: number): boolean {
  return framesSinceStart >= (ditherThreshold(x, y) + 1) * framesPerDarkening;
}
