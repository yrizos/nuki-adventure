import type { Area } from './collectibles';
import type { LevelId } from '../shared/level-id';
import type { TilePosition } from './position';

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

export class LevelCompleted {
  constructor(readonly levelId: LevelId) {}
}

export class SwingGateOpeningStarted {
  constructor(
    readonly levelId: LevelId,
    readonly position: TilePosition,
  ) {}
}

export class SwingGateOpened {
  constructor(
    readonly levelId: LevelId,
    readonly position: TilePosition,
  ) {}
}

export type LevelEvent = KeyCollected | StarCollected | LevelCompleted | SwingGateOpeningStarted | SwingGateOpened;
