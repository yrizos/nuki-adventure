import { Boulder } from './boulder';
import { Area, Orb, orbRadii } from './collectibles';
import type { Door } from './door';
import { feet, Hero, type HeroState } from './hero';
import {
  LevelCompleted,
  type LevelEvent,
  OrbCollected,
  SwingGateClosed,
  SwingGateClosingStarted,
  SwingGateOpened,
  SwingGateOpeningStarted,
  SwingGateStuck,
  PlatePressed,
  PlateReleased,
} from './level-events';
import type { LevelId } from './level-id';
import type { LevelSnapshot, PlacedOrb } from './level-snapshot';
import type { LevelAction } from './level-action';
import { type Obstacles, Outline, type PlaceObstacles } from './obstacles';
import { Direction, type Heading, TilePosition, TilePositions, WorldPosition, tileKey } from './position';
import type { Random } from './random';
import type { Scenery } from './scenery';
import type { SwingGate } from './swing-gate';

export const orbCount = { fewest: 3, most: 9 } as const;

const placedOrb = ({ position, radius }: Orb): PlacedOrb => ({ position, radius });

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
  readonly gates?: readonly SwingGate[];
  readonly boulders?: readonly Boulder[];
  readonly plate?: TilePosition;
  readonly obstacles: PlaceObstacles;
}

export class Level {
  private readonly definition: LevelDefinition;
  private heroEntity: Hero;
  private remainingOrbs: readonly Orb[];
  private collectedOrbs: readonly Orb[] = [];
  private permanent: readonly TilePosition[] = [];
  // One area instance for the whole level, so the restoration that the last orb starts can be told apart from the others.
  private readonly whole: Area;
  private currentDoor: Door;
  private currentGates: readonly SwingGate[];
  private currentBoulders: readonly Boulder[];
  readonly plate: TilePosition | undefined;
  private plateDown = false;
  private carried: { readonly from: WorldPosition; readonly to: WorldPosition } | undefined;
  private completed = false;
  private gripping = false;
  private readonly placeObstacles: PlaceObstacles;
  // Built when the hero first needs it, so a level made only to be inspected never places its obstacles.
  private placed: Obstacles | undefined;
  private obstacleOutlines: readonly Outline[] = [];

  readonly id: LevelId;
  readonly scenery: Scenery;
  readonly stones: readonly Stone[];
  private readonly stoneTiles: TilePositions;

