import { expect, test } from 'vitest';
import { OrbColor } from '../domain/level/collectibles';
import { Door } from '../domain/level/door';
import { LevelCompleted, OrbCollected } from '../domain/level/level-events';
import { Direction, TilePosition } from '../domain/level/position';
import { follow, pathTo } from '../test-support/walk-level';
import { thirdLevel, thirdLevelId } from './third-level';

const at = TilePosition.at;
const keepOrder = (positions: readonly TilePosition[]): readonly TilePosition[] => positions;
const orbOf = (color: OrbColor) => thirdLevel(keepOrder).orbs.find((orb) => orb.color === color)!;

test('the third level opens at the foot of its orchard and lake with one red and one blue orb', () => {
  const level = thirdLevel(keepOrder);
  expect(level.id).toBe(thirdLevelId);
  expect(level.scenery.size).toEqual({ columns: 25, rows: 25 });
  expect(level.hero.position).toEqual(at(12, 23));
  expect(level.hero.facing).toBe(Direction.Up);
  expect(level.door.equals(Door.closedAt(at(11, 2)))).toBe(true);
  expect(level.orbs).toHaveLength(2);
  expect(orbOf(OrbColor.Red).position).toEqual(at(4, 12));
  expect(orbOf(OrbColor.Blue).position).toEqual(at(19, 12));
});

test('the restore areas of the two orbs split the map between them', () => {
  const level = thirdLevel(keepOrder);
  const red = orbOf(OrbColor.Red).restores;
  const blue = orbOf(OrbColor.Blue).restores;
  expect(red.tiles).toHaveLength(347);
  expect(blue.tiles).toHaveLength(278);
  expect(red.tiles.length + blue.tiles.length).toBe(level.scenery.size.columns * level.scenery.size.rows);
  for (let row = 0; row < level.scenery.size.rows; row++) {
    for (let column = 0; column < level.scenery.size.columns; column++) {
      const tile = at(column, row);
      expect(red.covers(tile) !== blue.covers(tile), `tile ${column}, ${row} must be restored by exactly one orb`).toBe(
        true,
      );
    }
  }
});

test.each([
  ['red', OrbColor.Red],
  ['blue', OrbColor.Blue],
])('the %s orb stands inside the area it restores', (_, color) => {
  const orb = orbOf(color);
  expect(orb.restores.covers(orb.position)).toBe(true);
});

test('the third level has a hint for each orb that names its color and an exit sign that never does', () => {
  const level = thirdLevel(keepOrder);
  const texts = level.signposts.map((signpost) => signpost.text.value);
  expect(texts).toHaveLength(3);
  expect(texts.filter((text) => text.includes('ΚΟΚΚΙΝΗ') && !text.includes('ΜΠΛΕ'))).toHaveLength(1);
  expect(texts.filter((text) => text.includes('ΜΠΛΕ') && !text.includes('ΚΟΚΚΙΝΗ'))).toHaveLength(1);
  const [exit, ...others] = texts.filter((text) => !/ΚΟΚΚΙΝ|ΜΠΛΕ/u.test(text));
  expect(others).toEqual([]);
  expect(exit).toContain('ΔΥΟ ΣΦΑΙΡΕΣ');
});

test('the third level places its five stars by hand, whatever the shuffle', () => {
  const reverseOrder = (positions: readonly TilePosition[]): readonly TilePosition[] => [...positions].reverse();
  const starPositions = (shuffle: typeof keepOrder) => thirdLevel(shuffle).stars.map((star) => star.position);
  expect(starPositions(keepOrder)).toHaveLength(5);
  expect(starPositions(keepOrder)).toEqual([at(1, 3), at(22, 3), at(23, 13), at(23, 17), at(1, 21)]);
  expect(starPositions(reverseOrder)).toEqual(starPositions(keepOrder));
});

test.each([
  { label: 'red then blue', order: [OrbColor.Red, OrbColor.Blue] },
  { label: 'blue then red', order: [OrbColor.Blue, OrbColor.Red] },
])('the third level opens its door only after both orbs and completes at it, $label', ({ order }) => {
  const level = thirdLevel(keepOrder);
  for (const [collected, color] of order.entries()) {
    const orb = level.orbs.find((candidate) => candidate.color === color)!;
    const path = pathTo(level, (tile) => tile.equals(orb.position));
    expect(path, 'the orb must be reachable from where she stands').toBeDefined();
    const pickups = follow(level, path!).filter((event) => event instanceof OrbCollected);
    expect(pickups.map((event) => event.position)).toEqual([orb.position]);
    expect(level.door.isOpen).toBe(false);
    if (collected < order.length - 1) {
      expect(() => level.openDoor()).toThrow();
      expect(level.door.isOpen).toBe(false);
    }
  }
  level.openDoor();
  expect(level.door.isOpen).toBe(true);
  const toDoor = pathTo(level, (tile) => level.door.covers(tile));
  expect(toDoor, 'the open door must be reachable').toBeDefined();
  expect(follow(level, toDoor!).some((event) => event instanceof LevelCompleted)).toBe(true);
  expect(level.isComplete).toBe(true);
});
