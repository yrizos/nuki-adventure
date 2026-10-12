import { expect, test } from 'vitest';
import { Door } from '../domain/level/door';
import { TilePosition } from '../domain/level/position';
import { FlowerVariant, Ground } from '../domain/level/scenery';
import { fitCanvas } from '../presentation/viewport-layout';
import { cameraPosition, tileSize } from '../presentation/world-geometry';
import { keepOrder, reverseOrder, starSpotsOf } from '../test-support/star-spots';
import { firstLevel, firstLevelId } from './first-level';

const at = TilePosition.at;
const tiles = Array.from({ length: 25 * 25 }, (_, index) => at(index % 25, Math.floor(index / 25)));

test('the first level selects only white-coral and blue-violet flowers', () => {
  expect(firstLevel(keepOrder).scenery.flowerVariants).toEqual([FlowerVariant.WhiteCoral, FlowerVariant.BlueViolet]);
});

test('the first level is an orchard clearing with one key that restores the whole level', () => {
  const level = firstLevel(keepOrder);
  expect(level.id).toBe(firstLevelId);
  expect(level.scenery.size).toEqual({ columns: 25, rows: 25 });
  expect(level.hero.position).toEqual(at(12, 21));
  expect(level.door).toEqual(Door.closedAt(at(6, 1)));
  expect(level.keys.map((key) => key.position)).toEqual([at(19, 4)]);
  expect(level.keys[0]!.restores.tiles).toHaveLength(25 * 25);
  expect(level.stones.map((stone) => stone.position)).toEqual([
    at(16, 5),
    at(7, 6),
    at(16, 6),
    at(20, 16),
    at(9, 18),
    at(10, 18),
    at(5, 19),
  ]);
  expect(level.scenery.trees).toHaveLength(26);
  expect(level.scenery.flowers).toHaveLength(27);
  expect(level.scenery.woodland.tiles).toHaveLength(161);
});

test('the first level holds a small pond in its southwestern orchard', () => {
  const { scenery } = firstLevel(keepOrder);
  const pond = tiles.filter((tile) => scenery.groundAt(tile).equals(Ground.Water));
  expect(pond).toEqual([
    at(7, 15),
    at(8, 15),
    at(6, 16),
    at(7, 16),
    at(8, 16),
    at(9, 16),
    at(5, 17),
    at(6, 17),
    at(7, 17),
    at(8, 17),
    at(9, 17),
    at(6, 18),
    at(7, 18),
    at(8, 18),
  ]);
});

test('the first level marks twenty star spots and lets the shuffle choose its stars', () => {
  const spots = starSpotsOf(firstLevel);
  expect(spots).toEqual([
    at(12, 1),
    at(10, 2),
    at(17, 2),
    at(2, 5),
    at(23, 6),
    at(1, 8),
    at(14, 8),
    at(4, 9),
    at(22, 10),
    at(18, 12),
    at(22, 13),
    at(9, 14),
    at(1, 15),
    at(16, 16),
    at(22, 18),
    at(7, 19),
    at(2, 21),
    at(18, 21),
    at(10, 22),
    at(21, 22),
  ]);
  expect(firstLevel(reverseOrder).stars.map((star) => star.position)).toEqual([...spots].reverse().slice(0, 5));
});

test('the first level places its key in an exploration area at least six tiles from the exit', () => {
  const level = firstLevel(keepOrder);
  for (const key of level.keys) {
    const distance = Math.min(
      ...level.door.footprint.map(
        (tile) => Math.abs(tile.column - key.position.column) + Math.abs(tile.row - key.position.row),
      ),
    );
    expect(distance).toBeGreaterThanOrEqual(6);
  }
});

test.each([
  ['desktop', 1280, 900, 1],
  ['desktop', 1280, 900, 2],
  ['desktop', 1280, 900, 3],
  ['mobile', 390, 844, 1],
  ['mobile', 390, 844, 2],
  ['mobile', 390, 844, 3],
] as const)(
  'the first level initially shows no part of its key on %s %sx%s at pixel ratio %s',
  (_, width, height, ratio) => {
    const level = firstLevel(keepOrder);
    const columnWidth = width >= 600 ? Math.max(320, Math.min(width, (height * 360) / 544)) : width;
    const deviceWidth = Math.floor(columnWidth * ratio);
    const panelPixel = Math.max(1, Math.floor(deviceWidth / 180));
    const deviceHeight = height * ratio - 92 * panelPixel;
    const fit = fitCanvas(deviceWidth, deviceHeight);
    const camera = cameraPosition(level, fit.width, fit.height);
    const visibleWidth = deviceWidth / fit.scale;
    const visibleHeight = deviceHeight / fit.scale;
    for (const key of level.keys) {
      const left = key.position.column * tileSize + 4 - camera.x;
      const top = key.position.row * tileSize + 4 - camera.y;
      const overlapWidth = Math.max(0, Math.min(left + 24, visibleWidth) - Math.max(left, 0));
      const overlapHeight = Math.max(0, Math.min(top + 24, visibleHeight) - Math.max(top, 0));
      expect(overlapWidth * overlapHeight).toBe(0);
    }
  },
);
