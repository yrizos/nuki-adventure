import type { Area } from './collectibles';
import type { LevelId } from './level-id';
import type { TilePosition } from './position';

export class OrbCollected {
  constructor(
    readonly levelId: LevelId,
    readonly position: TilePosition,
    readonly restores: Area,
    readonly last: boolean,
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
  | OrbCollected
  | LevelCompleted
  | SwingGateOpeningStarted
  | SwingGateOpened
  | SwingGateClosingStarted
  | SwingGateClosed
  | SwingGateStuck
  | PlatePressed
  | PlateReleased;
