import { expect, test } from 'vitest';
import { Area, Key, Star } from '../../level/domain/collectibles';
import { Direction, TilePosition } from '../../level/domain/position';
import { Door } from '../../level/domain/door';
import { Ground, LevelSize, Scenery } from '../../level/domain/scenery';
import { LevelId } from '../../level/domain/level-id';
import { PlayLevel } from '../../level/application/play-level';
import { Level } from '../../level/domain/level';
import { check2dObstacles } from '../../level/infrastructure/check2d-obstacles';
import { InMemoryLevelRepository } from '../../level/infrastructure/in-memory-level-repository';
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
