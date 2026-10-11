import type { Area } from './collectibles';
import type { LevelId } from '../shared/level-id';
import type { TilePosition } from './position';
import type { SignpostText } from './signpost';

export class KeyCollected {
  constructor(
    readonly levelId: LevelId,
    readonly position: TilePosition,
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

export type LevelEvent = KeyCollected | StarCollected | SignpostRead | SignpostLeft | LevelCompleted;
