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

export class Area {
  private readonly keys: ReadonlySet<string>;

  private constructor(readonly tiles: readonly TilePosition[]) {
    this.keys = new Set(tiles.map((tile) => `${tile.column},${tile.row}`));
  }

  static of(tiles: readonly TilePosition[]): Area {
    const area = new Area([...tiles]);
    if (tiles.length === 0) throw new RangeError('An area needs at least one tile');
    if (area.keys.size !== tiles.length) throw new RangeError('An area holds each tile only once');
    return area;
  }

  covers(position: TilePosition): boolean {
    return this.keys.has(`${position.column},${position.row}`);
  }

  equals(other: Area): boolean {
    return this.tiles.length === other.tiles.length && this.tiles.every((tile) => other.covers(tile));
  }
}

export class Orb {
  private constructor(
    readonly position: TilePosition,
    readonly color: OrbColor,
    readonly restores: Area,
  ) {}

  static at(position: TilePosition, color: OrbColor, restores: Area): Orb {
    return new Orb(position, color, restores);
  }

  equals(other: Orb): boolean {
    return (
      this.position.equals(other.position) && this.color.equals(other.color) && this.restores.equals(other.restores)
    );
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

export class StarCount {
  private constructor(readonly value: number) {}

  static of(value: number): StarCount {
    if (!Number.isInteger(value) || value < 0)
      throw new RangeError(`A star count needs a whole number of zero or more, got ${value}`);
    return new StarCount(value);
  }

  equals(other: StarCount): boolean {
    return this.value === other.value;
  }
}

export class SignpostText {
  private constructor(readonly value: string) {}

  static of(value: string): SignpostText {
    if (value.trim() === '') throw new RangeError('A signpost needs something written on it');
    return new SignpostText(value);
  }

  equals(other: SignpostText): boolean {
    return this.value === other.value;
  }
}

export class Signpost {
  private constructor(
    readonly position: TilePosition,
    readonly text: SignpostText,
  ) {}

  static at(position: TilePosition, text: SignpostText): Signpost {
    return new Signpost(position, text);
  }

  // The board is read from the side or from in front, so standing on any of the four touching tiles is enough.
  isBeside(position: TilePosition): boolean {
    return [Direction.Up, Direction.Down, Direction.Left, Direction.Right].some((direction) =>
      this.position.neighbor(direction).equals(position),
    );
  }

  equals(other: Signpost): boolean {
    return this.position.equals(other.position) && this.text.equals(other.text);
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

  // The door stands three tiles tall, so whatever lies on the two tiles above its footprint is drawn behind it.
  hides(position: TilePosition): boolean {
    const below = position.neighbor(Direction.Down);
    return this.covers(below) || this.covers(below.neighbor(Direction.Down));
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

export class Level {
  private remainingOrbs: readonly Orb[];
  private currentDoor: Door;
  private completed = false;
  private remainingStars: readonly Star[];
  private collectedStars: readonly Star[] = [];
  private reading: Signpost | null = null;

  constructor(
    readonly id: LevelId,
    readonly scenery: Scenery,
    readonly stones: readonly Stone[],
    orbs: readonly Orb[],
    door: Door,
    readonly hero: Hero,
    stars: readonly Star[] = [],
    readonly signposts: readonly Signpost[] = [],
  ) {
    for (const stone of stones) {
      if (!scenery.isWalkable(stone.position)) {
        throw new RangeError(`A stone needs open ground, at ${stone.position.column}, ${stone.position.row}`);
      }
    }
    if (
      door.footprint.some((tile) => !scenery.isWalkable(tile) || stones.some((stone) => stone.position.equals(tile)))
    ) {
      throw new RangeError('The door needs open ground across its whole width');
    }
    this.currentDoor = door;
    signposts.forEach((signpost, index) => {
      const { position } = signpost;
      if (
        !scenery.isWalkable(position) ||
        door.covers(position) ||
        stones.some((stone) => stone.position.equals(position)) ||
        signposts.findIndex((other) => other.position.equals(position)) !== index
      ) {
        throw new RangeError(`A signpost needs open ground of its own, at ${position.column}, ${position.row}`);
      }
    });
    if (orbs.length === 0) throw new RangeError('A level needs at least one orb to open its door');
    for (let row = 0; row < scenery.size.rows; row++) {
      for (let column = 0; column < scenery.size.columns; column++) {
        if (!orbs.some((orb) => orb.restores.covers(TilePosition.at(column, row)))) {
          throw new RangeError(`The orbs of a level must together restore every tile, but not ${column}, ${row}`);
        }
      }
    }
    orbs.forEach((orb, index) => {
      if (!this.canEnter(orb.position)) throw new RangeError('Every orb must lie where the hero can reach it');
      if (orbs.findIndex((other) => other.position.equals(orb.position)) !== index) {
        throw new RangeError(`An orb needs a tile of its own, at ${orb.position.column}, ${orb.position.row}`);
      }
    });
    if (!this.canEnter(hero.position)) throw new RangeError('The hero must start on open ground');
    const reachable = this.reachableTiles();
    stars.forEach((star, index) => {
      if (!reachable.some((tile) => tile.equals(star.position)))
        throw new RangeError('Every star must lie where the hero can reach it');
      if (this.hides(star.position)) {
        throw new RangeError(
          `A star must stay visible, not behind a tree or the door, at ${star.position.column}, ${star.position.row}`,
        );
      }
      if (
        orbs.some((orb) => orb.position.equals(star.position)) ||
        stars.findIndex((other) => other.equals(star)) !== index
      ) {
        throw new RangeError(`A star needs a tile of its own, at ${star.position.column}, ${star.position.row}`);
      }
    });
    this.remainingOrbs = [...orbs];
    this.remainingStars = [...stars];
  }

  static withScatteredStars(
    id: LevelId,
    scenery: Scenery,
    stones: readonly Stone[],
    orbs: readonly Orb[],
    door: Door,
    hero: Hero,
    starCount: StarCount,
    signposts: readonly Signpost[],
    shuffle: (positions: readonly TilePosition[]) => readonly TilePosition[],
  ): Level {
    const empty = new Level(id, scenery, stones, orbs, door, hero, [], signposts);
    const spots = empty
      .reachableTiles()
      .filter(
        (tile) => !empty.hides(tile) && !orbs.some((orb) => orb.position.equals(tile)) && !tile.equals(hero.position),
      );
    if (spots.length < starCount.value) {
      throw new RangeError(`The level has room for ${spots.length} visible, reachable stars, not ${starCount.value}`);
    }
    return new Level(
      id,
      scenery,
      stones,
      orbs,
      door,
      hero,
      shuffle(spots).slice(0, starCount.value).map(Star.at),
      signposts,
    );
  }

  get stars(): readonly Star[] {
    return this.remainingStars;
  }

  get collected(): readonly Star[] {
    return this.collectedStars;
  }

  get orbs(): readonly Orb[] {
    return this.remainingOrbs;
  }

  get door(): Door {
    return this.currentDoor;
  }

  get isComplete(): boolean {
    return this.completed;
  }

  read(): readonly LevelEvent[] {
    if (this.completed || this.hero.step) return [];
    const signpost = this.signposts.find((candidate) => candidate.isBeside(this.hero.position));
    if (!signpost) return [];
    this.reading = signpost;
    return [new SignpostRead(this.id, signpost.position, signpost.text)];
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
    const orb = arrival && this.remainingOrbs.find((candidate) => candidate.position.equals(arrival));
    if (orb) {
      this.remainingOrbs = this.remainingOrbs.filter((candidate) => candidate !== orb);
      if (this.remainingOrbs.length === 0) this.currentDoor = this.currentDoor.opened();
      return [...events, new OrbCollected(this.id, orb.position, orb.color, orb.restores)];
    }
    if (arrival && this.currentDoor.covers(arrival)) {
      this.completed = true;
      return [...events, new LevelCompleted(this.id)];
    }
    this.hero.steer(direction, (position) => this.canEnter(position));
    const leaving = this.hero.step && !this.reading?.isBeside(this.hero.position.neighbor(this.hero.step.direction));
    if (this.reading && leaving) {
      this.reading = null;
      events.push(new SignpostLeft(this.id));
    }
    return events;
  }

  // Diagonal steps need both straight neighbors open, so straight steps alone reach every tile the hero can.
  // The door counts as closed because stepping onto it ends the level.
  private reachableTiles(): readonly TilePosition[] {
    const reached = [this.hero.position];
    for (let index = 0; index < reached.length; index++) {
      for (const direction of [Direction.Up, Direction.Down, Direction.Left, Direction.Right]) {
        const next = reached[index]!.neighbor(direction);
        if (this.canEnter(next) && !this.currentDoor.covers(next) && !reached.some((tile) => tile.equals(next)))
          reached.push(next);
      }
    }
    return reached;
  }

  private hides(position: TilePosition): boolean {
    return this.scenery.trees.some((tree) => tree.hides(position)) || this.currentDoor.hides(position);
  }

  private canEnter(position: TilePosition): boolean {
    return (
      this.scenery.isWalkable(position) &&
      !this.stones.some((stone) => stone.position.equals(position)) &&
      !this.signposts.some((signpost) => signpost.position.equals(position)) &&
      (this.currentDoor.isOpen || !this.currentDoor.covers(position))
    );
  }
}
