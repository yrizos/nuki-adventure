import { describe, expect, test } from 'vitest';
import { TilePosition } from '../../../level/domain/position';
import { Flower, FlowerVariant, Ground, LevelSize, Scenery, Tree, TreeVariant } from '../../../level/domain/scenery';
import { butterflyArt } from '../../graphics/sprite-library';
import { tileSize } from '../world-geometry';
import { butterflies } from './butterfly-routes';

const meadow = (flowers: readonly TilePosition[], trees: readonly Tree[] = []): Scenery =>
  Scenery.of(
    LevelSize.of(12, 12),
    Array.from({ length: 12 }, () => Array.from({ length: 12 }, () => Ground.Grass)),
    trees,
    flowers.map((tile) => Flower.at(tile)),
    [],
    FlowerVariant.All,
  );
const centerOf = ({ column, row }: TilePosition) => ({
  x: column * tileSize + tileSize / 2,
  y: row * tileSize + tileSize / 2,
});

test('a level with no flowers and no fruit trees has no butterflies', () => {
  expect(butterflies(meadow([]))).toEqual([]);
  expect(butterflies(meadow([], [Tree.at(TilePosition.at(4, 6), TreeVariant.NoFruit)]))).toEqual([]);
});

test('a lone flower gets one butterfly that starts at the flower and has somewhere to flutter to', () => {
  const flower = TilePosition.at(5, 5);
  const [butterfly] = butterflies(meadow([flower]));
  expect(butterfly!.legs[0]!.from).toEqual(centerOf(flower));
  expect(butterfly!.legs.length).toBeGreaterThan(1);
});

test('flowers within reach of each other share a butterfly and distant ones get their own', () => {
  expect(butterflies(meadow([TilePosition.at(0, 0), TilePosition.at(3, 3)]))).toHaveLength(1);
  expect(butterflies(meadow([TilePosition.at(0, 0), TilePosition.at(11, 11)]))).toHaveLength(2);
});

test('a bigger patch brings more butterflies up to a cap of three', () => {
  const row = (length: number): TilePosition[] => Array.from({ length }, (_, column) => TilePosition.at(column, 0));
  expect(butterflies(meadow(row(5)))).toHaveLength(1);
  expect(butterflies(meadow(row(6)))).toHaveLength(2);
  expect(butterflies(meadow(row(11)))).toHaveLength(3);
});

describe('every route', () => {
  const all = butterflies(meadow(Array.from({ length: 8 }, (_, column) => TilePosition.at(column, 2))));

  test('is a loop that ends where it began', () => {
    for (const { legs } of all) {
      legs.forEach((leg, index) => expect(leg.to).toBe(legs[(index + 1) % legs.length]!.from));
    }
  });

  test('has a cycle that adds up its rests and flights, and a phase inside none of them', () => {
    for (const { legs, cycle, phase } of all) {
      expect(cycle).toBe(legs.reduce((sum, leg) => sum + leg.rest + leg.flight, 0));
      expect(phase).toBeGreaterThanOrEqual(0);
    }
  });

  test('flies no faster than the slowest allowed speed and at least a short while', () => {
    for (const { legs } of all)
      for (const leg of legs) {
        expect(leg.flight).toBeGreaterThanOrEqual(12);
        expect(leg.flight).toBeGreaterThanOrEqual(
          Math.round(Math.hypot(leg.to.x - leg.from.x, leg.to.y - leg.from.y) / 0.75),
        );
      }
  });
});

test('flowers get any butterfly color', () => {
  const colors = new Set(
    butterflies(meadow(Array.from({ length: 12 }, (_, column) => TilePosition.at(column, 0)))).map(
      ({ frames }) => frames,
    ),
  );
  for (const frames of colors) expect(butterflyArt).toContain(frames);
});

test('a butterfly on an apple orchard only takes a color that stands out from red apples', () => {
  const orchard = butterflies(meadow([], [Tree.at(TilePosition.at(4, 6), TreeVariant.Apples)]));
  expect(orchard.length).toBeGreaterThan(0);
  for (const { frames } of orchard) expect([butterflyArt[0], butterflyArt[2]]).toContain(frames);
});

test('orchard butterflies hover over the canopy of the fruit trees', () => {
  const tree = Tree.at(TilePosition.at(4, 6), TreeVariant.Lemons);
  const tops = tree.footprint.map(({ column, row }) => ({
    x: column * tileSize + tileSize / 2,
    y: row * tileSize - 6,
  }));
  const [butterfly] = butterflies(meadow([], [tree]));
  expect(tops).toContainEqual(butterfly!.legs[0]!.from);
});
