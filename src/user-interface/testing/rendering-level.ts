import { Orb } from '../../level/domain/collectibles';
import { Direction, TilePosition } from '../../level/domain/position';
import { Door } from '../../level/domain/door';
import { LevelId } from '../../level/domain/level-id';
import { Level, type Stone } from '../../level/domain/level';
import { type Flower, FlowerVariant, Ground, LevelSize, Scenery, type Tree } from '../../level/domain/scenery';
import { check2dObstacles } from '../../level/infrastructure/check2d-obstacles';

export function renderingLevel(
  ground = Ground.Grass,
  hero = TilePosition.at(2, 2),
  stones: readonly Stone[] = [],
  trees: readonly Tree[] = [],
  flowers: readonly Flower[] = [],
  flowerVariants: readonly FlowerVariant[] = FlowerVariant.All,
): Level {
  return Level.create({
    id: LevelId.of('render'),
    scenery: Scenery.of(
      LevelSize.of(12, 12),
      Array.from({ length: 12 }, () => Array.from({ length: 12 }, () => ground)),
      trees,
      flowers,
      [],
      flowerVariants,
    ),
    stones,
    orbs: [
      Orb.at(
        hero.equals(TilePosition.at(0, 0)) ? TilePosition.at(11, 11) : TilePosition.at(0, 0),
        4,
        LevelSize.of(12, 12),
      ),
    ],
    door: Door.closedAt(TilePosition.at(9, 0)),
    hero: { position: hero, facing: Direction.Down },
    obstacles: check2dObstacles,
  });
}
