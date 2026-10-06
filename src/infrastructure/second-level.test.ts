import { expect, test } from 'vitest';
import { OrbColor } from '../domain/level/level';
import { Direction, type TilePosition } from '../domain/level/position';
import { secondLevel } from './second-level';

test('the second level hides a red and a blue orb where the hero can walk to', () => {
  const level = secondLevel();
  expect(level.orbs.map((orb) => orb.color)).toEqual([OrbColor.Red, OrbColor.Blue]);
  expect(level.signposts).toHaveLength(3);
  expect(level.stars).toHaveLength(8);
  const open = (position: TilePosition): boolean => level.scenery.isWalkable(position) && !level.door.covers(position) &&
    !level.stones.some((stone) => stone.position.equals(position)) && !level.signposts.some((signpost) => signpost.position.equals(position));
  const reached = [level.hero.position];
  for (let index = 0; index < reached.length; index++) {
    for (const direction of [Direction.Up, Direction.Down, Direction.Left, Direction.Right]) {
      const next = reached[index]!.neighbor(direction);
      if (open(next) && !reached.some((tile) => tile.equals(next))) reached.push(next);
    }
  }
  for (const orb of level.orbs) expect(reached.some((tile) => tile.equals(orb.position))).toBe(true);
});
