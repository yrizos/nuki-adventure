import type { Random } from '../domain/random';
import type { Shuffle } from '../domain/shuffle';

export const keepOrder: Shuffle = (positions) => positions;
export const reverseOrder: Shuffle = (positions) => [...positions].reverse();

// Every roll comes out lowest, so a level gets its fewest orbs with the smallest circles at the first open spot.
export const lowestRoll: Random = () => 0;

// A small fixed-seed generator, so a test can sweep many different plays and still repeat each one exactly.
export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}