  private constructor({
    id,
    scenery,
    stones,
    orbs,
    door,
    hero,
    gates = [],
    boulders = [],
    plate,
    obstacles,
  }: LevelDefinition) {
    this.definition = {
      id,
      scenery,
      stones,
      orbs,
      door,
      hero,
      gates,
      boulders,
      ...(plate ? { plate } : {}),
      obstacles,
    };
    this.id = id;
    this.scenery = scenery;
    this.whole = Area.whole(scenery.size);
    this.stones = stones;
    this.stoneTiles = TilePositions.of(stones.map((stone) => stone.position));
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
    this.currentGates = gates;
    for (const gate of gates) {
      if (
        [gate.position, gate.approach, gate.position.neighbor(gate.swing)].some(
          (tile) => !scenery.isWalkable(tile) || stones.some((stone) => stone.position.equals(tile)),
        )
      ) {
        throw new RangeError('The gate needs open ground on its tile and on both sides of it');
      }
    }
    // A leaf swinging into another gate, or a tile beside two gates, would leave pressing A working a gate she did not mean.
    gates.forEach((gate, index) =>
      gates.slice(index + 1).forEach((other) => {
        const ground = (each: SwingGate) => [each.position, each.approach, each.position.neighbor(each.swing)];
        const around = [-1, 0, 1].flatMap((column) =>
          [-1, 0, 1].map((row) => TilePosition.at(gate.position.column + column, gate.position.row + row)),
        );
        if (
          ground(gate).some((tile) => ground(other).some((each) => each.equals(tile))) ||
          around.some((tile) => gate.operableFrom(tile) && other.operableFrom(tile))
        ) {
          throw new RangeError(
            `Two gates need room of their own, at ${gate.position.column}, ${gate.position.row} and ${other.position.column}, ${other.position.row}`,
          );
        }
      }),
    );
    this.currentBoulders = boulders;
    this.plate = plate;
    // One plate holds one gate, so a second gate would have nothing to tie it to.
    if (plate && gates.length !== 1) throw new RangeError('A pressure plate needs exactly one gate to open');
    if (
      plate &&
      (!scenery.isWalkable(plate) || stones.some((stone) => stone.position.equals(plate)) || door.covers(plate))
    ) {
      throw new RangeError(
        `A pressure plate needs open ground a boulder can rest on, at ${plate.column}, ${plate.row}`,
      );
    }
    // Every step off the plate then leaves her clear of the leaf, so the gate can shut at once without sweeping through her.
    if (
      plate &&
      gates.some((gate) =>
        [gate.position, gate.position.neighbor(gate.swing)].some(
          (tile) => Math.max(Math.abs(tile.column - plate.column), Math.abs(tile.row - plate.row)) < 2,
        ),
      )
    ) {
      throw new RangeError(
        `A pressure plate must stand at least two tiles from the gate and its swing, at ${plate.column}, ${plate.row}`,
      );
    }
    boulders.forEach((boulder, index) => {
      if (
        !scenery.isWalkable(boulder.position) ||
        stones.some((stone) => stone.position.equals(boulder.position)) ||
        boulders.findIndex((other) => other.covers(boulder.position)) !== index ||
        door.covers(boulder.position) ||
        gates.some((gate) =>
          [gate.position, gate.approach, gate.position.neighbor(gate.swing)].some((tile) => boulder.covers(tile)),
        )
      ) {
        throw new RangeError(
          `A boulder needs open ground of its own, away from the door and the gate, at ${boulder.position.column}, ${boulder.position.row}`,
        );
      }
    });
    if (!this.canEnter(hero.position)) throw new RangeError('The hero must start on open ground');
    // Gates can be opened one after another, so each must be operable once every other gate stands open.
    for (const gate of gates) {
      const shut = this.reachableTiles((tile) => gates.some((other) => other !== gate && other.covers(tile)));
      if (!shut.tiles.some((tile) => gate.operableFrom(tile))) {
        throw new RangeError('The gate must be operable from where the hero can reach before it opens');
      }
    }
    const reachable = this.reachableTiles((tile) => this.clearable(tile));
    if (reachable.tiles.some((tile) => tile.row < door.left.row)) {
      throw new RangeError('The door must stand on the top edge of the playable area');
    }
    const directions = [Direction.Up, Direction.Down, Direction.Left, Direction.Right];
    if (!door.footprint.some((tile) => directions.some((direction) => reachable.covers(tile.neighbor(direction))))) {
      throw new RangeError('The door must open beside a tile the hero can reach');
    }
    orbs.forEach((orb, index) => {
      const { column, row } = orb.position;
      if (!reachable.covers(orb.position)) throw new RangeError('Every orb must lie where the hero can reach it');
      if (this.hides(orb.position)) {
        throw new RangeError(`An orb must stay visible, not behind a tree or the door, at ${column}, ${row}`);
      }
      if (
        orb.position.equals(hero.position) ||
        (plate !== undefined && orb.position.equals(plate)) ||
        gates.some((gate) => gate.covers(orb.position)) ||
        boulders.some((boulder) => boulder.covers(orb.position)) ||
        orbs.findIndex((other) => other.position.equals(orb.position)) !== index
      ) {
        throw new RangeError(`An orb needs a tile of its own, at ${column}, ${row}`);
      }
      const touched = orbs.find((other) => other !== orb && other.touches(orb));
      if (touched) {
        throw new RangeError(
          `The circles of two orbs must stay apart, at ${column}, ${row} and ${touched.position.column}, ${touched.position.row}`,
        );
      }
    });
    this.remainingOrbs = [...orbs];
    this.placeObstacles = obstacles;
    this.outlineObstacles();
  }

