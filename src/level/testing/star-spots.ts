import type { Level } from '../domain/level';
import type { PlaceObstacles } from '../domain/obstacles';
import type { TilePosition } from '../domain/position';
import type { Shuffle } from '../domain/shuffle';
import { check2dObstacles } from '../infrastructure/check2d-obstacles';

export const keepOrder: Shuffle = (positions) => positions;
export const reverseOrder: Shuffle = (positions) => [...positions].reverse();

export function starSpotsOf(
  create: (shuffle: Shuffle, placeObstacles: PlaceObstacles) => Level,
): readonly TilePosition[] {
  let offered: readonly TilePosition[] = [];
  create((positions) => (offered = positions), check2dObstacles);
  return offered;
}
