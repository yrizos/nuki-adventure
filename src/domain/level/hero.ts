import { Direction, TilePosition } from './position';

export class Step {
  static readonly framesPerTile = 16;

  private constructor(
    readonly direction: Direction,
    readonly framesTaken: number,
  ) {}

  static begin(direction: Direction): Step {
    return new Step(direction, 0);
  }

  advanced(): Step {
    return new Step(this.direction, this.framesTaken + 1);
  }

  get duration(): number {
    return Math.ceil(Step.framesPerTile * (this.direction.isDiagonal ? Math.SQRT2 : 1));
  }

  get isComplete(): boolean {
    return this.framesTaken >= this.duration;
  }
}

// Holding the new facing before moving lets a quick tap turn the hero without walking her into a neighbor tile.
export class TurnPause {
  private constructor(readonly framesLeft: number) {}

  static begin(): TurnPause {
    return new TurnPause(2);
  }

  next(): TurnPause | null {
    return this.framesLeft > 1 ? new TurnPause(this.framesLeft - 1) : null;
  }
}

export class Hero {
  private turnPause: TurnPause | null = null;
  private currentStep: Step | null = null;

  constructor(
    private currentPosition: TilePosition,
    private currentFacing: Direction,
  ) {}

  get position(): TilePosition {
    return this.currentPosition;
  }

  get facing(): Direction {
    return this.currentFacing;
  }

  get step(): Step | null {
    return this.currentStep;
  }

  advance(): TilePosition | null {
    if (!this.currentStep) return null;
    const step = this.currentStep.advanced();
    if (!step.isComplete) {
      this.currentStep = step;
      return null;
    }
    this.currentPosition = this.currentPosition.neighbor(step.direction);
    this.currentStep = null;
    return this.currentPosition;
  }

  steer(direction: Direction | null, canEnter: (position: TilePosition) => boolean): void {
    if (this.currentStep) return;
    if (!direction) {
      this.turnPause = null;
      return;
    }
    if (!direction.facing.equals(this.currentFacing)) {
      this.currentFacing = direction.facing;
      this.turnPause = TurnPause.begin();
      return;
    }
    if (this.turnPause) {
      this.turnPause = this.turnPause.next();
      if (this.turnPause) return;
    }
    if (
      direction.isDiagonal &&
      (!canEnter(this.currentPosition.neighbor(direction.horizontal!)) ||
        !canEnter(this.currentPosition.neighbor(direction.vertical!)))
    )
      return;
    if (canEnter(this.currentPosition.neighbor(direction))) this.currentStep = Step.begin(direction);
  }
}