  static create(definition: LevelDefinition): Level {
    if (definition.orbs.length === 0) throw new RangeError('A level needs at least one orb to open its door');
    return new Level(definition);
  }

  // A permanent orb lies in its place every time the level starts, and random orbs fill up the count around it.
  // A small level holds fewer orbs than it rolled, so only authored levels are held to the fewest.
  static withOrbs(
    definition: Omit<LevelDefinition, 'orbs'>,
    permanent: readonly TilePosition[],
    random: Random,
  ): Level {
    const { size } = definition.scenery;
    const roll = (choices: number): number => Math.min(Math.floor(random() * choices), choices - 1);
    const rolledRadius = (): number => orbRadii.smallest + roll(orbRadii.largest - orbRadii.smallest + 1);
    // A circle that does not fit shrinks before its orb is given up, so a crowded level still gets as many orbs as it can.
    const fitting = (tile: TilePosition, placed: readonly Orb[]): Orb | undefined => {
      for (let radius = rolledRadius(); radius >= orbRadii.smallest; radius--) {
        const orb = Orb.at(tile, radius, size);
        if (!placed.some((other) => other.touches(orb))) return orb;
      }
      return undefined;
    };
    const orbs: Orb[] = [];
    for (const tile of permanent) {
      const orb = fitting(tile, orbs);
      if (!orb) throw new RangeError(`A permanent orb stands too close to another, at ${tile.column}, ${tile.row}`);
      orbs.push(orb);
    }
    const total = orbCount.fewest + roll(orbCount.most - orbCount.fewest + 1);
    if (orbs.length > total) throw new RangeError(`A level holds at most ${orbCount.most} orbs, not ${orbs.length}`);
    const spots = new Level({ ...definition, orbs }).orbSpots();
    const candidatesByRadius = new Map<number, readonly { orb: Orb; weight: number }[]>();
    while (orbs.length < total) {
      const radius = rolledRadius();
      let placed = false;
      for (let shrunk = radius; shrunk >= orbRadii.smallest && !placed; shrunk--) {
        let candidates = candidatesByRadius.get(shrunk);
        if (!candidates) {
          candidates = spots.map(({ tile, weight }) => ({ weight, orb: Orb.at(tile, shrunk, size) }));
          candidatesByRadius.set(shrunk, candidates);
        }
        const open = candidates.filter(({ orb }) => !orbs.some((other) => other.touches(orb)));
        if (open.length === 0) continue;
        let pick = random() * open.reduce((sum, spot) => sum + spot.weight, 0);
        const chosen = open.find((spot) => (pick -= spot.weight) < 0) ?? open.at(-1)!;
        orbs.push(chosen.orb);
        placed = true;
      }
      if (!placed) break;
    }
    if (orbs.length < orbCount.fewest) {
      // Greedy placement can fill the only gaps before the minimum count fits, so retry with the smallest circles.
      const fixed = permanent.map((tile) => Orb.at(tile, orbRadii.smallest, size));
      const candidates = spots.map(({ tile }) => Orb.at(tile, orbRadii.smallest, size));
      const fill = (placed: readonly Orb[], from: number): readonly Orb[] | undefined => {
        if (placed.length >= orbCount.fewest) return placed;
        for (let index = from; index < candidates.length; index++) {
          const candidate = candidates[index]!;
          if (placed.some((orb) => orb.touches(candidate))) continue;
          const filled = fill([...placed, candidate], index + 1);
          if (filled) return filled;
        }
        return undefined;
      };
      const filled = fill(fixed, 0);
      if (filled) orbs.splice(0, orbs.length, ...filled);
    }
    if (orbs.length === 0) throw new RangeError('The level has no room for an orb');
    const level = new Level({ ...definition, orbs });
    level.permanent = [...permanent];
    return level;
  }

