import { type Orb, Star, type StarCount } from './collectibles';
import type { Door } from './door';
import { Hero, type HeroState } from './hero';
import {
  LevelCompleted,
  type LevelEvent,
  OrbCollected,
  SignpostLeft,
  SignpostRead,
  StarCollected,
} from './level-events';
import type { LevelId } from './level-id';
import { Direction, TilePosition } from './position';
import type { Scenery } from './scenery';
import type { Signpost } from './signpost';

export class Stone {
  private constructor(readonly position: TilePosition) {}

  static at(position: TilePosition): Stone {
    return new Stone(position);
  }

  equals(other: Stone): boolean {
    return this.position.equals(other.position);
  }
}

export interface LevelDefinition {
  readonly id: LevelId;
  readonly scenery: Scenery;
  readonly stones: readonly Stone[];
  readonly orbs: readonly Orb[];
  readonly door: Door;
  readonly hero: { readonly position: TilePosition; readonly facing: Direction };
  readonly stars?: readonly Star[];
  readonly signposts?: readonly Signpost[];
}

export class Level {
  private readonly heroEntity: Hero;
  private remainingOrbs: readonly Orb[];
  private currentDoor: Door;
  private completed = false;
  private remainingStars: readonly Star[];
  private collectedStars: readonly Star[] = [];
  private reading: Signpost | null = null;

  readonly id: LevelId;
  readonly scenery: Scenery;
  readonly stones: readonly Stone[];
  readonly signposts: readonly Signpost[];

  private constructor({ id, scenery, stones, orbs, door, hero, stars = [], signposts = [] }: LevelDefinition) {
    this.id = id;
    this.scenery = scenery;
    this.stones = stones;
    this.heroEntity = new Hero(hero.position, hero.facing);
    this.signposts = signposts;
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

  static create(definition: LevelDefinition): Level {
    return new Level(definition);
  }

  static withScatteredStars(
    definition: Omit<LevelDefinition, 'stars'>,
    starCount: StarCount,
    shuffle: (positions: readonly TilePosition[]) => readonly TilePosition[],
  ): Level {
    const { orbs, hero } = definition;
    const empty = new Level({ ...definition, stars: [] });
    const spots = empty
      .reachableTiles()
      .filter(
        (tile) => !empty.hides(tile) && !orbs.some((orb) => orb.position.equals(tile)) && !tile.equals(hero.position),
      );
    if (spots.length < starCount.value) {
      throw new RangeError(`The level has room for ${spots.length} visible, reachable stars, not ${starCount.value}`);
    }
    return new Level({ ...definition, stars: shuffle(spots).slice(0, starCount.value).map(Star.at) });
  }

  get hero(): HeroState {
    return this.heroEntity.state;
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
    if (this.completed || this.heroEntity.step) return [];
    const signpost = this.signposts.find((candidate) => candidate.isBeside(this.heroEntity.position));
    if (!signpost) return [];
    this.reading = signpost;
    return [new SignpostRead(this.id, signpost.position, signpost.text)];
  }

  tick(direction: Direction | null): readonly LevelEvent[] {
    if (this.completed) return [];
    const arrival = this.heroEntity.advance();
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
    this.heroEntity.steer(direction, (position) => this.canEnter(position));
    const leaving =
      this.heroEntity.step &&
      !this.reading?.isBeside(this.heroEntity.position.neighbor(this.heroEntity.step.direction));
    if (this.reading && leaving) {
      this.reading = null;
      events.push(new SignpostLeft(this.id));
    }
    return events;
  }

  // Diagonal steps need both straight neighbors open, so straight steps alone reach every tile the hero can.
  // The door counts as closed because stepping onto it ends the level.
  private reachableTiles(): readonly TilePosition[] {
    const reached = [this.heroEntity.position];
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
