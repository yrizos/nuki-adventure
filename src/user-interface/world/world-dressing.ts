import { Direction, FlowerVariant, Ground, type LevelView, type Scenery, TilePosition, TreeVariant } from '../../level';
import type { Art } from '../graphics/art';
import {
  butterflyArt,
  fenceArt,
  flowerArt,
  fruitTreeArt,
  grassArt,
  mossyStoneVariants,
  pathArt,
  stoneVariants,
  terrainArt,
  treeArt,
  undergrowthArt,
  waterArt,
  waterLilyVariants,
} from '../graphics/sprite-library';
import { clamp, tileSize } from './world-geometry';

interface GroundTile {
  readonly x: number;
  readonly y: number;
  readonly frames: readonly Art[];
}

interface WoodlandTree {
  readonly base: TilePosition;
  readonly frames: readonly Art[];
}

// ponytail: fixed 8-tile margin, derive from the largest view if maps shrink below the view
const woodlandMargin = 8;

// A tree starts on every woodland tile, because canopies placed two tiles apart leave grass showing where their rounded edges meet.
function woodlandTrees(scenery: Scenery): WoodlandTree[] {
  if (scenery.woodland.tiles.length === 0) return [];
  const { columns, rows } = scenery.size;
  const wooded = (column: number, row: number): boolean =>
    column < 0 || row < 0 || column >= columns || row >= rows || scenery.woodland.covers(TilePosition.at(column, row));
  const bases: TilePosition[] = [];
  for (let row = -woodlandMargin; row < rows + woodlandMargin; row++) {
    for (let column = -woodlandMargin; column < columns + woodlandMargin; column++) {
      if (!wooded(column, row) || (column > -woodlandMargin && wooded(column - 1, row))) continue;
      let end = column;
      while (end + 1 < columns + woodlandMargin && wooded(end + 1, row)) end++;
      for (let start = column; start < Math.max(end, column + 1); start++) bases.push(TilePosition.at(start, row));
    }
  }
  // propVariants derives its starting choice from the position, which must not be negative.
  const choices = propVariants(
    bases.map(({ column, row }) => [
      TilePosition.at(column + woodlandMargin, row + woodlandMargin),
      TilePosition.at(column + woodlandMargin + 1, row + woodlandMargin),
    ]),
    treeArt.length,
  );
  return bases.map((base, index) => ({ base, frames: treeVersion(choices[index]!, base) }));
}

// The shape keeps touching trees apart, and the tile hash picks a version within it so the subtle versions follow no visible pattern.
function treeVersion(shape: number, base: TilePosition): readonly Art[] {
  const versions = treeArt[shape]!;
  return versions[tileHash(base.column, base.row) % versions.length]!;
}

interface Undergrowth {
  readonly position: TilePosition;
  readonly art: Art;
}

// Mixes a tile position into a well-spread unsigned integer, so choices made from it follow no visible row, column or diagonal.
function tileHash(column: number, row: number): number {
  let hash = Math.imul(column, 374761393) + Math.imul(row, 668265263);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return (hash ^ (hash >>> 16)) >>> 0;
}

// Ferns and shrubs soften the woodland edge on clearing grass. The tile hash keeps about one edge tile in five, so the plants stay sparse and the edge never reads as an even band. The ring around the hero start stays bare.
function undergrowth(level: LevelView): Undergrowth[] {
  const { scenery } = level;
  if (scenery.woodland.tiles.length === 0) return [];
  const { columns, rows } = scenery.size;
  const wooded = (column: number, row: number): boolean =>
    column < 0 || row < 0 || column >= columns || row >= rows || scenery.woodland.covers(TilePosition.at(column, row));
  const start = level.hero.position;
  const taken = [
    ...scenery.flowers.map((flower) => flower.position),
    ...level.stones.map((stone) => stone.position),
    ...level.keys.map((key) => key.position),
    ...level.stars.map((star) => star.position),
    ...(level.plate ? [level.plate] : []),
  ];
  const positions: TilePosition[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const position = TilePosition.at(column, row);
      if (
        tileHash(column, row) % 5 !== 0 ||
        !scenery.groundAt(position).equals(Ground.Grass) ||
        !scenery.isWalkable(position) ||
        level.door.covers(position) ||
        level.gates.some((gate) => gate.covers(position)) ||
        taken.some((other) => other.equals(position)) ||
        (Math.abs(column - start.column) <= 1 && Math.abs(row - start.row) <= 1)
      )
        continue;
      const touches = [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => wooded(column + dx, row + dy)));
      if (touches) positions.push(position);
    }
  }
  return propVariants(
    positions.map((position) => [position]),
    undergrowthArt.length,
  ).map((choice, index) => ({ position: positions[index]!, art: undergrowthArt[choice]! }));
}

