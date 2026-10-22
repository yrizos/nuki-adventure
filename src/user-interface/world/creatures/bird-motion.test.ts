import { describe, expect, test } from 'vitest';
import { levelView } from '../../../level/application/level-view';
import { TilePosition } from '../../../level/domain/position';
import { Flower, Ground, Tree, TreeVariant } from '../../../level/domain/scenery';
import * as library from '../../graphics/sprite-library';
import { renderingLevel } from '../../testing/rendering-level';
import { dressWorld } from '../dressing/world-dressing';
import { tileSize } from '../world-geometry';
import { birdPlace } from './bird-motion';
import { placeBirds } from './bird-placement';

describe('birds', () => {
  const plain = Tree.at(TilePosition.at(1, 6), TreeVariant.NoFruit);
  const fruit = Tree.at(TilePosition.at(8, 6), TreeVariant.Apples);
  // A row of flowers and a lone flower bring enough butterflies for the visitors.
  const flowers = [...Array.from({ length: 11 }, (_, column) => TilePosition.at(column, 11)), TilePosition.at(11, 0)];
  const level = levelView(
    renderingLevel(
      Ground.Grass,
      TilePosition.at(2, 2),
      [],
      [plain, fruit],
      flowers.map((tile) => Flower.at(tile)),
    ),
  );
  const birds = placeBirds(level, dressWorld(level));
  const faraway = { x: -1000, y: -1000 };
  const present = (bird: (typeof birds)[number], frame: number, hero = faraway): boolean =>
    birdPlace(bird, frame, hero, {}) !== undefined;

  test('perch on plain trees, hop on open grass away from the start and cross the sky once each', () => {
    expect(birds.map((bird) => bird.habit)).toEqual(['perch', 'ground', 'ground', 'sky']);
    const perch = birds[0]!.home;
    expect(Math.floor(perch.x / tileSize)).toBe(plain.base.column + 1);
    expect(perch.y).toBeLessThan(plain.base.row * tileSize);
    for (const bird of birds.filter(({ habit }) => habit === 'ground')) {
      for (const { x, y } of [bird.home, ...bird.spots]) {
        const tile = TilePosition.at(Math.floor(x / tileSize), Math.floor(y / tileSize));
        expect(level.scenery.isWalkable(tile) && !plain.hides(tile) && !fruit.hides(tile)).toBe(true);
        expect(Math.max(Math.abs(tile.column - 2), Math.abs(tile.row - 2))).toBeGreaterThan(2);
      }
    }
  });

  test('each bird is away longer than it stays and sky crossings are rare', () => {
    const shares = birds.map((bird) => {
      let shown = 0;
      for (let frame = 0; frame < bird.cycle; frame++) if (present(bird, frame)) shown++;
      return shown / bird.cycle;
    });
    for (const [index, share] of shares.entries()) expect(share, birds[index]!.habit).toBeLessThan(0.5);
    expect(shares.at(-1)).toBeLessThan(0.1);
  });

  test('a bird flies in facing its travel, lands home and leaves facing the same way', () => {
    const bird = birds[0]!;
    const visit = {};
    let frame = 0;
    while (present(bird, frame)) frame++;
    while (!present(bird, frame)) frame++;
    const side = bird.to.x > bird.from.x ? library.birdArt.right : library.birdArt.left;
    expect(side.fly).toContain(birdPlace(bird, frame, faraway, visit)!.art);
    while (birdPlace(bird, frame, faraway, visit)!.art !== side.perch[0]) frame++;
    expect(birdPlace(bird, frame, faraway, visit)).toMatchObject(bird.home);
    while (present(bird, frame)) frame++;
    expect(side.fly).toContain(birdPlace(bird, frame - 1, faraway, visit)!.art);
  });

  test('a ground bird flies a short way off when the hero comes close', () => {
    const bird = birds[1]!;
    const visit = {};
    let frame = 0;
    while (!present(bird, frame)) frame++;
    frame += 200;
    const before = birdPlace(bird, frame, faraway, visit)!;
    const hero = { x: before.x, y: before.y };
    let place = birdPlace(bird, frame, hero, visit)!;
    expect(Object.values(library.birdArt).flatMap(({ fly }) => fly)).toContain(place.art);
    const flying = Object.values(library.birdArt).flatMap(({ fly }) => fly);
    while (flying.includes(place.art)) place = birdPlace(bird, ++frame, hero, visit)!;
    expect(bird.spots).toContainEqual({ x: place.x, y: place.y });
    expect(Math.hypot(place.x - hero.x, place.y - hero.y)).toBeGreaterThanOrEqual(48);
    expect(Math.hypot(place.x - before.x, place.y - before.y)).toBeLessThanOrEqual(3 * tileSize + 8);
  });
});
