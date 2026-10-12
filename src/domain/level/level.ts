import type { Boulder } from './boulder';
import { type Key, Star } from './collectibles';
import { StarCount } from '../shared/star-count';
import type { Door } from './door';
import { feet, Hero, type HeroState } from './hero';
import {
  LevelCompleted,
  type LevelEvent,
  KeyCollected,
  StarCollected,
  SwingGateClosed,
  SwingGateClosingStarted,
  SwingGateOpened,
  SwingGateOpeningStarted,
} from './level-events';
import type { LevelId } from '../shared/level-id';
import type { LevelAction } from './level-action';
import { type Obstacles, Outline, type PlaceObstacles } from './obstacles';
import { Direction, type Heading, TilePosition, TilePositions, WorldPosition } from './position';
import type { Scenery } from './scenery';
import type { SwingGate } from './swing-gate';

const minimumStarSpots = StarCount.of(15);
const starsAmongSpots = StarCount.of(5);

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
  readonly keys: readonly Key[];
  readonly door: Door;
  readonly hero: { readonly position: TilePosition; readonly facing: Direction };
  readonly stars?: readonly Star[];
  readonly gate?: SwingGate;
  readonly boulders?: readonly Boulder[];
  readonly obstacles: PlaceObstacles;
}

export class Level {
  private readonly heroEntity: Hero;
  private remainingKeys: readonly Key[];
  private currentDoor: Door;
  private currentGate: SwingGate | undefined;
  private currentBoulders: readonly Boulder[];
  private carried: { readonly from: WorldPosition; readonly to: WorldPosition } | undefined;
  private completed = false;
  private remainingStars: readonly Star[];
  private collectedStars: readonly Star[] = [];
  private readonly placeObstacles: PlaceObstacles;
  private obstacles: Obstacles;
  private obstacleOutlines: readonly Outline[] = [];

  readonly id: LevelId;
  readonly scenery: Scenery;
  readonly stones: readonly Stone[];