interface Point {
  readonly x: number;
  readonly y: number;
}

export interface ButterflyLeg {
  readonly from: Point;
  readonly to: Point;
  readonly rest: number;
  readonly flight: number;
}

export interface Butterfly {
  readonly frames: readonly Art[];
  readonly legs: readonly ButterflyLeg[];
  readonly cycle: number;
  readonly phase: number;
}

const butterflyFlightSpeed = 0.75;
const shortestButterflyFlight = 12;
// One butterfly per handful of stops keeps a small patch from swarming, and the cap keeps a large orchard calm.
const stopsPerButterfly = 5;
const mostButterflies = 3;

// Butterfly variants come in sprite order: yellow, red, violet and pink. A butterfly resting on a canopy must stand
// out from its fruit, so each fruit only hosts colors far from its own. Red apples rule out red and pink, orange
// fruit rules out yellow and red, and lemons rule out yellow. Violet suits every fruit, so a mixed orchard always has one.
const [yellow, red, violet, pink] = [0, 1, 2, 3];
const fruitButterflyColors: Readonly<Record<string, readonly number[]>> = {
  [TreeVariant.Apples.name]: [yellow, violet],
  [TreeVariant.Oranges.name]: [violet, pink],
  [TreeVariant.Lemons.name]: [red, violet, pink],
};

function groupsOf<T>(items: readonly T[], touch: (first: T, second: T) => boolean): T[][] {
  const groups: T[][] = [];
  const seen = new Set<T>();
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    const group = [item];
    for (let index = 0; index < group.length; index++)
      for (const other of items)
        if (!seen.has(other) && touch(group[index]!, other)) {
          seen.add(other);
          group.push(other);
        }
    groups.push(group);
  }
  return groups;
}

const distance = (first: Point, second: Point): number => Math.hypot(first.x - second.x, first.y - second.y);

// Each hop goes to the nearest stop not yet visited, and the route then retraces itself, so a butterfly only ever
// flies between nearby stops and never crosses the whole group to get back to its start.
function butterflyRoute(stops: readonly Point[], start: number): Point[] {
  const left = stops.filter((_, index) => index !== start);
  const route = [stops[start]!];
  while (left.length > 0) {
    const last = route.at(-1)!;
    let nearest = 0;
    left.forEach((stop, index) => {
      if (distance(stop, last) < distance(left[nearest]!, last)) nearest = index;
    });
    route.push(...left.splice(nearest, 1));
  }
  return [...route, ...route.slice(1, -1).reverse()];
}

// A lone flower gets two hovering points beside it, so its butterfly still has somewhere to flutter to.
function groupButterflies(
  stops: readonly Point[],
  anchor: TilePosition,
  colors: readonly (readonly Art[])[] = butterflyArt,
): Butterfly[] {
  const points =
    stops.length > 1
      ? stops
      : [stops[0]!, { x: stops[0]!.x + 10, y: stops[0]!.y - 6 }, { x: stops[0]!.x - 9, y: stops[0]!.y - 4 }];
  const count = Math.min(mostButterflies, 1 + Math.floor((stops.length - 1) / stopsPerButterfly));
  const anchorSeed = anchor.column * 3 + anchor.row * 5;
  return Array.from({ length: count }, (_, sibling) => {
    const seed = anchorSeed + sibling * 7;
    const route = butterflyRoute(points, Math.floor((sibling * points.length) / count));
    const legs = route.map((from, index) => {
      const to = route[(index + 1) % route.length]!;
      return {
        from,
        to,
        rest: 36 + (((seed + index) * 29) % 48),
        flight: Math.max(shortestButterflyFlight, Math.round(distance(from, to) / butterflyFlightSpeed)),
      };
    });
    return {
      frames: colors[(anchorSeed + sibling) % colors.length]!,
      legs,
      cycle: legs.reduce((sum, leg) => sum + leg.rest + leg.flight, 0),
      phase: seed * 37,
    };
  });
}

