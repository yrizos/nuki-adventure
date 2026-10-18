import { expect, test } from 'vitest';
import { Orb } from '../../level/domain/collectibles';
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
const size = LevelSize.of(8, 8);

function view(orbs: readonly Orb[]) {
  const level = Level.create({
    id,
    scenery: Scenery.of(
      size,
      Array.from({ length: 8 }, () => Array<Ground>(8).fill(Ground.Path)),
      [],
      [],
    ),
    stones: [],
    orbs,
    door: Door.closedAt(TilePosition.at(0, 0)),
    hero: { position: TilePosition.at(4, 4), facing: Direction.Up },
    obstacles: check2dObstacles,
  });
  return new PlayLevel(new InMemoryLevelRepository([level])).view(id);
}

const lone = Orb.at(TilePosition.at(1, 1), 4, size);
const thumbnail = (orbs: readonly Orb[], colored: boolean) => [
  ...levelMap(view(orbs), colored, () => 0.5).packedPixels,
];

test('fits the whole level into the map size', () => {
  const map = levelMap(view([lone]), false, () => 0.5);
  expect([map.width, map.height]).toEqual([mapSize, mapSize]);
});

test('leaves the orbs out, because they move every time the level is built', () => {
  const elsewhere = Orb.at(TilePosition.at(6, 6), 4, size);
  expect(thumbnail([lone], false)).toEqual(thumbnail([elsewhere], false));
  expect(thumbnail([lone], true)).toEqual(thumbnail([elsewhere], true));
});

test('draws the colored world only when asked', () => {
  expect(thumbnail([lone], true)).not.toEqual(thumbnail([lone], false));
});
