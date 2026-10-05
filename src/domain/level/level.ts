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

export class Star {
  private constructor(readonly position: TilePosition) {}

  static at(position: TilePosition): Star {
    return new Star(position);
  }

  equals(other: Star): boolean {
    return this.position.equals(other.position);
  }
}

export class Signpost {
  private constructor(readonly position: TilePosition) {}

  static at(position: TilePosition): Signpost {
    return new Signpost(position);
  }

  // The board is read from the side or from in front, so standing on any of the four touching tiles is enough.
  isBeside(position: TilePosition): boolean {
    return [Direction.Up, Direction.Down, Direction.Left, Direction.Right].some((direction) => this.position.neighbor(direction).equals(position));
  }

  equals(other: Signpost): boolean {
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
  ) {}
}

export class SignpostLeft {
  constructor(readonly levelId: LevelId) {}
}

export class LevelCompleted {
  constructor(readonly levelId: LevelId) {}
}

export type LevelEvent = OrbCollected | StarCollected | SignpostRead | SignpostLeft | LevelCompleted;

export class Level {
  private remainingOrb: Orb | null;
  private currentDoor: Door;
  private completed = false;
  private remainingStars: readonly Star[];
  private collectedStars: readonly Star[] = [];
  private reading = false;

  constructor(
    readonly id: LevelId,
    readonly scenery: Scenery,
    readonly stones: readonly Stone[],
    orb: Orb,
    door: Door,
    readonly hero: Hero,
    stars: readonly Star[] = [],
    readonly signpost: Signpost | null = null,
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
    if (signpost && (!scenery.isWalkable(signpost.position) || door.covers(signpost.position) ||
      stones.some((stone) => stone.position.equals(signpost.position)))) {
      throw new RangeError(`A signpost needs open ground of its own, at ${signpost.position.column}, ${signpost.position.row}`);
    }
    if (!this.canEnter(orb.position)) throw new RangeError('The orb must lie where the hero can reach it');
    if (!this.canEnter(hero.position)) throw new RangeError('The hero must start on open ground');
    stars.forEach((star, index) => {
      if (!this.canEnter(star.position)) throw new RangeError('Every star must lie where the hero can reach it');
      if (scenery.trees.some((tree) => tree.hides(star.position))) {
        throw new RangeError(`A star must stay visible, not behind a tree, at ${star.position.column}, ${star.position.row}`);
      }
      if (star.position.equals(orb.position) || stars.findIndex((other) => other.equals(star)) !== index) {
        throw new RangeError(`A star needs a tile of its own, at ${star.position.column}, ${star.position.row}`);
      }
    });
    this.remainingOrb = orb;
    this.remainingStars = [...stars];
  }

  get stars(): readonly Star[] {
    return this.remainingStars;
  }

  get collected(): readonly Star[] {
    return this.collectedStars;
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

  read(): readonly LevelEvent[] {
    if (this.completed || !this.signpost || this.hero.step || !this.signpost.isBeside(this.hero.position)) return [];
    this.reading = true;
    return [new SignpostRead(this.id, this.signpost.position)];
  }

  tick(direction: Direction | null): readonly LevelEvent[] {
    if (this.completed) return [];
    const arrival = this.hero.advance();
    const events: LevelEvent[] = [];
    const star = arrival && this.remainingStars.find((candidate) => candidate.position.equals(arrival));
    if (star) {
      this.remainingStars = this.remainingStars.filter((candidate) => candidate !== star);
      this.collectedStars = [...this.collectedStars, star];
      events.push(new StarCollected(this.id, star.position));
    }
    if (arrival && this.remainingOrb && arrival.equals(this.remainingOrb.position)) {
      const color = this.remainingOrb.color;
      this.remainingOrb = null;
      this.currentDoor = this.currentDoor.opened();
      return [...events, new OrbCollected(this.id, arrival, color)];
    }
    if (arrival && this.currentDoor.covers(arrival)) {
      this.completed = true;
      return [...events, new LevelCompleted(this.id)];
    }
    this.hero.steer(direction, (position) => this.canEnter(position));
    const leaving = this.hero.step && !this.signpost?.isBeside(this.hero.position.neighbor(this.hero.step.direction));
    if (this.reading && leaving) {
      this.reading = false;
      events.push(new SignpostLeft(this.id));
    }
    return events;
  }

  private canEnter(position: TilePosition): boolean {
    return (
      this.scenery.isWalkable(position) &&
      !this.stones.some((stone) => stone.position.equals(position)) &&
      !this.signpost?.position.equals(position) &&
      (this.currentDoor.isOpen || !this.currentDoor.covers(position))
    );
  }
}