// Butterflies visit flower patches, which are flowers touching through any of their eight neighbors, and orchards,
// which are clusters of fruit trees. Plain trees and woodland get none.
function butterflies(scenery: Scenery): Butterfly[] {
  const patches = groupsOf(
    scenery.flowers.map((flower) => flower.position),
    (first, second) => Math.abs(first.column - second.column) <= 1 && Math.abs(first.row - second.row) <= 1,
  ).map((patch) =>
    groupButterflies(
      patch.map(({ column, row }) => ({ x: column * tileSize + tileSize / 2, y: row * tileSize + tileSize / 2 })),
      patch[0]!,
    ),
  );
  // The canopy rises one tile above the footprint, so its stops sit over each footprint tile near the top of the leaves.
  const orchards = groupsOf(
    scenery.trees.filter((tree) => !tree.variant.equals(TreeVariant.NoFruit)),
    (first, second) => first.sharesClusterWith(second),
  ).map((orchard) =>
    groupButterflies(
      orchard.flatMap((tree) =>
        tree.footprint.map(({ column, row }) => ({ x: column * tileSize + tileSize / 2, y: row * tileSize - 6 })),
      ),
      orchard[0]!.base,
      butterflyArt.filter((_, color) =>
        orchard.every((tree) => fruitButterflyColors[tree.variant.name]!.includes(color)),
      ),
    ),
  );
  return [...patches, ...orchards].flat();
}

// The ground is drawn half a tile off the level grid so that each drawn tile sees four level tiles at its corners, which keeps every transition inside one 16 tile set.
function groundTiles(scenery: Scenery): GroundTile[] {
  const { columns, rows } = scenery.size;
  const at = (column: number, row: number): Ground =>
    scenery.groundAt(TilePosition.at(clamp(column, 0, columns - 1), clamp(row, 0, rows - 1)));
  const tiles: GroundTile[] = [];
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const corners = [at(column - 1, row - 1), at(column, row - 1), at(column - 1, row), at(column, row)];
      const variant = (column * 5 + row * 3 + ((column * row) % 2)) % 3;
      const mask = (ground: Ground): number =>
        corners.reduce((bits, corner) => (bits << 1) | (corner.equals(ground) ? 1 : 0), 0);
      let frames: readonly Art[] | undefined;
      if (mask(Ground.Grass) === 15) frames = [grassArt[variant]!];
      else if (mask(Ground.Path) === 15) frames = [pathArt[variant]!];
      else if (mask(Ground.Water) === 15) frames = waterArt[variant];
      else
        frames =
          terrainArt[
            corners
              .map((ground) => (ground.equals(Ground.Water) ? 'w' : ground.equals(Ground.Path) ? 'p' : 'g'))
              .join('')
          ];
      if (!frames) throw new RangeError(`No ground art for ${column}, ${row}`);
      tiles.push({ x: column * tileSize - tileSize / 2, y: row * tileSize - tileSize / 2, frames });
    }
  }
  return tiles;
}

interface WaterLily {
  readonly x: number;
  readonly y: number;
  readonly art: Art;
}

const lilyDrift = 4;
const secondGroupArea = 12;

interface Lilies {
  readonly lilies: readonly WaterLily[];
  readonly ponds: readonly (readonly number[])[];
}

