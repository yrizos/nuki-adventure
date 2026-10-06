import type { Area, OrbColor } from './collectibles';
import type { LevelId } from './level-id';
import type { TilePosition } from './position';
import type { SignpostText } from './signpost';

export class OrbCollected {
  constructor(
    readonly levelId: LevelId,
    readonly position: TilePosition,
    readonly color: OrbColor,
    readonly restores: Area,
  ) {}
}

export class StarCollected {
  constructor(
    readonly levelId: LevelId,
    readonly position: TilePosition,
  ) {}
}

export class SignpostRead {
  constructor(
    readonly levelId: LevelId,
    readonly position: TilePosition,
    readonly text: SignpostText,
  ) {}
}

export class SignpostLeft {
  constructor(readonly levelId: LevelId) {}
}

export class LevelCompleted {
  constructor(readonly levelId: LevelId) {}
}

export type LevelEvent = OrbCollected | StarCollected | SignpostRead | SignpostLeft | LevelCompleted;
