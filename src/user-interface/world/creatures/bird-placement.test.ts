import { expect, test } from 'vitest';
import { levelView } from '../../../level/application/level-view';
import { TilePosition } from '../../../level/domain/position';
import { Flower, Ground, Tree, TreeVariant } from '../../../level/domain/scenery';
import { renderingLevel } from '../../testing/rendering-level';
import { dressWorld } from '../dressing/world-dressing';
import { tileSize } from '../world-geometry';
import { placeBirds } from './bird-placement';

const mapWidth = 12 * tileSize;
const plain = Tree.at(TilePosition.at(1, 6), TreeVariant.NoFruit);
const flowers = [...Array.from({ length: 11 }, (_, column) => TilePosition.at(column, 11)), TilePosition.at(11, 0)];
const meadow = levelView(
  renderingLevel(
    Ground.Grass,
    TilePosition.at(2, 2),
    [],
    [plain],
    flowers.map((tile) => Flower.at(tile)),
  ),
);
const bare = levelView(renderingLevel());

test('a level with no butterflies gets only the sky bird', () => {
  expect(placeBirds(bare, dressWorld(bare)).map(({ habit }) => habit)).toEqual(['sky']);
});

test('a meadow gets visitors and exactly one sky bird, last', () => {
  const birds = placeBirds(meadow, dressWorld(meadow));
  expect(birds.length).toBeGreaterThan(1);
  expect(birds.filter(({ habit }) => habit === 'sky')).toHaveLength(1);
  expect(birds.at(-1)!.habit).toBe('sky');
});

test('visitors never outnumber the butterflies', () => {
  const dressing = dressWorld(meadow);
  const visitors = placeBirds(meadow, dressing).filter(({ habit }) => habit !== 'sky');
  expect(visitors.length).toBeLessThan(dressing.butterflies.length);
});

test('the sky bird enters and leaves beyond the edges of the map', () => {
  const sky = placeBirds(meadow, dressWorld(meadow)).at(-1)!;
  const [start, end] = [sky.from.x, sky.to.x];
  expect(start < 0 ? end > mapWidth : start > mapWidth && end < 0).toBe(true);
  expect(sky.stay).toBe(0);
  expect(sky.spots).toEqual([]);
});

test('every bird visits on its own cycle and phase inside that cycle', () => {
  for (const bird of placeBirds(meadow, dressWorld(meadow))) {
    expect(bird.cycle).toBeGreaterThan(0);
    expect(bird.phase).toBeGreaterThanOrEqual(0);
    expect(bird.phase).toBeLessThan(bird.cycle);
  }
});

test('a visitor flies in from one side of its home and out the other', () => {
  for (const bird of placeBirds(meadow, dressWorld(meadow)).filter(({ habit }) => habit !== 'sky')) {
    expect(bird.from.x - bird.home.x).toBe(bird.home.x - bird.to.x);
    expect(bird.from.y).toBe(bird.to.y);
    expect(bird.from.y).toBeLessThan(bird.home.y);
  }
});

test('placing birds twice gives the same birds', () => {
  expect(placeBirds(meadow, dressWorld(meadow))).toEqual(placeBirds(meadow, dressWorld(meadow)));
});
