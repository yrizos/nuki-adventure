import { expect, test } from 'vitest';
import { feet } from '../domain/level/hero';
import { Level } from '../domain/level/level';
import { Direction, Heading, TilePosition, TilePositions, WorldPosition, tileSize } from '../domain/level/position';
import { SwingGate } from '../domain/level/swing-gate';
import { swungThrough } from '../test-support/walk-level';
import { check2dObstacles } from './check2d-obstacles';
import { fifthLevel } from './fifth-level';
import { firstLevel } from './first-level';
import { secondLevel } from './second-level';
import { fourthLevel } from './fourth-level';
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

// Grid connectivity is only the selection of starts. The sweep below checks each one against the real collision.
function regionAround(level: Level, start: TilePosition, enterable: (tile: TilePosition) => boolean): TilePositions {
  const reached = [start];
  for (let index = 0; index < reached.length; index++) {
    for (const direction of [Direction.Up, Direction.Down, Direction.Left, Direction.Right]) {
      const neighbor = reached[index]!.neighbor(direction);
      if (
        level.scenery.size.contains(neighbor) &&
        enterable(neighbor) &&
        !reached.some((tile) => tile.equals(neighbor))
      )
        reached.push(neighbor);
    }
  }
  return TilePositions.of(reached);
}

interface Pass {
  readonly name: string;
  readonly authored: Level;
  readonly gate: SwingGate | undefined;
  readonly region: TilePositions | undefined;
  readonly beyond: TilePositions | undefined;
}

// A gated level is swept twice: with the gate shut from every tile it encloses, and with it open from every tile.
const passes = [
  { name: 'first', authored: firstLevel(keepOrder) },
  { name: 'second', authored: secondLevel(keepOrder) },
  { name: 'third', authored: thirdLevel(keepOrder) },
  { name: 'fourth', authored: fourthLevel(keepOrder) },
  { name: 'fifth', authored: fifthLevel(keepOrder) },
].flatMap(({ name, authored }): Pass[] => {
  const gate = authored.gate;
  if (!gate) return [{ name, authored, gate, region: undefined, beyond: undefined }];
  const open = (tile: TilePosition): boolean =>
    authored.scenery.isWalkable(tile) && !authored.stones.some((stone) => stone.position.equals(tile));
  const near = regionAround(authored, authored.hero.position, (tile) => open(tile) && !gate.covers(tile));
  const far = regionAround(authored, gate.position.neighbor(gate.swing), (tile) => open(tile) && !gate.covers(tile));
  // She can close the gate behind her from either side, so a closed gate must hold from both.
  return [
    { name: `${name} (gate closed)`, authored, gate, region: near, beyond: far },
    { name: `${name} (gate closed behind her)`, authored, gate, region: far, beyond: near },
    {
      name: `${name} (gate open)`,
      authored,
      gate: swungThrough(SwingGate.closedAt(gate.position, gate.approachSide).requestOpen()),
      region: undefined,
      beyond: undefined,
    },
  ];
});

const sweeps = passes.map(({ name, authored, gate, region, beyond }) => {
  // Nothing here opens the door or moves the gate, so the obstacles never change and placing them once per pass keeps the suite fast.
  const obstacles = check2dObstacles(
    Level.create({
      id: authored.id,
      scenery: authored.scenery,
      stones: authored.stones,
      keys: authored.keys,
      door: authored.door,
      hero: { position: authored.hero.position, facing: Direction.Up },
      ...(gate ? { gate } : {}),
      obstacles: check2dObstacles,
    }).outlines,
  );
  const starts = Array.from({ length: authored.scenery.size.rows }, (_, row) =>
    Array.from({ length: authored.scenery.size.columns }, (_, column) => TilePosition.at(column, row)),
  )
    .flat()
    .filter(
      (tile) =>
        tile.row > authored.door.left.row &&
        authored.scenery.isWalkable(tile) &&
        !authored.stones.some((stone) => stone.position.equals(tile)) &&
        (!region || region.covers(tile)),
    );
  return { name, authored, gate, beyond, obstacles, starts };
});

test.each(sweeps)(
  'in the $name level from every tile she stays on open ground inside the level and the door stays closed',
  ({ authored, gate, beyond, obstacles, starts }) => {
    const violations: string[] = [];
    for (const tile of starts)
      for (const direction of directions) {
        const level = Level.create({
          id: authored.id,
          scenery: authored.scenery,
          stones: authored.stones,
          keys: authored.keys,
          door: authored.door,
          hero: { position: tile, facing: Direction.Up },
          ...(gate ? { gate } : {}),
          obstacles: () => obstacles,
        });
        const width = level.scenery.size.columns * tileSize;
        const height = level.scenery.size.rows * tileSize;
        for (let frame = 0; frame < frames; frame++) {
          level.tick(Heading.of(direction));
          const at = level.hero.feet;
          const where = `${tile.column}, ${tile.row} ${direction.name} frame ${frame} at ${at.x}, ${at.y}`;
          if (at.x < 0 || at.y < 0) violations.push(`${where}: below the level origin`);
          if (at.x >= width || at.y >= height) violations.push(`${where}: beyond the level size`);
          const settled = obstacles.walk(feet.at(farAway), at);
          if (settled.x !== at.x || settled.y !== at.y) violations.push(`${where}: inside an obstacle`);
          if (beyond?.covers(level.hero.position)) violations.push(`${where}: past the closed gate`);
          if (level.keys.length > 0) {
            if (level.door.isOpen) violations.push(`${where}: door open while keys remain`);
            if (level.door.covers(level.hero.position)) violations.push(`${where}: on the door while keys remain`);
            if (level.isComplete) violations.push(`${where}: complete while keys remain`);
          }
        }
      }
    expect(violations).toEqual([]);
  },
);
