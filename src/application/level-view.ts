import type { Key, Star } from '../domain/level/collectibles';
import type { Door } from '../domain/level/door';
import type { HeroState } from '../domain/level/hero';
import type { Level, Stone } from '../domain/level/level';
import type { LevelId } from '../domain/shared/level-id';
import type { Outline } from '../domain/level/obstacles';
import type { Scenery } from '../domain/level/scenery';
import type { SwingGate } from '../domain/level/swing-gate';

export interface LevelView {
  readonly id: LevelId;
  readonly scenery: Scenery;
  readonly stones: readonly Stone[];
  readonly keys: readonly Key[];
  readonly stars: readonly Star[];
  readonly collected: readonly Star[];
  readonly door: Door;
  readonly gate: SwingGate | undefined;
  readonly canOperateGate: boolean;
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
    stars: [...level.stars],
    collected: [...level.collected],
    door: level.door,
    gate: level.gate,
    canOperateGate: level.canOperateGate,
    hero: level.hero,
    isComplete: level.isComplete,
    outlines: level.outlines,
  };
}
