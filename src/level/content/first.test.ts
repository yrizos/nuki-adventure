import { expect, test } from 'vitest';
import { check2dObstacles } from '../infrastructure/check2d-obstacles';
import { Door } from '../domain/door';
import { TilePosition } from '../domain/position';
import { FlowerVariant, Ground } from '../domain/scenery';
import { fitCanvas } from '../../user-interface/shell/viewport-layout';
import { cameraPosition, tileSize } from '../../user-interface/world/world-geometry';
import { keepOrder, lowestRoll } from '../testing/draws';
import { firstLevel, firstLevelId } from './first';

const at = TilePosition.at;
const tiles = Array.from({ length: 25 * 25 }, (_, index) => at(index % 25, Math.floor(index / 25)));

test('the first level selects only white-coral and blue-violet flowers', () => {
  expect(firstLevel(keepOrder, check2dObstacles, lowestRoll).scenery.flowerVariants).toEqual([
    FlowerVariant.WhiteCoral,
    FlowerVariant.BlueViolet,
  ]);
});

test('the first level winds through a forest, a lake, an orchard and two gardens with two permanent orbs', () => {
  const level = firstLevel(keepOrder, check2dObstacles, lowestRoll);
  expect(level.id).toBe(firstLevelId);
  expect(level.scenery.size).toEqual({ columns: 25, rows: 25 });
  expect(level.hero.position).toEqual(at(12, 21));
  expect(level.door).toEqual(Door.closedAt(at(11, 1)));
  expect(level.permanentOrbs).toEqual([at(21, 4), at(12, 19)]);
  expect(level.stones.map((stone) => stone.position)).toEqual([at(7, 9), at(8, 9), at(17, 19), at(5, 20), at(6, 20)]);
  expect(level.scenery.trees).toHaveLength(8);
  expect(level.scenery.flowers).toHaveLength(27);
  expect(level.scenery.woodland.tiles).toHaveLength(239);
});

test('the first level holds a lake around a point reaching in from its south shore and a small pond in the south east', () => {
  const { scenery } = firstLevel(keepOrder, check2dObstacles, lowestRoll);
  const water = tiles.filter((tile) => scenery.groundAt(tile).equals(Ground.Water));
  expect(water).toEqual([
    at(5, 10),
    at(6, 10),
    at(7, 10),
    at(3, 11),
    at(4, 11),
    at(5, 11),
    at(6, 11),
    at(7, 11),
    at(8, 11),
    at(9, 11),
    at(3, 12),
    at(4, 12),
    at(5, 12),
    at(6, 12),
    at(8, 12),
    at(9, 12),
    at(10, 12),
    at(5, 13),
    at(6, 13),
    at(8, 13),
    at(9, 13),
    at(19, 18),
    at(20, 18),
    at(18, 19),
    at(19, 19),
    at(20, 19),
  ]);
});

test('the first level places its permanent orb at least six tiles from the exit', () => {
  const level = firstLevel(keepOrder, check2dObstacles, lowestRoll);
  for (const orb of level.permanentOrbs) {
    const distance = Math.min(
      ...level.door.footprint.map((tile) => Math.abs(tile.column - orb.column) + Math.abs(tile.row - orb.row)),
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
  'the first level initially shows no part of its northern orb on %s %sx%s at pixel ratio %s',
  (_, width, height, ratio) => {
    const level = firstLevel(keepOrder, check2dObstacles, lowestRoll);
    const columnWidth = width >= 600 ? Math.max(320, Math.min(width, (height * 360) / 544)) : width;
    const deviceWidth = Math.floor(columnWidth * ratio);
    const panelPixel = Math.max(1, Math.floor(deviceWidth / 180));
    const deviceHeight = height * ratio - 92 * panelPixel;
    const fit = fitCanvas(deviceWidth, deviceHeight);
    const camera = cameraPosition(level, fit.width, fit.height);
    const visibleWidth = deviceWidth / fit.scale;
    const visibleHeight = deviceHeight / fit.scale;
    for (const orb of level.permanentOrbs.slice(0, 1)) {
      const left = orb.column * tileSize + 4 - camera.x;
      const top = orb.row * tileSize + 4 - camera.y;
      const overlapWidth = Math.max(0, Math.min(left + 24, visibleWidth) - Math.max(left, 0));
      const overlapHeight = Math.max(0, Math.min(top + 24, visibleHeight) - Math.max(top, 0));
      expect(overlapWidth * overlapHeight).toBe(0);
    }
  },
);