// Pads sit on the half-offset ground grid, where four water corners mean a tile with no shore foam at all.
function waterLilies(scenery: Scenery, random: () => number): Lilies {
  const { columns, rows } = scenery.size;
  const isWater = (column: number, row: number): boolean =>
    scenery.groundAt(TilePosition.at(column, row)).equals(Ground.Water);
  const open = new Set<number>();
  for (let row = 1; row < rows; row++)
    for (let column = 1; column < columns; column++)
      if (isWater(column - 1, row - 1) && isWater(column, row - 1) && isWater(column - 1, row) && isWater(column, row))
        open.add(row * columns + column);
  // Column 0 is never open, so stepping one key across a row edge can never land on an open tile.
  const neighbors = (key: number): number[] =>
    [key - 1, key + 1, key - columns, key + columns].filter((next) => open.has(next));
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
  const between = (low: number, high: number): number => low + Math.floor(random() * (high - low + 1));
  const chosen: number[] = [];
  const ponds: number[][] = [];
  const seen = new Set<number>();
  for (const start of open) {
    if (seen.has(start)) continue;
    seen.add(start);
    const pond = [start];
    for (let index = 0; index < pond.length; index++)
      for (const next of neighbors(pond[index]!))
        if (!seen.has(next)) {
          seen.add(next);
          pond.push(next);
        }
    const taken = new Set<number>();
    const grow = (seed: number, size: number): void => {
      taken.add(seed);
      const group = [seed];
      while (group.length < size) {
        const frontier = group.flatMap(neighbors).filter((next) => !taken.has(next));
        if (frontier.length === 0) break;
        const next = pick(frontier);
        taken.add(next);
        group.push(next);
      }
      chosen.push(...group);
    };
    const firstPad = chosen.length;
    grow(pick(pond), between(3, 5));
    if (pond.length >= secondGroupArea) {
      const apart = pond.filter((key) => !taken.has(key) && neighbors(key).every((next) => !taken.has(next)));
      if (apart.length > 0) grow(pick(apart), between(2, 3));
    }
    ponds.push(Array.from({ length: chosen.length - firstPad }, (_, index) => firstPad + index));
  }
  const positions = chosen.map((key) => TilePosition.at(key % columns, Math.floor(key / columns)));
  const drift = (): number => Math.round((random() * 2 - 1) * lilyDrift);
  const choices = propVariants(
    positions.map((position) => [position]),
    waterLilyVariants.length,
  );
  const lilies = positions.map((position, index) => ({
    x: position.column * tileSize - tileSize / 2 + drift(),
    y: position.row * tileSize - tileSize / 2 + drift(),
    art: waterLilyVariants[choices[index]!]!,
  }));
  return { lilies, ponds };
}

export interface FrogLeg {
  readonly from: Point;
  readonly to: Point;
  readonly facing: 'left' | 'right';
  readonly rest: number;
  readonly croaks: boolean;
  readonly dive: boolean;
}

export interface Frog {
  readonly legs: readonly FrogLeg[];
  readonly cycle: number;
  readonly phase: number;
}

export const frogLeapLength = 24;
export const frogDiveLength = 120;
const mostFrogsPerPond = 2;
const frogLegs = 6;
const shortestFrogRest = 300;
const frogRestSpread = 480;
// A leap only spans neighboring pads, so a frog reaches a distant clump by swimming under water instead.
const frogLeapReach = tileSize * 2;
const frogLeapChance = 0.6;
const frogCroakChance = 0.5;

// Each frog keeps its own share of the pond's pads, so two frogs never land on the same pad.
function frogs({ lilies, ponds }: Lilies, random: () => number): Frog[] {
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
  const center = ({ x, y }: WaterLily): Point => ({ x: x + tileSize / 2, y: y + tileSize / 2 });
  return ponds.flatMap((pond) => {
    const count = Math.min(pond.length, Math.floor(random() * (mostFrogsPerPond + 1)));
    return Array.from({ length: count }, (_, frog) => {
      const pads = pond.filter((_, index) => index % count === frog).map((index) => center(lilies[index]!));
      const legs: FrogLeg[] = [];
      let at = pads[0]!;
      let facing: FrogLeg['facing'] = random() < 0.5 ? 'left' : 'right';
      for (let leg = 0; leg < frogLegs; leg++) {
        const near = pads.filter((pad) => pad !== at && distance(pad, at) <= frogLeapReach);
        // The last leg ends where the first began, so the cycle repeats without a jump.
        const home = leg === frogLegs - 1;
        const leaps = home ? near.includes(pads[0]!) : near.length > 0 && random() < frogLeapChance;
        const to = home ? pads[0]! : leaps ? pick(near) : pick(pads);
        const rest = shortestFrogRest + Math.floor(random() * frogRestSpread);
        legs.push({ from: at, to, facing, rest, croaks: random() < frogCroakChance, dive: !leaps });
        if (to.x !== at.x) facing = to.x < at.x ? 'left' : 'right';
        at = to;
      }
      const cycle = legs.reduce((sum, leg) => sum + leg.rest + (leg.dive ? frogDiveLength : frogLeapLength), 0);
      return { legs, cycle, phase: Math.floor(random() * cycle) };
    });
  });
}

