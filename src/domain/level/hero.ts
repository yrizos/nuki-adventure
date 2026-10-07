import { type Obstacles, Outline } from './obstacles';
import { Direction, type Heading, type TilePosition, WorldPosition } from './position';

const pixelsPerTick = 2;
// A heading this far past the diagonal still keeps her facing, so a thumb resting on the diagonal does not flip the sprite.
const facingTolerance = Math.cos((55 * Math.PI) / 180);
export const feet = Outline.oval(WorldPosition.at(0, 0), 14, 6);

// Holding the new facing before moving lets a quick tap turn the hero without walking her away.
export class TurnPause {
  private constructor(readonly framesLeft: number) {}

  static begin(): TurnPause {
    return new TurnPause(2);
  }

  next(): TurnPause | null {
    return this.framesLeft > 1 ? new TurnPause(this.framesLeft - 1) : null;
  }
}

export class HeroState {
  private constructor(
    readonly feet: WorldPosition,
    readonly facing: Direction,
    readonly isWalking: boolean,
    readonly previousFeet: WorldPosition,
  ) {}

  static of(feet: WorldPosition, facing: Direction, isWalking: boolean, previousFeet = feet): HeroState {
    return new HeroState(feet, facing, isWalking, previousFeet);
  }

  // A display can refresh between two ticks, so it shows her part of the way along her last move.
  between(progress: number): HeroState {
    if (!(progress >= 0 && progress <= 1))
      throw new RangeError(`Progress between ticks runs from 0 to 1, got ${progress}`);
    const { x, y } = this.previousFeet;
    const feet = WorldPosition.at(x + (this.feet.x - x) * progress, y + (this.feet.y - y) * progress);
    return new HeroState(feet, this.facing, this.isWalking, this.previousFeet);
  }

  get position(): TilePosition {
    return this.feet.tile;
  }
}

export class Hero {
  private turnPause: TurnPause | null = null;
  private walking = false;
  private currentFeet: WorldPosition;
  private previousFeet: WorldPosition;

  constructor(
    start: TilePosition,
    private currentFacing: Direction,
  ) {
    this.currentFeet = Hero.feetOn(start);
    this.previousFeet = this.currentFeet;
  }

  static feetOn(tile: TilePosition): WorldPosition {
    return WorldPosition.within(tile, 16, 28);
  }

  get position(): TilePosition {
    return this.currentFeet.tile;
  }

  get isWalking(): boolean {
    return this.walking;
  }

  get state(): HeroState {
    return HeroState.of(this.currentFeet, this.currentFacing, this.walking, this.previousFeet);
  }

  steer(heading: Heading | null, obstacles: Obstacles): void {
    this.previousFeet = this.currentFeet;
    if (!heading) {
      this.walking = false;
      this.turnPause = null;
      return;
    }
    const facing = this.facingFor(heading);
    if (!facing.equals(this.currentFacing)) {
      this.currentFacing = facing;
      if (!this.walking) {
        this.turnPause = TurnPause.begin();
        return;
      }
    }
    if (this.turnPause) {
      this.turnPause = this.turnPause.next();
      if (this.turnPause) return;
    }
    this.currentFeet = obstacles.walk(feet.at(this.currentFeet), this.currentFeet.moved(heading, pixelsPerTick));
    this.walking = true;
  }

  private facingFor(heading: Heading): Direction {
    if (heading.alignment(this.currentFacing) > facingTolerance) return this.currentFacing;
    if (Math.abs(heading.x) > Math.abs(heading.y)) return heading.x > 0 ? Direction.Right : Direction.Left;
    return heading.y > 0 ? Direction.Down : Direction.Up;
  }
}