  // Tiles far from the shortest walk to the door and at the end of a dead end weigh more, so random orbs draw her off the way out.
  private orbSpots(): readonly { readonly tile: TilePosition; readonly weight: number }[] {
    const { hero, boulders = [], gates = [], plate } = this.definition;
    const reachable = this.reachableTiles((tile) => this.clearable(tile));
    const sides = [Direction.Up, Direction.Down, Direction.Left, Direction.Right];
    const steps = (from: readonly TilePosition[]): Map<number, number> => {
      const distance = new Map(from.map((tile) => [tileKey(tile), 0]));
      const queue = [...from];
      for (let index = 0; index < queue.length; index++) {
        const tile = queue[index]!;
        for (const side of sides) {
          const next = tile.neighbor(side);
          if (reachable.covers(next) && !distance.has(tileKey(next))) {
            distance.set(tileKey(next), distance.get(tileKey(tile))! + 1);
            queue.push(next);
          }
        }
      }
      return distance;
    };
    const fromStart = steps([hero.position]);
    const exits = reachable.tiles.filter((tile) => sides.some((side) => this.currentDoor.covers(tile.neighbor(side))));
    const fromDoor = steps(exits);
    // Every tile on a shortest walk adds up to the same length between the start and the door.
    const shortest = Math.min(...exits.map((tile) => fromStart.get(tileKey(tile))!));
    const route = reachable.tiles.filter(
      (tile) => fromStart.get(tileKey(tile))! + fromDoor.get(tileKey(tile))! === shortest,
    );
    const offRoute = steps(route);
    const canopy = (column: number, row: number): boolean => {
      const tile = TilePosition.at(column, row);
      return this.scenery.woodland.covers(tile) || this.scenery.trees.some((tree) => tree.covers(tile));
    };
    // A canopy above or on both sides makes an orb read as hidden even when no canopy covers its own tile.
    const inBay = ({ column, row }: TilePosition): boolean =>
      canopy(column - 1, row - 1) ||
      canopy(column, row - 1) ||
      canopy(column + 1, row - 1) ||
      (canopy(column - 1, row) && canopy(column + 1, row));
    return reachable.tiles
      .filter(
        (tile) =>
          !this.hides(tile) &&
          !inBay(tile) &&
          Math.max(Math.abs(tile.column - hero.position.column), Math.abs(tile.row - hero.position.row)) > 1 &&
          !(plate !== undefined && tile.equals(plate)) &&
          !gates.some((gate) => gate.covers(tile)) &&
          !boulders.some((boulder) => boulder.covers(tile)),
      )
      .map((tile) => {
        const deadEnd = sides.filter((side) => reachable.covers(tile.neighbor(side))).length === 1;
        return { tile, weight: (1 + offRoute.get(tileKey(tile))!) ** 2 * (deadEnd ? 2 : 1) };
      });
  }

  // Nothing may be moving, because a snapshot taken halfway through a swing or a slide could not be played on from.
  get snapshot(): LevelSnapshot | null {
    if (
      this.completed ||
      this.carried ||
      this.currentGates.some((gate) => gate.isSwinging) ||
      this.currentBoulders.some((boulder) => boulder.isSliding)
    )
      return null;
    return {
      hero: { feet: this.hero.feet, facing: this.hero.facing },
      orbs: this.remainingOrbs.map(placedOrb),
      collectedOrbs: this.collectedOrbs.map(placedOrb),
      gates: this.currentGates.map((gate) => (gate.isOpen ? 'open' : 'closed')),
      boulders: this.currentBoulders.map((boulder) => boulder.position),
    };
  }

