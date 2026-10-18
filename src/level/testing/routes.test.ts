import { expect, test } from 'vitest';
import { check2dObstacles } from '../infrastructure/check2d-obstacles';
import { TilePosition } from '../domain/position';
import { LevelId } from '../domain/level-id';
import { levelFromLayout } from '../content/level-layout';
import { explorationArea, mandatoryRoute } from './routes';
import { keepOrder, lowestRoll } from './draws';

const at = TilePosition.at;
const level = levelFromLayout(
  LevelId.of('routes'),
  ['DDD....', '.......', 'Q......', 'H......', '...WWWW', '.......'],
  keepOrder,
  check2dObstacles,
  lowestRoll,
);

test('walks the shortest way from the start through the permanent orb to the door', () => {
  expect(mandatoryRoute(level).tiles).toEqual([at(0, 1), at(0, 2), at(0, 3)]);
});

test('includes every tile of equally short walks', () => {
  const tied = levelFromLayout(
    LevelId.of('tied'),
    ['DDD....', '.......', 'Q......', '.H.....', '.......', '.......', '.......', '.......'],
    keepOrder,
    check2dObstacles,
    lowestRoll,
  );
  expect(mandatoryRoute(tied).tiles).toEqual([at(0, 1), at(0, 2), at(1, 2), at(0, 3), at(1, 3)]);
});

test('counts only tiles at least three steps from the route as exploration area', () => {
  const area = explorationArea(level);
  expect(area.covers(at(2, 1))).toBe(false);
  expect(area.covers(at(3, 1))).toBe(true);
  expect(area.covers(at(3, 5))).toBe(true);
  expect(area.covers(at(0, 5))).toBe(false);
});
