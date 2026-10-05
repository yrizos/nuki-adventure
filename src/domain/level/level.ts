import { Hero } from './hero';
import { Direction, TilePosition } from './position';
import { Scenery } from './scenery';

export class LevelId {
  private constructor(readonly value: string) {}

  static of(value: string): LevelId {
    if (value.trim() === '') throw new RangeError('A level id cannot be empty');
    return new LevelId(value);
  }

  equals(other: LevelId): boolean {
    return this.value === other.value;
  }
}

export class OrbColor {
  static readonly Red = new OrbColor('red');
  static readonly Blue = new OrbColor('blue');
  static readonly Violet = new OrbColor('violet');
  static readonly Teal = new OrbColor('teal');

  private constructor(readonly name: 'red' | 'blue' | 'violet' | 'teal') {}

  equals(other: OrbColor): boolean {
    return this === other;
  }
}

export class Orb {
  private constructor(
    readonly position: TilePosition,
    readonly color: OrbColor,
  ) {}

  static at(position: TilePosition, color: OrbColor): Orb {
    return new Orb(position, color);
  }

  equals(other: Orb): boolean {
    return this.position.equals(other.position) && this.color.equals(other.color);
  }
}

export class Stone {
  private constructor(readonly position: TilePosition) {}

  static at(position: TilePosition): Stone {
    return new Stone(position);
  }

  equals(other: Stone): boolean {
    return this.position.equals(other.position);
  }
}

export class Door {
  private constructor(
    readonly left: TilePosition,
    readonly isOpen: boolean,
  ) {}

  static closedAt(left: TilePosition): Door {
    return new Door(left, false);
  }

  get footprint(): readonly TilePosition[] {
    const middle = this.left.neighbor(Direction.Right);
    return [this.left, middle, middle.neighbor(Direction.Right)];
  }

  covers(position: TilePosition): boolean {
    return this.footprint.some((tile) => tile.equals(position));
  }

  opened(): Door {
    return new Door(this.left, true);
  }

  equals(other: Door): boolean {
    return this.left.equals(other.left) && this.isOpen === other.isOpen;
  }
}

export class OrbCollected {
  constructor(
    readonly levelId: LevelId,
    readonly position: TilePosition,
    readonly color: OrbColor,
  ) {}
}

export class LevelCompleted {
  constructor(readonly levelId: LevelId) {}
}

export type LevelEvent = OrbCollected | LevelCompleted;

export class Level {
  private remainingOrb: Orb | null;
  private currentDoor: Door;
  private completed = false;

  constructor(
    readonly id: LevelId,
    readonly scenery: Scenery,
    readonly stones: readonly Stone[],
    orb: Orb,
    door: Door,
    readonly hero: Hero,
  ) {
    for (const stone of stones) {
      if (!scenery.isWalkable(stone.position)) {
        throw new RangeError(`A stone needs open ground, at ${stone.position.column}, ${stone.position.row}`);
      }
    }
    if (door.footprint.some((tile) => !scenery.isWalkable(tile) || stones.some((stone) => stone.position.equals(tile)))) {
      throw new RangeError('The door needs open ground across its whole width');
    }
    this.currentDoor = door;
    if (!this.canEnter(orb.position)) throw new RangeError('The orb must lie where the hero can reach it');
    if (!this.canEnter(hero.position)) throw new RangeError('The hero must start on open ground');
    this.remainingOrb = orb;
  }

  get orb(): Orb | null {
    return this.remainingOrb;
  }

  get door(): Door {
    return this.currentDoor;
  }

  get isComplete(): boolean {
    return this.completed;
  }

  tick(direction: Direction | null): readonly LevelEvent[] {
    if (this.completed) return [];
    const arrival = this.hero.advance();
    if (arrival && this.remainingOrb && arrival.equals(this.remainingOrb.position)) {
      const color = this.remainingOrb.color;
      this.remainingOrb = null;
      this.currentDoor = this.currentDoor.opened();
      return [new OrbCollected(this.id, arrival, color)];
    }
    if (arrival && this.currentDoor.covers(arrival)) {
      this.completed = true;
      return [new LevelCompleted(this.id)];
    }
    this.hero.steer(direction, (position) => this.canEnter(position));
    return [];
  }

  private canEnter(position: TilePosition): boolean {
    return (
      this.scenery.isWalkable(position) &&
      !this.stones.some((stone) => stone.position.equals(position)) &&
      (this.currentDoor.isOpen || !this.currentDoor.covers(position))
    );
  }
}
