import { expect } from 'vitest';
import { feet } from '../domain/level/hero';
import type { Level } from '../domain/level/level';
import type { LevelEvent } from '../domain/level/level-events';
import { Direction, Heading, type TilePosition, type WorldPosition, tileSize } from '../domain/level/position';
import { check2dObstacles } from '../infrastructure/check2d-obstacles';

const directions = [Direction.Up, Direction.Down, Direction.Left, Direction.Right];

export function pathTo(
  level: Pick<Level, 'outlines' | 'hero' | 'scenery'>,
  destination: (position: TilePosition) => boolean,
): readonly WorldPosition[] | undefined {
  const obstacles = check2dObstacles(level.outlines);
  const start = level.hero.feet;
  const key = (position: WorldPosition): string => `${position.x},${position.y}`;
  const reached = [start];
  const previous = new Map<string, WorldPosition | null>([[key(start), null]]);
  for (let index = 0; index < reached.length; index++) {
    const here = reached[index]!;
    if (destination(here.tile)) {
      const path = [here];
      let parent = previous.get(key(here));
      while (parent) {
        path.push(parent);
        parent = previous.get(key(parent));
      }
      return path.reverse();
    }
    for (const direction of directions) {
      const next = here.moved(Heading.of(direction), 2);
      if (
        next.x < 0 ||
        next.y < 0 ||
        next.x >= level.scenery.size.columns * tileSize ||
        next.y >= level.scenery.size.rows * tileSize ||
        previous.has(key(next)) ||
        !obstacles.walk(feet.at(here), next).equals(next)
      ) {
        continue;
      }
      previous.set(key(next), here);
      reached.push(next);
    }
  }
  return undefined;
}

export function follow(level: Level, path: readonly WorldPosition[]): readonly LevelEvent[] {
  const events: LevelEvent[] = [];
  for (const next of path.slice(1)) {
    for (let attempt = 0; attempt < 3 && !level.hero.feet.equals(next); attempt++) {
      events.push(...level.tick(Heading.toward(next.x - level.hero.feet.x, next.y - level.hero.feet.y)));
    }
    expect(level.hero.feet.equals(next), 'the collision-checked path must be playable through Level.tick').toBe(true);
  }
  level.tick(null);
  return events;
}

// The gate opens only from its approach while she faces it, so she walks there and turns up first.
export function openGate(level: Level): void {
  const gate = level.gate!;
  const path = pathTo(level, (tile) => tile.equals(gate.approach));
  expect(path, 'the gate approach must be reachable').toBeDefined();
  follow(level, path!);
  level.tick(Heading.of(Direction.Up));
  level.tick(null);
  expect(level.operateGate(), 'she must be able to operate the gate from its approach').not.toEqual([]);
  level.finishGate();
}
