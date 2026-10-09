import { expect, test } from 'vitest';
import { feet } from '../domain/level/hero';
import { Level } from '../domain/level/level';
import { Direction, Heading, TilePosition, WorldPosition, tileSize } from '../domain/level/position';
import { check2dObstacles } from './check2d-obstacles';
import { firstLevel } from './first-level';
import { secondLevel } from './second-level';
import { thirdLevel } from './third-level';

const keepOrder = (positions: readonly TilePosition[]): readonly TilePosition[] => positions;
const frames = 24;
const directions = [
  Direction.Up,
  Direction.Down,
  Direction.Left,
  Direction.Right,
  Direction.UpLeft,
  Direction.UpRight,
  Direction.DownLeft,
  Direction.DownRight,
];
// Starting a walk from far away makes an unsettled overlap come back as that far position instead of her own.
const farAway = WorldPosition.at(-10 * tileSize, -10 * tileSize);

const starts = [
  { name: 'first', authored: firstLevel(keepOrder) },
  { name: 'second', authored: secondLevel(keepOrder) },
  { name: 'third', authored: thirdLevel(keepOrder) },
].flatMap(({ name, authored }) => {
  // Nothing here opens the door, so the obstacles never change and placing them once per level keeps the suite fast.
  const obstacles = check2dObstacles(authored.outlines);
  return Array.from({ length: authored.scenery.size.rows }, (_, row) =>
    Array.from({ length: authored.scenery.size.columns }, (_, column) => TilePosition.at(column, row)),
  )
    .flat()
    .filter(
      (tile) =>
        tile.row > authored.door.left.row &&
        authored.scenery.isWalkable(tile) &&
        !authored.stones.some((stone) => stone.position.equals(tile)) &&
        !authored.signposts.some((signpost) => signpost.position.equals(tile)),
    )
    .map((tile) => ({ name, authored, obstacles, tile, label: `${tile.column}, ${tile.row}` }));
});

test.each(starts)(
  'in the $name level from tile $label she stays on open ground inside the level and the door stays closed',
  ({ authored, obstacles, tile }) => {
    const violations: string[] = [];
    for (const direction of directions) {
      const level = Level.create({
        id: authored.id,
        scenery: authored.scenery,
        stones: authored.stones,
        orbs: authored.orbs,
        door: authored.door,
        hero: { position: tile, facing: Direction.Up },
        signposts: authored.signposts,
        obstacles: () => obstacles,
      });
      const width = level.scenery.size.columns * tileSize;
      const height = level.scenery.size.rows * tileSize;
      for (let frame = 0; frame < frames; frame++) {
        level.tick(Heading.of(direction));
        const at = level.hero.feet;
        const where = `${direction.name} frame ${frame} at ${at.x}, ${at.y}`;
        if (at.x < 0 || at.y < 0) violations.push(`${where}: below the level origin`);
        if (at.x >= width || at.y >= height) violations.push(`${where}: beyond the level size`);
        if (!obstacles.walk(feet.at(farAway), at).equals(at)) violations.push(`${where}: inside an obstacle`);
        if (level.orbs.length > 0) {
          if (level.door.isOpen) violations.push(`${where}: door open while orbs remain`);
          if (level.door.covers(level.hero.position)) violations.push(`${where}: on the door while orbs remain`);
          if (level.isComplete) violations.push(`${where}: complete while orbs remain`);
        }
      }
    }
    expect(violations).toEqual([]);
  },
);