export function propVariants(footprints: readonly (readonly TilePosition[])[], count: number): readonly number[] {
  const choices = new Map<number, number>();
  const ordered = footprints
    .map((footprint, index) => ({ footprint, index }))
    .sort(
      (first, second) =>
        first.footprint[0]!.row - second.footprint[0]!.row || first.footprint[0]!.column - second.footprint[0]!.column,
    );
  for (const { footprint, index } of ordered) {
    const excluded = new Set<number>();
    for (const [neighbor, choice] of choices) {
      if (
        footprint.some((position) =>
          footprints[neighbor]!.some(
            (other) => Math.abs(position.column - other.column) + Math.abs(position.row - other.row) <= 1,
          ),
        )
      )
        excluded.add(choice);
    }
    const start = (footprint[0]!.column * 3 + footprint[0]!.row * 5) % count;
    const selected = Array.from({ length: count }, (_, offset) => (start + offset) % count).find(
      (choice) => !excluded.has(choice),
    );
    if (selected === undefined) throw new RangeError('Touching props need another art variant');
    choices.set(index, selected);
  }
  return footprints.map((_, index) => choices.get(index)!);
}

export interface WorldDressing {
  readonly ground: readonly GroundTile[];
  readonly lilies: readonly WaterLily[];
  readonly frogs: readonly Frog[];
  readonly undergrowth: readonly Undergrowth[];
  readonly trees: readonly (readonly Art[])[];
  readonly woodland: readonly WoodlandTree[];
  readonly stones: readonly Art[];
  readonly flowers: readonly (readonly Art[])[];
  readonly fences: readonly Art[];
  readonly butterflies: readonly Butterfly[];
}

export function dressWorld(level: LevelView, random?: () => number): WorldDressing {
  // A tree cluster shares one variant, so no-fruit trees only ever touch each other and are spread over their own art.
  const fruitArt = new Map([
    [TreeVariant.Oranges, fruitTreeArt.orange],
    [TreeVariant.Apples, fruitTreeArt.apple],
    [TreeVariant.Lemons, fruitTreeArt.lemon],
  ]);
  const plainTrees = level.scenery.trees.filter((tree) => tree.variant.equals(TreeVariant.NoFruit));
  const plainChoices = propVariants(
    plainTrees.map((tree) => tree.footprint),
    treeArt.length,
  );
  const trees = level.scenery.trees.map(
    (tree) => fruitArt.get(tree.variant) ?? treeVersion(plainChoices[plainTrees.indexOf(tree)]!, tree.base),
  );
  const nearWater = ({ column, row }: TilePosition): boolean =>
    [-2, -1, 0, 1, 2].some((down) =>
      [-2, -1, 0, 1, 2].some((across) => {
        const tile = TilePosition.at(column + across, row + down);
        return level.scenery.size.contains(tile) && level.scenery.groundAt(tile).equals(Ground.Water);
      }),
    );
  // Mossy art shares the plain art's shapes by index, so the no-touch rule still holds across both sets.
  const stones = propVariants(
    level.stones.map((stone) => [stone.position]),
    stoneVariants.length,
  ).map((choice, index) => (nearWater(level.stones[index]!.position) ? mossyStoneVariants : stoneVariants)[choice]!);
  const flowers = propVariants(
    level.scenery.flowers.map((flower) => [flower.position]),
    level.scenery.flowerVariants.length,
  ).map((choice) => flowerArt[FlowerVariant.All.indexOf(level.scenery.flowerVariants[choice]!)]!);
  const joins = (position: TilePosition): boolean => level.scenery.joinsFence(position, level.door, level.gates);
  const fences = level.scenery.fences.map(
    ({ position }) =>
      fenceArt[
        [Direction.Up, Direction.Down, Direction.Left, Direction.Right].reduce(
          (piece, direction) => (piece << 1) | (joins(position.neighbor(direction)) ? 1 : 0),
          0,
        )
      ]!,
  );
  const water = random ? waterLilies(level.scenery, random) : { lilies: [], ponds: [] };
  return {
    ground: groundTiles(level.scenery),
    lilies: water.lilies,
    frogs: random ? frogs(water, random) : [],
    undergrowth: undergrowth(level),
    trees,
    woodland: woodlandTrees(level.scenery),
    stones,
    flowers,
    fences,
    butterflies: butterflies(level.scenery),
  };
}
