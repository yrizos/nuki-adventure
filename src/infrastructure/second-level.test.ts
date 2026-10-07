import { expect, test } from 'vitest';
import { OrbColor } from '../domain/level/collectibles';
import { Door } from '../domain/level/door';
import { Direction, TilePosition } from '../domain/level/position';
import { SignpostText } from '../domain/level/signpost';
import { secondLevel, secondLevelId } from './second-level';

const at = TilePosition.at;
const keepOrder = (positions: readonly TilePosition[]): readonly TilePosition[] => positions;

test('the second level hides a red orb for the west and a blue orb for the east', () => {
  const level = secondLevel(keepOrder);
  expect(level.id).toBe(secondLevelId);
  expect(level.scenery.size).toEqual({ columns: 26, rows: 31 });
  expect(level.hero.position).toEqual(at(12, 28));
  expect(level.hero.facing).toBe(Direction.Up);
  expect(level.door.equals(Door.closedAt(at(11, 0)))).toBe(true);
  expect(level.orbs.map((orb) => [orb.position, orb.color])).toEqual([
    [at(8, 1), OrbColor.Red],
    [at(18, 5), OrbColor.Blue],
  ]);
  const [red, blue] = level.orbs;
  expect(red!.restores.tiles).toHaveLength(13 * 31);
  expect(red!.restores.tiles.every((tile) => tile.column < 13)).toBe(true);
  expect(blue!.restores.tiles).toHaveLength(13 * 31);
  expect(blue!.restores.tiles.every((tile) => tile.column >= 13)).toBe(true);
  expect(level.signposts.map((signpost) => [signpost.position, signpost.text])).toEqual([
    [at(10, 1), SignpostText.of('ΔΥΟ ΣΦΑΙΡΕΣ ΚΡΥΒΟΝΤΑΙ ΕΔΩ. Η ΠΥΛΗ ΑΝΟΙΓΕΙ ΜΟΝΟ ΜΕ ΤΙΣ ΔΥΟ.')],
    [at(3, 17), SignpostText.of('ΟΠΟΥ ΤΑ ΔΕΝΤΡΑ ΣΤΕΚΟΝΤΑΙ ΠΥΚΝΑ, ΚΑΤΙ ΚΟΚΚΙΝΟ ΠΕΡΙΜΕΝΕΙ ΣΤΗΝ ΑΚΡΗ.')],
    [at(18, 11), SignpostText.of('ΤΟ ΝΕΡΟ ΔΕΝ ΣΕ ΑΦΗΝΕΙ ΝΑ ΠΕΡΑΣΕΙΣ. ΔΟΚΙΜΑΣΕ ΤΗΝ ΑΛΛΗ ΟΧΘΗ.')],
  ]);
  expect(level.stones.map((stone) => stone.position)).toEqual([at(11, 21)]);
  expect(level.stars).toHaveLength(8);
});