  // The level may have changed since the snapshot was taken, so a snapshot that no longer fits is refused instead of placing her somewhere impossible.
  resumed(snapshot: LevelSnapshot): Level {
    const { boulders = [] } = this.definition;
    if (snapshot.orbs.length + snapshot.collectedOrbs.length === 0) {
      throw new RangeError('A level needs at least one orb to open its door');
    }
    // Building with every saved orb runs the same checks as a fresh start, so the saved orbs need no checks of their own.
    const level = new Level({
      ...this.definition,
      orbs: [...snapshot.orbs, ...snapshot.collectedOrbs].map(({ position, radius }) =>
        Orb.at(position, radius, this.scenery.size),
      ),
    });
    level.permanent = this.permanent;
    if (this.permanent.some((tile) => !level.remainingOrbs.some((orb) => orb.position.equals(tile)))) {
      throw new RangeError('Every permanent orb of the level must be among the saved orbs');
    }
    level.collectedOrbs = level.remainingOrbs.slice(snapshot.orbs.length);
    level.remainingOrbs = level.remainingOrbs.slice(0, snapshot.orbs.length);
    if (level.remainingOrbs.length === 0) level.currentDoor = level.currentDoor.opened();
    if (snapshot.gates.length !== level.currentGates.length) {
      throw new RangeError(`The level has ${level.currentGates.length} gates, not ${snapshot.gates.length}`);
    }
    level.currentGates = level.currentGates.map((gate, index) => gate.resting(snapshot.gates[index]!));
    if (snapshot.boulders.length !== boulders.length) {
      throw new RangeError(`The level has ${boulders.length} boulders, not ${snapshot.boulders.length}`);
    }
    level.currentBoulders = [];
    for (const tile of snapshot.boulders) {
      if (!level.canHoldBoulder(tile)) {
        throw new RangeError(`A boulder needs open ground of its own, at ${tile.column}, ${tile.row}`);
      }
      level.currentBoulders = [...level.currentBoulders, Boulder.at(tile)];
    }
    const { feet: heroFeet, facing } = snapshot.hero;
    if (facing.isDiagonal) throw new RangeError(`The hero faces a side, not ${facing.name}`);
    level.heroEntity = Hero.standingAt(heroFeet, facing);
    level.outlineObstacles();
    const tile = level.heroEntity.position;
    const { columns, rows } = level.scenery.size;
    // Feet pressed against a boulder, a stone or a fence can stand inside its tile, so only the obstacles themselves decide where she fits.
    // Walking pushes feet out of an overlap but leaves feet sunk too deep to settle where they are, so those are caught by their middle.
    const fits = level.obstacles.walk(feet.at(heroFeet), heroFeet);
    const sunk = level.obstacleOutlines.some((outline) => outline.contains(heroFeet));
    if (
      tile.column < 0 ||
      tile.row < 0 ||
      tile.column >= columns ||
      tile.row >= rows ||
      fits.x !== heroFeet.x ||
      fits.y !== heroFeet.y ||
      sunk ||
      level.currentDoor.covers(tile) ||
      level.remainingOrbs.some((orb) => orb.position.equals(tile))
    ) {
      throw new RangeError(`The hero needs open ground, at ${tile.column}, ${tile.row}`);
    }
    const plate = level.plate;
    if (plate) {
      level.plateDown = tile.equals(plate) || level.currentBoulders.some((boulder) => boulder.covers(plate));
      // A plate holds its gate open, so any other pairing would swing the gate the moment play goes on.
      if (level.currentGates[0]!.isOpen !== level.plateDown) {
        throw new RangeError('A pressure plate holds its gate open exactly while something presses it');
      }
    }
    return level;
  }

  get hero(): HeroState {
    return this.heroEntity.state;
  }

  get orbs(): readonly Orb[] {
    return this.remainingOrbs;
  }

  get permanentOrbs(): readonly TilePosition[] {
    return this.permanent;
  }