  private constructor({
    id,
    scenery,
    stones,
    keys,
    door,
    hero,
    stars = [],
    gate,
    boulders = [],
    obstacles,
  }: LevelDefinition) {
    this.id = id;
    this.scenery = scenery;
    this.stones = stones;
    this.heroEntity = new Hero(hero.position, hero.facing);
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
    this.currentGate = gate;
    if (
      gate &&
      [gate.position, gate.approach, gate.position.neighbor(Direction.Up)].some(
        (tile) => !scenery.isWalkable(tile) || stones.some((stone) => stone.position.equals(tile)),
      )
    ) {
      throw new RangeError('The gate needs open ground on its tile and on both sides of it');
    }
    this.currentBoulders = boulders;
    boulders.forEach((boulder, index) => {
      if (
        !scenery.isWalkable(boulder.position) ||
        stones.some((stone) => stone.position.equals(boulder.position)) ||
        boulders.findIndex((other) => other.covers(boulder.position)) !== index ||
        door.covers(boulder.position) ||
        (gate &&
          [gate.position, gate.approach, gate.position.neighbor(Direction.Up)].some((tile) => boulder.covers(tile)))
      ) {
        throw new RangeError(
          `A boulder needs open ground of its own, away from the door and the gate, at ${boulder.position.column}, ${boulder.position.row}`,
        );
      }
    });
    if (keys.length === 0) throw new RangeError('A level needs at least one key to open its door');
    for (let row = 0; row < scenery.size.rows; row++) {
      for (let column = 0; column < scenery.size.columns; column++) {
        if (!keys.some((key) => key.restores.covers(TilePosition.at(column, row)))) {
          throw new RangeError(`The keys of a level must together restore every tile, but not ${column}, ${row}`);
        }
      }
    }
    keys.forEach((key, index) => {
      if (!this.canEnter(key.position)) throw new RangeError('Every key must lie where the hero can reach it');
      if (this.hides(key.position)) {
        throw new RangeError(
          `A key must stay visible, not behind a tree or the door, at ${key.position.column}, ${key.position.row}`,
        );
      }
      if (keys.findIndex((other) => other.position.equals(key.position)) !== index) {
        throw new RangeError(`A key needs a tile of its own, at ${key.position.column}, ${key.position.row}`);
      }
    });
    if (!this.canEnter(hero.position)) throw new RangeError('The hero must start on open ground');
    if (gate && !this.reachableTiles(false).some((tile) => gate.operableFrom(tile))) {
      throw new RangeError('The gate must be operable from where the hero can reach before it opens');
    }
    // What lies behind a gate or a boulder still counts, because the hero can always open the gate or move the boulder.
    const reachable = this.reachableTiles(true);
    if (reachable.some((tile) => tile.row < door.left.row)) {
      throw new RangeError('The door must stand on the top edge of the playable area');
    }
    if (keys.some((key) => !reachable.some((tile) => tile.equals(key.position)))) {
      throw new RangeError('Every key must lie where the hero can reach it');
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
        keys.some((key) => key.position.equals(star.position)) ||
        star.position.equals(hero.position) ||
        boulders.some((boulder) => boulder.covers(star.position)) ||
        stars.findIndex((other) => other.equals(star)) !== index
      ) {
        throw new RangeError(`A star needs a tile of its own, at ${star.position.column}, ${star.position.row}`);
      }
    });
    this.remainingKeys = [...keys];
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
    const { keys, hero } = definition;
    const empty = new Level({ ...definition, stars: [] });
    const spots = empty
      .reachableTiles(true)
      .filter(
        (tile) =>
          !empty.hides(tile) &&
          !keys.some((key) => key.position.equals(tile)) &&
          !tile.equals(hero.position) &&
          !(definition.boulders ?? []).some((boulder) => boulder.covers(tile)),
      );
    if (spots.length < starCount.value) {
      throw new RangeError(`The level has room for ${spots.length} visible, reachable stars, not ${starCount.value}`);
    }
    return new Level({ ...definition, stars: shuffle(spots).slice(0, starCount.value).map(Star.at) });
  }

  static withStarsAmong(
    definition: Omit<LevelDefinition, 'stars'>,
    spots: readonly TilePosition[],
    shuffle: (positions: readonly TilePosition[]) => readonly TilePosition[],
  ): Level {
    if (spots.length < minimumStarSpots.value)
      throw new RangeError(`A level needs at least ${minimumStarSpots.value} star spots, not ${spots.length}`);
    // Every spot must be able to hold a star, not only the five the shuffle happens to pick.
    new Level({ ...definition, stars: spots.map(Star.at) });
    return new Level({ ...definition, stars: shuffle(spots).slice(0, starsAmongSpots.value).map(Star.at) });
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

  get keys(): readonly Key[] {
    return this.remainingKeys;
  }

  get outlines(): readonly Outline[] {
    return this.obstacleOutlines;
  }

  get door(): Door {
    return this.currentDoor;
  }

  get gate(): SwingGate | undefined {
    return this.currentGate;
  }

  get canOperateGate(): boolean {
    const gate = this.currentGate;
    return (
      (gate?.state === 'closed' || gate?.state === 'open') &&
      !this.completed &&
      gate.operableFrom(this.hero.position) &&
      gate.clearOf(feet.at(this.hero.feet))
    );
  }

  operateGate(): readonly LevelEvent[] {
    const gate = this.currentGate;
    if (!gate || !this.canOperateGate) return [];
    if (gate.isOpen) {
      this.currentGate = gate.requestClose();
      // A closing leaf blocks the passage at once, so she cannot slip in while it swings back.
      this.obstacles = this.placedObstacles();
      return [new SwingGateClosingStarted(this.id, gate.position)];
    }
    this.currentGate = gate.requestOpen();
    return [new SwingGateOpeningStarted(this.id, gate.position)];
  }

  // The crossing stays shut until the swing has been seen to finish.
  finishGate(): readonly LevelEvent[] {
    const gate = this.currentGate;
    if (gate?.state === 'opening') {
      this.currentGate = gate.finishOpening();
      this.obstacles = this.placedObstacles();
      return [new SwingGateOpened(this.id, gate.position)];
    }
    if (gate?.state === 'closing') {
      this.currentGate = gate.finishClosing();
      return [new SwingGateClosed(this.id, gate.position)];
    }
    return [];
  }

  get boulders(): readonly Boulder[] {
    return this.currentBoulders;
  }

  get actions(): readonly LevelAction[] {
    return [...(this.currentGate?.actions ?? []), ...this.currentBoulders.flatMap((boulder) => boulder.actions)];
  }

  get canPush(): boolean {
    const boulder = this.boulderAhead();
    return boulder !== undefined && this.canHoldBoulder(boulder.position.neighbor(this.hero.facing));
  }

  get canPull(): boolean {
    const behind = this.hero.position.neighbor(this.hero.facing.opposite);
    return this.boulderAhead() !== undefined && this.canHoldBoulder(behind) && this.canHoldBoulder(this.hero.position);
  }

  push(): void {
    const boulder = this.boulderAhead();
    if (!boulder || !this.canPush) return;
    this.replaceBoulder(boulder, boulder.slide(this.hero.facing));
    this.carried = { from: this.hero.feet, to: Hero.feetOn(boulder.position) };
  }

  pull(): void {
    const boulder = this.boulderAhead();
    if (!boulder || !this.canPull) return;
    this.replaceBoulder(boulder, boulder.slide(this.hero.facing.opposite));
    this.carried = { from: this.hero.feet, to: Hero.feetOn(this.hero.position.neighbor(this.hero.facing.opposite)) };
  }

  get isComplete(): boolean {
    return this.completed;
  }

  // Collecting the last key only allows the door to open, because it should not let the hero through before it is seen to open.
  openDoor(): void {
    if (this.remainingKeys.length > 0) throw new Error('The door opens only once every key is picked up');
    this.currentDoor = this.currentDoor.opened();
    this.obstacles = this.placedObstacles();
  }

  tick(heading: Heading | null): readonly LevelEvent[] {
    if (this.completed) return [];
    const before = this.heroEntity.position;
    const sliding = this.currentBoulders.find((boulder) => boulder.isSliding);
    if (sliding && this.carried) this.slideBoulder(sliding, this.carried);
    else this.heroEntity.steer(heading, this.obstacles);
    const tile = this.heroEntity.position;
    const events: LevelEvent[] = [];
    if (tile.equals(before)) return events;
    const star = this.remainingStars.find((candidate) => candidate.position.equals(tile));
    if (star) {
      this.remainingStars = this.remainingStars.filter((candidate) => candidate !== star);
      this.collectedStars = [...this.collectedStars, star];
      events.push(new StarCollected(this.id, star.position));
    }
    const key = this.remainingKeys.find((candidate) => candidate.position.equals(tile));
    if (key) {
      this.remainingKeys = this.remainingKeys.filter((candidate) => candidate !== key);
      events.push(new KeyCollected(this.id, key.position, key.restores));
    }
    if (this.currentDoor.covers(tile)) {
      this.completed = true;
      this.heroEntity.steer(null, this.obstacles);
      events.push(new LevelCompleted(this.id));
    }
    return events;
  }

  // She ends each slide on the tile the boulder left when pushing, or the tile behind her when pulling.
  private slideBoulder(boulder: Boulder, { from, to }: { from: WorldPosition; to: WorldPosition }): void {
    const advanced = boulder.advance();
    this.replaceBoulder(boulder, advanced);
    const progress = advanced.isSliding ? advanced.progress : 1;
    this.heroEntity.carry(WorldPosition.at(from.x + (to.x - from.x) * progress, from.y + (to.y - from.y) * progress));
    if (!advanced.isSliding) {
      this.carried = undefined;
      this.obstacles = this.placedObstacles();
    }
  }

  private replaceBoulder(previous: Boulder, next: Boulder): void {
    this.currentBoulders = this.currentBoulders.map((boulder) => (boulder === previous ? next : boulder));
  }

  // One boulder moves at a time, because she walks along with it.
  private boulderAhead(): Boulder | undefined {
    if (this.completed || this.currentBoulders.some((boulder) => boulder.isSliding)) return undefined;
    const ahead = this.hero.position.neighbor(this.hero.facing);
    return this.currentBoulders.find((boulder) => boulder.position.equals(ahead));
  }

  private canHoldBoulder(tile: TilePosition): boolean {
    return this.canEnter(tile) && !this.currentDoor.covers(tile) && !(this.currentGate?.covers(tile) ?? false);
  }

  private placedObstacles(): Obstacles {
    const door = this.currentDoor;
    const gate = this.currentGate;
    this.obstacleOutlines = [
      ...this.scenery.obstacles((position) => door.covers(position) || (gate?.covers(position) ?? false)),
      ...this.stones.map((stone) => stone.obstacle),
      ...(door.isOpen ? [] : [door.obstacle]),
      ...(gate?.obstacles ?? []),
      ...this.currentBoulders.map((boulder) => boulder.obstacle),
    ];
    return this.placeObstacles(this.obstacleOutlines);
  }

  // Every obstacle stays inside the tile it blocks, so whole open tiles always leave room for her feet to cross between them.
  // The door counts as closed because stepping onto it ends the level.
  private reachableTiles(cleared: boolean): readonly TilePosition[] {
    // Growing the reached tiles one ring at a time keeps the order of a plain breadth-first search.
    let reached = TilePositions.of([this.heroEntity.position]);
    let ring: readonly TilePosition[] = reached.tiles;
    while (ring.length > 0) {
      const next: TilePosition[] = [];
      for (const tile of ring) {
        for (const direction of [Direction.Up, Direction.Down, Direction.Left, Direction.Right]) {
          const neighbor = tile.neighbor(direction);
          if (
            !reached.covers(neighbor) &&
            !next.some((other) => other.equals(neighbor)) &&
            (this.canEnter(neighbor) ||
              (cleared &&
                ((this.currentGate?.covers(neighbor) ?? false) ||
                  this.currentBoulders.some((boulder) => boulder.covers(neighbor))))) &&
            !this.currentDoor.covers(neighbor)
          )
            next.push(neighbor);
        }
      }
      reached = reached.with(next);
      ring = next;
    }
    return reached.tiles;
  }

  private hides(position: TilePosition): boolean {
    return (
      this.scenery.trees.some((tree) => tree.hides(position)) ||
      this.scenery.hides(position) ||
      this.currentDoor.hides(position) ||
      // The gate leaf is drawn over its own tile and, once swung, over the tile north of it.
      (this.currentGate?.covers(position) ?? false) ||
      (this.currentGate?.covers(position.neighbor(Direction.Down)) ?? false)
    );
  }

  private canEnter(position: TilePosition): boolean {
    return (
      this.scenery.isWalkable(position) &&
      !this.stones.some((stone) => stone.position.equals(position)) &&
      !this.currentBoulders.some((boulder) => boulder.covers(position)) &&
      (this.currentDoor.isOpen || !this.currentDoor.covers(position)) &&
      (!this.currentGate || this.currentGate.isOpen || !this.currentGate.covers(position))
    );
  }
}
