import { describe, expect, test } from 'vitest';
import { Outline, wholeTile } from '../domain/level/obstacles';
import { Heading, TilePosition, WorldPosition } from '../domain/level/position';
import { check2dObstacles } from './check2d-obstacles';

const feet = Outline.oval(WorldPosition.at(0, 0), 14, 6);

function walk(outlines: readonly Outline[], from: WorldPosition, heading: Heading, ticks: number): WorldPosition[] {
  const obstacles = check2dObstacles(outlines);
  const path = [from];
  for (let tick = 0; tick < ticks; tick++) {
    const here = path.at(-1)!;
    path.push(obstacles.walk(feet.at(here), here.moved(heading, 2)));
  }
  return path;
}

describe('walking among obstacles', () => {
  const up = Heading.toward(0, -1);
  const gap = (width: number): Outline[] => [
    Outline.box(WorldPosition.at(50 - width / 2 - 20, 50), 40, 20),
    Outline.box(WorldPosition.at(50 + width / 2 + 20, 50), 40, 20),
  ];

  test('cannot pass a gap narrower than her feet', () => {
    expect(walk(gap(12), WorldPosition.at(50, 80), up, 30).at(-1)!.y).toBeGreaterThan(60);
  });

  test('passes a gap wider than her feet', () => {
    expect(walk(gap(16), WorldPosition.at(50, 80), up, 30).at(-1)!.y).toBeLessThan(40);
  });

  test('keeps sliding along a row of separate tiles without catching on their seams', () => {
    const water = [0, 1, 2, 3, 4].map((column) => wholeTile(TilePosition.at(column, 1)));
    const path = walk(water, WorldPosition.at(16, 28), Heading.toward(1, 1), 40);
    path.slice(1).forEach((position, index) => {
      expect(position.x - path[index]!.x).toBeGreaterThan(1);
      expect(position.y + 3).toBeLessThanOrEqual(32.01);
    });
  });

  test('stays put rather than squeezing between obstacles that push opposite ways', () => {
    const obstacles = [Outline.oval(WorldPosition.at(48, 22), 22, 20), Outline.box(WorldPosition.at(64, 48), 200, 32)];
    const path = walk(obstacles, WorldPosition.at(16, 28), Heading.toward(1, 0), 40);
    expect(path.at(-1)!.x).toBeLessThan(48);
  });
});