  // The last orb brings back the whole level, so nothing stays faded between the circles once every orb is picked up.
  get restored(): readonly Area[] {
    if (this.remainingOrbs.length === 0) return [this.whole];
    return this.collectedOrbs.map((orb) => orb.restores);
  }

  get isPlateDown(): boolean {
    return this.plateDown;
  }

  get outlines(): readonly Outline[] {
    return this.obstacleOutlines;
  }

  get door(): Door {
    return this.currentDoor;
  }

  get gates(): readonly SwingGate[] {
    return this.currentGates;
  }

  // A gate held by a plate only answers her when shut, so trying it can tell her it will not open.
  get operableGate(): SwingGate | undefined {
    if (this.completed) return undefined;
    return this.currentGates.find(
      (gate) =>
        (gate.state === 'closed' || (gate.state === 'open' && !this.plate)) &&
        gate.operableFrom(this.hero.position) &&
        gate.clearOf(feet.at(this.hero.feet)),
    );
  }

  get canOperateGate(): boolean {
    return this.operableGate !== undefined;
  }

  operateGate(): readonly LevelEvent[] {
    const gate = this.operableGate;
    if (!gate) return [];
    if (this.plate) return [new SwingGateStuck(this.id, gate.position)];
    if (gate.isOpen) {
      this.replaceGate(gate, gate.requestClose());
      // A closing leaf blocks the passage at once, so she cannot slip in while it swings back.
      this.outlineObstacles();
      return [new SwingGateClosingStarted(this.id, gate.position)];
    }
    this.replaceGate(gate, gate.requestOpen());
    return [new SwingGateOpeningStarted(this.id, gate.position)];
  }

  private replaceGate(previous: SwingGate, next: SwingGate): void {
    this.currentGates = this.currentGates.map((gate) => (gate === previous ? next : gate));
  }

  private swingGates(): readonly LevelEvent[] {
    return this.currentGates.flatMap((gate) => {
      if (!gate.isSwinging) return [];
      const swung = gate.swingOn();
      this.replaceGate(gate, swung);
      if (swung.state === 'open') {
        this.outlineObstacles();
        return [new SwingGateOpened(this.id, gate.position)];
      }
      if (swung.state === 'closed') return [new SwingGateClosed(this.id, gate.position)];
      return [];
    });
  }

  get boulders(): readonly Boulder[] {
    return this.currentBoulders;
  }

  get actions(): readonly LevelAction[] {
    return [
      ...this.currentGates.flatMap((gate) => gate.actions),
      ...this.currentBoulders.flatMap((boulder) => boulder.actions),
    ];
  }

  get grippableBoulder(): Boulder | undefined {
    return this.gripping ? undefined : this.boulderAhead();
  }

  get canGrip(): boolean {
    return this.grippableBoulder !== undefined;
  }

  get isGripping(): boolean {
    return this.gripping;
  }

  grip(): void {
    if (this.boulderAhead()) this.gripping = true;
  }

  release(): void {
    this.gripping = false;
  }

  get isComplete(): boolean {
    return this.completed;
  }

  // Collecting the last orb only allows the door to open, because it should not let the hero through before it is seen to open.
  openDoor(): void {
    if (this.remainingOrbs.length > 0) throw new Error('The door opens only once every orb is picked up');
    this.currentDoor = this.currentDoor.opened();
    this.outlineObstacles();
  }

