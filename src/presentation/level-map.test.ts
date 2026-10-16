import { expect, test } from 'vitest';
import { PlayLevel } from '../application/play-level';
import { Area, Key, Star } from '../domain/level/collectibles';
import { Door } from '../domain/level/door';
import { Level } from '../domain/level/level';
import { Direction, TilePosition } from '../domain/level/position';
import { Ground, LevelSize, Scenery } from '../domain/level/scenery';
import { LevelId } from '../domain/shared/level-id';
import { check2dObstacles } from '../infrastructure/check2d-obstacles';
import { InMemoryLevelRepository } from '../infrastructure/in-memory-level-repository';
import { levelMap, mapSize } from './level-map';

const id = LevelId.of('thumbnail');
const everywhere = Area.of(Array.from({ length: 64 }, (_, index) => TilePosition.at(index % 8, Math.floor(index / 8))));

function view(stars: readonly Star[]) {
  const level = Level.create({
    id,
    scenery: Scenery.of(
      LevelSize.of(8, 8),
      Array.from({ length: 8 }, () => Array<Ground>(8).fill(Ground.Path)),
      [],
      [],
    ),
    stones: [],
    stars,
    keys: [Key.at(TilePosition.at(1, 1), everywhere)],
    door: Door.closedAt(TilePosition.at(0, 0)),
    hero: { position: TilePosition.at(4, 4), facing: Direction.Up },
    obstacles: check2dObstacles,
  });
  return new PlayLevel(new InMemoryLevelRepository([level])).view(id);
}

const thumbnail = (stars: readonly Star[], colored: boolean) => [
  ...levelMap(view(stars), colored, () => 0.5).packedPixels,
];

test('fits the whole level into the map size', () => {
  const map = levelMap(view([]), false, () => 0.5);
  expect([map.width, map.height]).toEqual([mapSize, mapSize]);
});

test('leaves the stars out, because they move every time the level is built', () => {
  expect(view([Star.at(TilePosition.at(4, 3))]).stars).toHaveLength(1);
  expect(thumbnail([Star.at(TilePosition.at(4, 3))], false)).toEqual(thumbnail([], false));
});

test('draws the colored world only when asked', () => {
  expect(thumbnail([], true)).not.toEqual(thumbnail([], false));
});
