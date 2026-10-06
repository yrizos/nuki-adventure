import type { TilePosition } from '../domain/level/position';

export function randomShuffle(positions: readonly TilePosition[]): TilePosition[] {
  const result = [...positions];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other]!, result[index]!];
  }
  return result;
}