  tick(heading: Heading | null): readonly LevelEvent[] {
    if (this.completed) return [];
    // She stands still while she swings a gate by hand, so time passes only for the leaf.
    if (this.currentGates.some((gate) => gate.isSwinging) && !this.plate) return this.swingGates();
    const before = this.heroEntity.position;
    const sliding = this.currentBoulders.find((boulder) => boulder.isSliding);
    if (sliding && this.carried) this.slideBoulder(sliding, this.carried);
    else if (this.gripping) this.moveGripped(heading);
    else this.heroEntity.steer(heading, this.obstacles);
    const tile = this.heroEntity.position;
    const events: LevelEvent[] = [...this.followPlate(), ...this.swingGates()];
    if (tile.equals(before)) return events;
    const orb = this.remainingOrbs.find((candidate) => candidate.position.equals(tile));
    if (orb) {
      this.remainingOrbs = this.remainingOrbs.filter((candidate) => candidate !== orb);
      this.collectedOrbs = [...this.collectedOrbs, orb];
      const last = this.remainingOrbs.length === 0;
      events.push(new OrbCollected(this.id, orb.position, last ? this.restored[0]! : orb.restores, last));
    }
    if (this.currentDoor.covers(tile)) {
      this.completed = true;
      this.heroEntity.steer(null, this.obstacles);
      events.push(new LevelCompleted(this.id));
    }
    return events;
  }

  // A sliding boulder presses both the tile it leaves and the tile it enters, so moving it on or off with her own weight on the plate never lets the plate spring up for half a slide.
  private followPlate(): readonly LevelEvent[] {
    const [gate] = this.currentGates;
    const plate = this.plate;
    if (!gate || !plate) return [];
    const pressed = this.hero.position.equals(plate) || this.currentBoulders.some((boulder) => boulder.covers(plate));
    const events: LevelEvent[] = [];
    if (pressed !== this.plateDown) {
      this.plateDown = pressed;
      events.push(pressed ? new PlatePressed(this.id, plate) : new PlateReleased(this.id, plate));
    }
    // A swing turns back as soon as the plate changes, so the gate never finishes opening with nothing on the plate and never closes onto her later.
    if (pressed && (gate.state === 'closed' || gate.state === 'closing')) {
      this.replaceGate(gate, gate.state === 'closed' ? gate.requestOpen() : gate.reverse());
      events.push(new SwingGateOpeningStarted(this.id, gate.position));
    } else if (!pressed && (gate.state === 'open' || gate.state === 'opening')) {
      this.replaceGate(gate, gate.state === 'open' ? gate.requestClose() : gate.reverse());
      this.outlineObstacles();
      events.push(new SwingGateClosingStarted(this.id, gate.position));
    }
    return events;
  }

  // She keeps facing the boulder, so it stays in front of her and gripped after every move.
  private moveGripped(heading: Heading | null): void {
    const boulder = this.boulderAhead();
    if (!boulder || !heading) {
      this.heroEntity.steer(null, this.obstacles);
      return;
    }
    const direction =
      Math.abs(heading.x) > Math.abs(heading.y)
        ? heading.x > 0
          ? Direction.Right
          : Direction.Left
        : heading.y > 0
          ? Direction.Down
          : Direction.Up;
    const stand = boulder.position.neighbor(this.hero.facing.opposite);
    const boulderTarget = boulder.position.neighbor(direction);
    const heroTarget = stand.neighbor(direction);
    if (
      (!boulderTarget.equals(stand) && !this.canHoldBoulder(boulderTarget)) ||
      (!heroTarget.equals(boulder.position) && !this.canHoldBoulder(heroTarget))
    ) {
      this.heroEntity.steer(null, this.obstacles);
      return;
    }
    // The slide takes its first step on the same tick, so a held move never pauses between tiles.
    const sliding = boulder.slide(direction);
    this.replaceBoulder(boulder, sliding);
    this.carried = { from: this.hero.feet, to: Hero.feetOn(heroTarget) };
    this.slideBoulder(sliding, this.carried);
  }

  private slideBoulder(boulder: Boulder, { from, to }: { from: WorldPosition; to: WorldPosition }): void {
    const advanced = boulder.advance();
    this.replaceBoulder(boulder, advanced);
    const progress = advanced.isSliding ? advanced.progress : 1;
    this.heroEntity.carry(WorldPosition.at(from.x + (to.x - from.x) * progress, from.y + (to.y - from.y) * progress));
    if (!advanced.isSliding) {
      this.carried = undefined;
      this.outlineObstacles();
    }
  }

