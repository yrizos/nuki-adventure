import { expect, test } from 'vitest';
import { TilePosition } from '../../../level/domain/position';
import { FlowerVariant, Ground, LevelSize, Scenery } from '../../../level/domain/scenery';
import { grassArt, treeArt } from '../../graphics/sprite-library';
import { tileSize } from '../world-geometry';
import { groundTiles, treeVersion } from './terrain';

const scenery = (ground: (column: number) => Ground): Scenery =>
  Scenery.of(
    LevelSize.of(12, 12),
    Array.from({ length: 12 }, () => Array.from({ length: 12 }, (_, column) => ground(column))),
    [],
    [],
    [],
    FlowerVariant.All,
  );

test('the ground has one more tile than the level in each direction, drawn half a tile off the grid', () => {
  const tiles = groundTiles(scenery(() => Ground.Grass));
  expect(tiles).toHaveLength(13 * 13);
  expect([tiles[0]!.x, tiles[0]!.y]).toEqual([-tileSize / 2, -tileSize / 2]);
  expect([tiles.at(-1)!.x, tiles.at(-1)!.y]).toEqual([12 * tileSize - tileSize / 2, 12 * tileSize - tileSize / 2]);
});

test('grass all around a tile draws plain grass', () => {
  for (const { frames } of groundTiles(scenery(() => Ground.Grass))) {
    expect(frames).toHaveLength(1);
    expect(grassArt).toContain(frames[0]);
  }
});

test('water all around a tile draws animated water', () => {
  const tiles = groundTiles(scenery(() => Ground.Water));
  expect(tiles.every(({ frames }) => frames.length > 1)).toBe(true);
});

test('a tile where grass meets water draws a shore, not plain grass', () => {
  const shore = groundTiles(scenery((column) => (column < 6 ? Ground.Water : Ground.Grass))).filter(
    ({ x, y }) => x === 6 * tileSize - tileSize / 2 && y === 3 * tileSize - tileSize / 2,
  );
  expect(shore).toHaveLength(1);
  expect(grassArt).not.toContain(shore[0]!.frames[0]);
});

test('the same scenery always gets the same ground', () => {
  const mixed = scenery((column) => (column % 3 === 0 ? Ground.Path : Ground.Grass));
  expect(groundTiles(mixed)).toEqual(groundTiles(mixed));
});

test('a tree version comes from the shape it was given and stays the same for a position', () => {
  const base = TilePosition.at(3, 4);
  expect(treeArt[1]).toContain(treeVersion(1, base));
  expect(treeVersion(1, base)).toBe(treeVersion(1, base));
});
