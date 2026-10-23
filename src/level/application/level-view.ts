import type { Boulder } from '../domain/boulder';
import type { Area, Orb } from '../domain/collectibles';
import type { Door } from '../domain/door';
import type { HeroState } from '../domain/hero';
import type { Level, Stone } from '../domain/level';
import type { LevelId } from '../domain/level-id';
import type { LevelAction } from '../domain/level-action';
import type { Outline } from '../domain/obstacles';
import type { Scenery } from '../domain/scenery';
import type { TilePosition } from '../domain/position';
import type { SwingGate } from '../domain/swing-gate';

export interface LevelView {
  readonly id: LevelId;
  readonly scenery: Scenery;
  readonly stones: readonly Stone[];
  readonly orbs: readonly Orb[];
  readonly restored: readonly Area[];
  readonly door: Door;
  readonly gates: readonly SwingGate[];
  readonly plate: TilePosition | undefined;
  readonly isPlateDown: boolean;
  readonly operableGate: SwingGate | undefined;
  readonly canOperateGate: boolean;
  readonly canGrip: boolean;
  readonly grippableBoulder: Boulder | undefined;
  readonly isGripping: boolean;
  readonly boulders: readonly Boulder[];
  readonly actions: readonly LevelAction[];
  readonly hero: HeroState;
  readonly isComplete: boolean;
  readonly outlines: readonly Outline[];
}

export function levelView(level: Level): LevelView {
  return {
    id: level.id,
    scenery: level.scenery,
    stones: [...level.stones],
    orbs: [...level.orbs],
    restored: level.restored,
    door: level.door,
    gates: level.gates,
    plate: level.plate,
    isPlateDown: level.isPlateDown,
    operableGate: level.operableGate,
    canOperateGate: level.canOperateGate,
    canGrip: level.canGrip,
    grippableBoulder: level.grippableBoulder,
    isGripping: level.isGripping,
    boulders: [...level.boulders],
    actions: level.actions,
    hero: level.hero,
    isComplete: level.isComplete,
    outlines: level.outlines,
  };
}
