import { expect, test } from 'vitest';
import { OrbColor } from '../domain/level/collectibles';
import { Door } from '../domain/level/door';
import { Direction, TilePosition } from '../domain/level/position';
import { Signpost, SignpostText } from '../domain/level/signpost';
import { firstLevel, firstLevelId } from './first-level';

const at = TilePosition.at;
const keepOrder = (positions: readonly TilePosition[]): readonly TilePosition[] => positions;

test('the first level hides one violet orb that restores the whole level', () => {
  const level = firstLevel(keepOrder);
  expect(level.id).toBe(firstLevelId);
  expect(level.scenery.size).toEqual({ columns: 18, rows: 20 });
  expect(level.hero.position).toEqual(at(5, 17));
  expect(level.hero.facing).toBe(Direction.Up);
  expect(level.door.equals(Door.closedAt(at(7, 2)))).toBe(true);
  expect(level.orbs.map((orb) => [orb.position, orb.color])).toEqual([[at(15, 9), OrbColor.Violet]]);
  expect(level.orbs[0]!.restores.tiles).toHaveLength(18 * 20);
  expect(level.signposts).toEqual([
    Signpost.at(at(6, 3), SignpostText.of('ΒΡΕΣ ΤΗ ΜΩΒ ΣΦΑΙΡΑ! ΘΑ ΦΕΡΕΙ ΠΙΣΩ ΤΑ ΧΡΩΜΑΤΑ ΚΑΙ ΘΑ ΑΝΟΙΞΕΙ ΤΗΝ ΠΥΛΗ.')),
  ]);
  expect(level.stones.map((stone) => stone.position)).toEqual([at(11, 5), at(6, 7), at(3, 12), at(14, 12), at(11, 16)]);
  expect(level.scenery.trees).toHaveLength(12);
  expect(level.scenery.flowers).toHaveLength(9);
  expect(level.stars).toHaveLength(5);
});
