import type { Direction, TilePosition, WorldPosition } from './position';

// Only what play can change while nothing moves, so the door, the plate and her grip follow from it instead of contradicting it.
export interface LevelSnapshot {
  readonly hero: { readonly feet: WorldPosition; readonly facing: Direction };
  readonly stars: readonly TilePosition[];
  readonly collectedStars: readonly TilePosition[];
  readonly collectedKeys: readonly TilePosition[];
  // Gates and boulders are listed in the order the level defines them.
  readonly gates: readonly ('open' | 'closed')[];
  readonly boulders: readonly TilePosition[];
}
