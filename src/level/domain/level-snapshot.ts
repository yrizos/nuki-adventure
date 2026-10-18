import type { Direction, TilePosition, WorldPosition } from './position';

export interface PlacedOrb {
  readonly position: TilePosition;
  readonly radius: number;
}

// Only what play can change while nothing moves, so the door, the plate and her grip follow from it instead of contradicting it.
export interface LevelSnapshot {
  readonly hero: { readonly feet: WorldPosition; readonly facing: Direction };
  // Random orbs land elsewhere on every start, so the snapshot keeps where each orb lies and how far it restores.
  readonly orbs: readonly PlacedOrb[];
  readonly collectedOrbs: readonly PlacedOrb[];
  // Gates and boulders are listed in the order the level defines them.
  readonly gates: readonly ('open' | 'closed')[];
  readonly boulders: readonly TilePosition[];
}
