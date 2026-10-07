import { type Orb, Star } from './collectibles';
import type { StarCount } from '../shared/star-count';
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
import type { LevelId } from '../shared/level-id';
import { type Obstacles, Outline, type PlaceObstacles } from './obstacles';
import { Direction, type Heading, TilePosition, WorldPosition } from './position';
import type { Scenery } from './scenery';
import type { Signpost } from './signpost';

export class Stone {
  private constructor(readonly position: TilePosition) {}

  static at(position: TilePosition): Stone {
    return new Stone(position);
  }

  get obstacle(): Outline {
    return Outline.oval(WorldPosition.within(this.position, 16, 22), 22, 20);
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
  readonly obstacles: PlaceObstacles;
}

export class Level {
  private readonly heroEntity: Hero;
  private remainingOrbs: readonly Orb[];
  private currentDoor: Door;
  private completed = false;
  private remainingStars: readonly Star[];
  private collectedStars: readonly Star[] = [];
  private reading: Signpost | null = null;
  private readonly placeObstacles: PlaceObstacles;
  private obstacles: Obstacles;
  private obstacleOutlines: readonly Outline[] = [];

  readonly id: LevelId;
  readonly scenery: Scenery;
  readonly stones: readonly Stone[];
  readonly signposts: readonly Signpost[];

  private constructor({
    id,
    scenery,
    stones,
    orbs,
    door,
    hero,
    stars = [],
    signposts = [],
    obstacles,
  }: LevelDefinition) {
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
      if (this.hides(orb.position)) {
        throw new RangeError(
          `An orb must stay visible, not behind a tree or the door, at ${orb.position.column}, ${orb.position.row}`,
        );
      }
      if (orbs.findIndex((other) => other.position.equals(orb.position)) !== index) {
        throw new RangeError(`An orb needs a tile of its own, at ${orb.position.column}, ${orb.position.row}`);
      }
    });
    if (!this.canEnter(hero.position)) throw new RangeError('The hero must start on open ground');
    const reachable = this.reachableTiles();
    if (reachable.some((tile) => tile.row < door.left.row)) {
      throw new RangeError('The door must stand on the top edge of the playable area');
    }
    if (orbs.some((orb) => !reachable.some((tile) => tile.equals(orb.position)))) {
      throw new RangeError('Every orb must lie where the hero can reach it');
    }
    const directions = [Direction.Up, Direction.Down, Direction.Left, Direction.Right];
    if (
      !door.footprint.some((tile) =>
        directions.some((direction) => reachable.some((other) => other.equals(tile.neighbor(direction)))),
      )
    ) {
      throw new RangeError('The door must open beside a tile the hero can reach');
    }
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
        star.position.equals(hero.position) ||
        stars.findIndex((other) => other.equals(star)) !== index
      ) {
        throw new RangeError(`A star needs a tile of its own, at ${star.position.column}, ${star.position.row}`);
      }
    });
    this.remainingOrbs = [...orbs];
    this.remainingStars = [...stars];
    this.placeObstacles = obstacles;
    this.obstacles = this.placedObstacles();
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

  get outlines(): readonly Outline[] {
    return this.obstacleOutlines;
  }

  get door(): Door {
    return this.currentDoor;
  }

  get isComplete(): boolean {
    return this.completed;
  }

  // Collecting the last orb only allows the door to open, because it should not let the hero through before it is seen to open.
  openDoor(): void {
    if (this.remainingOrbs.length > 0) throw new Error('The door opens only once every orb is picked up');
    this.currentDoor = this.currentDoor.opened();
    this.obstacles = this.placedObstacles();
  }

  read(): readonly LevelEvent[] {
    if (this.completed || this.heroEntity.isWalking) return [];
    const signpost = this.signposts.find((candidate) => candidate.isReadableFrom(this.heroEntity.position));
    if (!signpost) return [];
    this.reading = signpost;
    return [new SignpostRead(this.id, signpost.position, signpost.text)];
  }

  tick(heading: Heading | null): readonly LevelEvent[] {
    if (this.completed) return [];
    const before = this.heroEntity.position;
    this.heroEntity.steer(heading, this.obstacles);
    const tile = this.heroEntity.position;
    const events: LevelEvent[] = [];
    if (this.reading && !this.reading.isReadableFrom(tile)) {
      this.reading = null;
      events.push(new SignpostLeft(this.id));
    }
    if (tile.equals(before)) return events;
    const star = this.remainingStars.find((candidate) => candidate.position.equals(tile));
    if (star) {
      this.remainingStars = this.remainingStars.filter((candidate) => candidate !== star);
      this.collectedStars = [...this.collectedStars, star];
      events.push(new StarCollected(this.id, star.position));
    }
    const orb = this.remainingOrbs.find((candidate) => candidate.position.equals(tile));
    if (orb) {
      this.remainingOrbs = this.remainingOrbs.filter((candidate) => candidate !== orb);
      events.push(new OrbCollected(this.id, orb.position, orb.color, orb.restores));
    }
    if (this.currentDoor.covers(tile)) {
      this.completed = true;
      this.heroEntity.steer(null, this.obstacles);
      events.push(new LevelCompleted(this.id));
    }
    return events;
  }

  private placedObstacles(): Obstacles {
    const door = this.currentDoor;
    this.obstacleOutlines = [
      ...this.scenery.obstacles((position) => door.covers(position)),
      ...this.stones.map((stone) => stone.obstacle),
      ...this.signposts.map((signpost) => signpost.obstacle),
      ...(door.isOpen ? [] : [door.obstacle]),
    ];
    return this.placeObstacles(this.obstacleOutlines);
  }

  // Every obstacle stays inside the tile it blocks, so whole open tiles always leave room for her feet to cross between them.
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
