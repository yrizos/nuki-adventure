import { expect, test } from 'vitest';
import { OrbColor } from '../domain/level/collectibles';
import { Door } from '../domain/level/door';
import { Direction, TilePosition } from '../domain/level/position';
import { SignpostText } from '../domain/level/signpost';
import { secondLevel, secondLevelId } from './second-level';

const at = TilePosition.at;
const keepOrder = (positions: readonly TilePosition[]): readonly TilePosition[] => positions;

test('the second level restores the lakeside garden with one teal orb', () => {
  const level = secondLevel(keepOrder);
  expect(level.id).toBe(secondLevelId);
  expect(level.scenery.size).toEqual({ columns: 21, rows: 19 });
  expect(level.hero.position).toEqual(at(8, 17));
  expect(level.hero.facing).toBe(Direction.Up);
  expect(level.door.equals(Door.closedAt(at(9, 2)))).toBe(true);
  expect(level.orbs.map((orb) => [orb.position, orb.color])).toEqual([[at(17, 4), OrbColor.Teal]]);
  expect(level.orbs[0]!.restores.tiles).toHaveLength(21 * 19);
  expect(level.signposts.map((signpost) => [signpost.position, signpost.text])).toEqual([
    [at(9, 17), SignpostText.of('Η ΤΥΡΚΟΥΑΖ ΣΦΑΙΡΑ ΣΕ ΠΕΡΙΜΕΝΕΙ ΣΤΑ ΛΟΥΛΟΥΔΙΑ ΔΙΠΛΑ ΣΤΗ ΛΙΜΝΗ.')],
    [at(8, 3), SignpostText.of('ΒΡΕΣ ΤΗ ΣΦΑΙΡΑ. ΘΑ ΦΕΡΕΙ ΠΙΣΩ ΤΑ ΧΡΩΜΑΤΑ ΚΑΙ ΘΑ ΑΝΟΙΞΕΙ ΤΗΝ ΠΥΛΗ.')],
  ]);
  expect(level.stones.map((stone) => stone.position)).toEqual([
    at(17, 10),
    at(18, 10),
    at(2, 11),
    at(3, 11),
    at(18, 11),
    at(2, 12),
  ]);
  expect(level.stars).toHaveLength(5);
  expect(level.stars.map((star) => star.position)).toEqual([at(2, 3), at(19, 4), at(3, 10), at(2, 17), at(18, 17)]);
});
