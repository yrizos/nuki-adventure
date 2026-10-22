import { Ground, type LevelView, type Scenery, TilePosition } from '../../../level';
import type { Art } from '../../graphics/art';
import { grassArt, pathArt, terrainArt, treeArt, undergrowthArt, waterArt } from '../../graphics/sprite-library';
import { clamp, tileSize } from '../world-geometry';
import { propVariants } from './prop-variants';

export interface GroundTile {
  readonly x: number;
  readonly y: number;
  readonly frames: readonly Art[];
}

export interface WoodlandTree {
  readonly base: TilePosition;
  readonly frames: readonly Art[];
}

// ponytail: fixed 8-tile margin, derive from the largest view if maps shrink below the view
const woodlandMargin = 8;

// A tree starts on every woodland tile, because canopies placed two tiles apart leave grass showing where their rounded edges meet.
export function woodlandTrees(scenery: Scenery): WoodlandTree[] {
  if (scenery.woodland.tiles.length === 0) return [];
  const { columns, rows } = scenery.size;
  const wooded = (column: number, row: number): boolean =>
    column < 0 || row < 0 || column >= columns || row >= rows || scenery.woodland.covers(TilePosition.at(column, row));
  const bases: TilePosition[] = [];
  for (let row = -woodlandMargin; row < rows + woodlandMargin; row++) {
    for (let column = -woodlandMargin; column < columns + woodlandMargin; column++) {
      if (!wooded(column, row) || (column > -woodlandMargin && wooded(column - 1, row))) continue;
      let end = column;
      while (end + 1 < columns + woodlandMargin && wooded(end + 1, row)) end++;
      for (let start = column; start < Math.max(end, column + 1); start++) bases.push(TilePosition.at(start, row));
    }
  }
  // propVariants derives its starting choice from the position, which must not be negative.
  const choices = propVariants(
    bases.map(({ column, row }) => [
      TilePosition.at(column + woodlandMargin, row + woodlandMargin),
      TilePosition.at(column + woodlandMargin + 1, row + woodlandMargin),
    ]),
    treeArt.length,
  );
  return bases.map((base, index) => ({ base, frames: treeVersion(choices[index]!, base) }));
}

// The shape keeps touching trees apart, and the tile hash picks a version within it so the subtle versions follow no visible pattern.
export function treeVersion(shape: number, base: TilePosition): readonly Art[] {
  const versions = treeArt[shape]!;
  return versions[tileHash(base.column, base.row) % versions.length]!;
}

export interface Undergrowth {
  readonly position: TilePosition;
  readonly art: Art;
}

// Mixes a tile position into a well-spread unsigned integer, so choices made from it follow no visible row, column or diagonal.
function tileHash(column: number, row: number): number {
  let hash = Math.imul(column, 374761393) + Math.imul(row, 668265263);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return (hash ^ (hash >>> 16)) >>> 0;
}

// Ferns and shrubs soften the woodland edge on clearing grass. The tile hash keeps about one edge tile in five, so the plants stay sparse and the edge never reads as an even band. The ring around the hero start stays bare.
export function undergrowth(level: LevelView): Undergrowth[] {
  const { scenery } = level;
  if (scenery.woodland.tiles.length === 0) return [];
  const { columns, rows } = scenery.size;
  const wooded = (column: number, row: number): boolean =>
    column < 0 || row < 0 || column >= columns || row >= rows || scenery.woodland.covers(TilePosition.at(column, row));
  const start = level.hero.position;
  const taken = [
    ...scenery.flowers.map((flower) => flower.position),
    ...level.stones.map((stone) => stone.position),
    ...level.orbs.map((orb) => orb.position),
    ...(level.plate ? [level.plate] : []),
  ];
  const positions: TilePosition[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const position = TilePosition.at(column, row);
      if (
        tileHash(column, row) % 5 !== 0 ||
        !scenery.groundAt(position).equals(Ground.Grass) ||
        !scenery.isWalkable(position) ||
        level.door.covers(position) ||
        level.gates.some((gate) => gate.covers(position)) ||
        taken.some((other) => other.equals(position)) ||
        (Math.abs(column - start.column) <= 1 && Math.abs(row - start.row) <= 1)
      )
        continue;
      const touches = [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => wooded(column + dx, row + dy)));
      if (touches) positions.push(position);
    }
  }
  return propVariants(
    positions.map((position) => [position]),
    undergrowthArt.length,
  ).map((choice, index) => ({ position: positions[index]!, art: undergrowthArt[choice]! }));
}

// The ground is drawn half a tile off the level grid so that each drawn tile sees four level tiles at its corners, which keeps every transition inside one 16 tile set.
export function groundTiles(scenery: Scenery): GroundTile[] {
  const { columns, rows } = scenery.size;
  const at = (column: number, row: number): Ground =>
    scenery.groundAt(TilePosition.at(clamp(column, 0, columns - 1), clamp(row, 0, rows - 1)));
  const tiles: GroundTile[] = [];
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const corners = [at(column - 1, row - 1), at(column, row - 1), at(column - 1, row), at(column, row)];
      const variant = (column * 5 + row * 3 + ((column * row) % 2)) % 3;
      const mask = (ground: Ground): number =>
        corners.reduce((bits, corner) => (bits << 1) | (corner.equals(ground) ? 1 : 0), 0);
      let frames: readonly Art[] | undefined;
      if (mask(Ground.Grass) === 15) frames = [grassArt[variant]!];
      else if (mask(Ground.Path) === 15) frames = [pathArt[variant]!];
      else if (mask(Ground.Water) === 15) frames = waterArt[variant];
      else
        frames =
          terrainArt[
            corners
              .map((ground) => (ground.equals(Ground.Water) ? 'w' : ground.equals(Ground.Path) ? 'p' : 'g'))
              .join('')
          ];
      if (!frames) throw new RangeError(`No ground art for ${column}, ${row}`);
      tiles.push({ x: column * tileSize - tileSize / 2, y: row * tileSize - tileSize / 2, frames });
    }
  }
  return tiles;
}
