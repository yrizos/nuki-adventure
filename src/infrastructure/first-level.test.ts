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
  expect(level.scenery.size).toEqual({ columns: 14, rows: 15 });
  expect(level.hero.position).toEqual(at(6, 5));
  expect(level.hero.facing).toBe(Direction.Up);
  expect(level.door.equals(Door.closedAt(at(5, 2)))).toBe(true);
  expect(level.orbs.map((orb) => [orb.position, orb.color])).toEqual([[at(10, 11), OrbColor.Violet]]);
  expect(level.orbs[0]!.restores.tiles).toHaveLength(14 * 15);
  expect(level.signposts).toEqual([
    Signpost.at(at(4, 3), SignpostText.of('ΒΡΕΣ ΤΗ ΜΩΒ ΣΦΑΙΡΑ! ΘΑ ΦΕΡΕΙ ΠΙΣΩ ΤΑ ΧΡΩΜΑΤΑ ΚΑΙ ΘΑ ΑΝΟΙΞΕΙ ΤΗΝ ΠΥΛΗ.')),
  ]);
  expect(level.stones.map((stone) => stone.position)).toEqual([at(10, 9), at(11, 9), at(10, 10), at(6, 13)]);
  expect(level.scenery.trees).toHaveLength(12);
  expect(level.scenery.flowers).toHaveLength(9);
  expect(level.stars.map((star) => star.position)).toEqual([at(1, 3), at(12, 5), at(1, 9), at(12, 12), at(1, 13)]);
});

test('the first level places its stars by hand, whatever the shuffle', () => {
  const reverseOrder = (positions: readonly TilePosition[]): readonly TilePosition[] => [...positions].reverse();
  const starPositions = (shuffle: typeof keepOrder) => firstLevel(shuffle).stars.map((star) => star.position);
  expect(starPositions(reverseOrder)).toEqual(starPositions(keepOrder));
});
