import type { Orb, Star } from '../domain/level/collectibles';
import type { Door } from '../domain/level/door';
import type { HeroState } from '../domain/level/hero';
import type { Level, Stone } from '../domain/level/level';
import type { LevelId } from '../domain/level/level-id';
import type { Scenery } from '../domain/level/scenery';
import type { Signpost } from '../domain/level/signpost';

export interface LevelView {
  readonly id: LevelId;
  readonly scenery: Scenery;
  readonly stones: readonly Stone[];
  readonly orbs: readonly Orb[];
  readonly stars: readonly Star[];
  readonly collected: readonly Star[];
  readonly signposts: readonly Signpost[];
  readonly door: Door;
  readonly hero: HeroState;
  readonly isComplete: boolean;
}

export function levelView(level: Level): LevelView {
  return {
    id: level.id,
    scenery: level.scenery,
    stones: [...level.stones],
    orbs: [...level.orbs],
    stars: [...level.stars],
    collected: [...level.collected],
    signposts: [...level.signposts],
    door: level.door,
    hero: level.hero,
    isComplete: level.isComplete,
  };
}
