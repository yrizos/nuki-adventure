import type { Level } from '../domain/level/level';
import type { TilePosition } from '../domain/level/position';

type Shuffle = (positions: readonly TilePosition[]) => readonly TilePosition[];

export const keepOrder: Shuffle = (positions) => positions;
export const reverseOrder: Shuffle = (positions) => [...positions].reverse();

export function starSpotsOf(create: (shuffle: Shuffle) => Level): readonly TilePosition[] {
  let offered: readonly TilePosition[] = [];
  create((positions) => (offered = positions));
  return offered;
}
