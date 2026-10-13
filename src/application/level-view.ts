import type { Boulder } from '../domain/level/boulder';
import type { Area, Key, Star } from '../domain/level/collectibles';
import type { Door } from '../domain/level/door';
import type { HeroState } from '../domain/level/hero';
import type { Level, Stone } from '../domain/level/level';
import type { LevelId } from '../domain/shared/level-id';
import type { LevelAction } from '../domain/level/level-action';
import type { Outline } from '../domain/level/obstacles';
import type { Scenery } from '../domain/level/scenery';
import type { TilePosition } from '../domain/level/position';
import type { SwingGate } from '../domain/level/swing-gate';

export interface LevelView {
  readonly id: LevelId;
  readonly scenery: Scenery;
  readonly stones: readonly Stone[];
  readonly keys: readonly Key[];
  readonly restored: readonly Area[];
  readonly stars: readonly Star[];
  readonly collected: readonly Star[];
  readonly door: Door;
  readonly gate: SwingGate | undefined;
  readonly plate: TilePosition | undefined;
  readonly isPlateDown: boolean;
  readonly canOperateGate: boolean;
  readonly canGrip: boolean;
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
    keys: [...level.keys],
    restored: level.restored,
    stars: [...level.stars],
    collected: [...level.collected],
    door: level.door,
    gate: level.gate,
    plate: level.plate,
    isPlateDown: level.isPlateDown,
    canOperateGate: level.canOperateGate,
    canGrip: level.canGrip,
    isGripping: level.isGripping,
    boulders: [...level.boulders],
    actions: level.actions,
    hero: level.hero,
    isComplete: level.isComplete,
    outlines: level.outlines,
  };
}
