import { expect, test } from 'vitest';
import { OrbColor } from '../domain/level/collectibles';
import { Door } from '../domain/level/door';
import { Direction, TilePosition } from '../domain/level/position';
import { FlowerVariant } from '../domain/level/scenery';
import { Signpost, SignpostText } from '../domain/level/signpost';
import { fitCanvas } from '../presentation/viewport-layout';
import { cameraPosition, tileSize } from '../presentation/world-geometry';
import { keepOrder, reverseOrder, starSpotsOf } from '../test-support/star-spots';
import { firstLevel, firstLevelId } from './first-level';

const at = TilePosition.at;

test('the first level selects only white-coral and blue-violet flowers', () => {
  expect(firstLevel(keepOrder).scenery.flowerVariants).toEqual([FlowerVariant.WhiteCoral, FlowerVariant.BlueViolet]);
});

test('the first level hides one violet orb that restores the whole level', () => {
  const level = firstLevel(keepOrder);
  expect(level.id).toBe(firstLevelId);
  expect(level.scenery.size).toEqual({ columns: 17, rows: 15 });
  expect(level.hero.position).toEqual(at(14, 13));
  expect(level.hero.facing).toBe(Direction.Up);
  expect(level.door.equals(Door.closedAt(at(5, 2)))).toBe(true);
  expect(level.orbs.map((orb) => [orb.position, orb.color])).toEqual([[at(1, 4), OrbColor.Violet]]);
  expect(level.orbs[0]!.restores.tiles).toHaveLength(17 * 15);
  expect(level.signposts).toEqual([
    Signpost.at(
      at(14, 12),
      SignpostText.of('Η ΜΩΒ ΣΦΑΙΡΑ ΠΕΡΙΜΕΝΕΙ ΔΙΠΛΑ ΣΤΑ ΛΟΥΛΟΥΔΙΑ, ΚΟΝΤΑ ΣΤΑ ΔΕΝΤΡΑ ΧΩΡΙΣ ΚΑΡΠΟΥΣ.'),
    ),
    Signpost.at(at(8, 3), SignpostText.of('ΒΡΕΣ ΤΗ ΣΦΑΙΡΑ. ΘΑ ΦΕΡΕΙ ΠΙΣΩ ΤΑ ΧΡΩΜΑΤΑ ΚΑΙ ΘΑ ΑΝΟΙΞΕΙ ΤΗΝ ΠΥΛΗ.')),
  ]);
  expect(level.stones.map((stone) => stone.position)).toEqual([
    at(10, 6),
    at(11, 6),
    at(9, 7),
    at(13, 7),
    at(14, 7),
    at(6, 10),
    at(7, 10),
  ]);
  expect(level.scenery.trees).toHaveLength(11);
  expect(level.scenery.flowers).toHaveLength(25);
});

test('the first level marks fifteen star spots and lets the shuffle choose its stars', () => {
  const spots = starSpotsOf(firstLevel);
  expect(spots).toHaveLength(15);
  expect(spots).toEqual(
    expect.arrayContaining([
      at(1, 3),
      at(10, 3),
      at(1, 9),
      at(15, 9),
      at(15, 13),
      at(15, 3),
      at(12, 4),
      at(5, 6),
      at(15, 7),
      at(12, 8),
      at(5, 10),
      at(11, 10),
      at(5, 12),
      at(1, 13),
      at(10, 13),
    ]),
  );
  expect(firstLevel(reverseOrder).stars.map((star) => star.position)).toEqual([...spots].reverse().slice(0, 5));
});

test('the first level starts the hero one or two rows above the bottom fence', () => {
  const level = firstLevel(keepOrder);
  const rowsAboveFence = level.scenery.size.rows - 1 - level.hero.position.row;
  expect(rowsAboveFence).toBeGreaterThanOrEqual(1);
  expect(rowsAboveFence).toBeLessThanOrEqual(2);
});

test('the first level places its orb in an exploration area at least six tiles from the exit', () => {
  const level = firstLevel(keepOrder);
  for (const orb of level.orbs) {
    const distance = Math.min(
      ...level.door.footprint.map(
        (tile) => Math.abs(tile.column - orb.position.column) + Math.abs(tile.row - orb.position.row),
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
  'the first level initially shows no part of its orb on %s %sx%s at pixel ratio %s',
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
    for (const orb of level.orbs) {
      const left = orb.position.column * tileSize + 4 - camera.x;
      const top = orb.position.row * tileSize + 4 - camera.y;
      const overlapWidth = Math.max(0, Math.min(left + 24, visibleWidth) - Math.max(left, 0));
      const overlapHeight = Math.max(0, Math.min(top + 24, visibleHeight) - Math.max(top, 0));
      expect(overlapWidth * overlapHeight).toBe(0);
    }
  },
);