  private replaceBoulder(previous: Boulder, next: Boulder): void {
    this.currentBoulders = this.currentBoulders.map((boulder) => (boulder === previous ? next : boulder));
  }

  // One boulder moves at a time, because she walks along with it.
  // The round boulder leaves the edges of its tile open, so feet pressed against it can stand inside its tile, short of its middle.
  private boulderAhead(): Boulder | undefined {
    if (this.completed || this.currentBoulders.some((boulder) => boulder.isSliding)) return undefined;
    const { facing, feet, position } = this.hero;
    const ahead = position.neighbor(facing);
    return this.currentBoulders.find((boulder) => {
      if (boulder.position.equals(ahead)) return true;
      // Passing along its open edge sideways must not count, so her feet must also lie within its span across her facing.
      const { center, width, height } = boulder.obstacle;
      const along = (center.x - feet.x) * facing.columnStep + (center.y - feet.y) * facing.rowStep;
      const across =
        facing.columnStep === 0 ? Math.abs(feet.x - center.x) <= width / 2 : Math.abs(feet.y - center.y) <= height / 2;
      return boulder.position.equals(position) && along > 0 && across;
    });
  }

  private canHoldBoulder(tile: TilePosition): boolean {
    return (
      this.canEnter(tile) && !this.currentDoor.covers(tile) && !this.currentGates.some((gate) => gate.covers(tile))
    );
  }

  private get obstacles(): Obstacles {
    return (this.placed ??= this.placeObstacles(this.obstacleOutlines));
  }

  private outlineObstacles(): void {
    const door = this.currentDoor;
    const gates = this.currentGates;
    this.obstacleOutlines = [
      ...this.scenery.obstacles(door, gates),
      ...this.stones.map((stone) => stone.obstacle),
      ...(door.isOpen ? [] : [door.obstacle]),
      ...gates.flatMap((gate) => gate.obstacles),
      ...this.currentBoulders.map((boulder) => boulder.obstacle),
    ];
    this.placed = undefined;
  }

  // What lies behind a gate or a boulder still counts, because the hero can always open the gate or move the boulder.
  private clearable(tile: TilePosition): boolean {
    return (
      this.currentGates.some((gate) => gate.covers(tile)) ||
      this.currentBoulders.some((boulder) => boulder.covers(tile))
    );
  }

  // Every obstacle stays inside the tile it blocks, so whole open tiles always leave room for her feet to cross between them.
  // The door counts as closed because stepping onto it ends the level.
  private reachableTiles(cleared: (tile: TilePosition) => boolean): TilePositions {
    const start = this.heroEntity.position;
    const reached = [start];
    const seen = new Set([tileKey(start)]);
    for (let index = 0; index < reached.length; index++) {
      for (const direction of [Direction.Up, Direction.Down, Direction.Left, Direction.Right]) {
        const neighbor = reached[index]!.neighbor(direction);
        if (
          !seen.has(tileKey(neighbor)) &&
          (this.canEnter(neighbor) || cleared(neighbor)) &&
          !this.currentDoor.covers(neighbor)
        ) {
          seen.add(tileKey(neighbor));
          reached.push(neighbor);
        }
      }
    }
    return TilePositions.of(reached);
  }

  private hides(position: TilePosition): boolean {
    return (
      this.scenery.trees.some((tree) => tree.hides(position)) ||
      this.scenery.hides(position) ||
      this.currentDoor.hides(position) ||
      this.currentGates.some((gate) => gate.hides(position))
    );
  }

  private canEnter(position: TilePosition): boolean {
    return (
      this.scenery.isWalkable(position) &&
      !this.stoneTiles.covers(position) &&
      !this.currentBoulders.some((boulder) => boulder.covers(position)) &&
      (this.currentDoor.isOpen || !this.currentDoor.covers(position)) &&
      this.currentGates.every((gate) => gate.isOpen || !gate.covers(position))
    );
  }
}
