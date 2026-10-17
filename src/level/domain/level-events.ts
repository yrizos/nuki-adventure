import type { Area } from './collectibles';
import type { LevelId } from './level-id';
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

export class SwingGateClosingStarted {
  constructor(
    readonly levelId: LevelId,
    readonly position: TilePosition,
  ) {}
}

export class SwingGateClosed {
  constructor(
    readonly levelId: LevelId,
    readonly position: TilePosition,
  ) {}
}

export class SwingGateStuck {
  constructor(
    readonly levelId: LevelId,
    readonly position: TilePosition,
  ) {}
}

export class PlatePressed {
  constructor(
    readonly levelId: LevelId,
    readonly position: TilePosition,
  ) {}
}

export class PlateReleased {
  constructor(
    readonly levelId: LevelId,
    readonly position: TilePosition,
  ) {}
}

export type LevelEvent =
  | KeyCollected
  | StarCollected
  | LevelCompleted
  | SwingGateOpeningStarted
  | SwingGateOpened
  | SwingGateClosingStarted
  | SwingGateClosed
  | SwingGateStuck
  | PlatePressed
  | PlateReleased;
