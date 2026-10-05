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

export class LevelCompleted {
  constructor(
    readonly levelId: LevelId,
    readonly restorationOrigin: TilePosition,
    readonly collectedOrbColor: OrbColor,
  ) {}
}

export class Level {
  private remainingOrb: Orb | null;

  constructor(
    readonly id: LevelId,
    readonly scenery: Scenery,
    readonly stones: readonly Stone[],
    orb: Orb,
    readonly hero: Hero,
  ) {
    for (const stone of stones) {
      if (!scenery.isWalkable(stone.position)) {
        throw new RangeError(`A stone needs open ground, at ${stone.position.column}, ${stone.position.row}`);
      }
    }
    if (!this.canEnter(orb.position)) throw new RangeError('The orb must lie where the hero can reach it');
    if (!this.canEnter(hero.position)) throw new RangeError('The hero must start on open ground');
    this.remainingOrb = orb;
  }

  get orb(): Orb | null {
    return this.remainingOrb;
  }

  get isComplete(): boolean {
    return this.remainingOrb === null;
  }

  tick(direction: Direction | null): readonly LevelCompleted[] {
    if (!this.remainingOrb) return [];
    const arrival = this.hero.advance();
    if (arrival && arrival.equals(this.remainingOrb.position)) {
      const color = this.remainingOrb.color;
      this.remainingOrb = null;
      return [new LevelCompleted(this.id, arrival, color)];
    }
    this.hero.steer(direction, (position) => this.canEnter(position));
    return [];
  }

  private canEnter(position: TilePosition): boolean {
    return this.scenery.isWalkable(position) && !this.stones.some((stone) => stone.position.equals(position));
  }
}
