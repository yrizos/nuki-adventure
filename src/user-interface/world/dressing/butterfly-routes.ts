import { type Scenery, type TilePosition, TreeVariant } from '../../../level';
import type { Art } from '../../graphics/art';
import { butterflyArt } from '../../graphics/sprite-library';
import { between, type Point } from '../point';
import { tileSize } from '../world-geometry';

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
// Patches this many tiles apart share one butterfly, so a meadow of small patches does not swarm.
const flowerAreaReach = 5;

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

// Each hop goes to the nearest stop not yet visited, and the route then retraces itself, so a butterfly only ever
// flies between nearby stops and never crosses the whole group to get back to its start.
function butterflyRoute(stops: readonly Point[], start: number): Point[] {
  const left = stops.filter((_, index) => index !== start);
  const route = [stops[start]!];
  while (left.length > 0) {
    const last = route.at(-1)!;
    let nearest = 0;
    left.forEach((stop, index) => {
      if (between(stop, last) < between(left[nearest]!, last)) nearest = index;
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
        flight: Math.max(shortestButterflyFlight, Math.round(between(from, to) / butterflyFlightSpeed)),
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

// Butterflies visit flower areas, which are flowers within a short reach of each other, and orchards, which are
// clusters of fruit trees. Plain trees and woodland get none.
export function butterflies(scenery: Scenery): Butterfly[] {
  const patches = groupsOf(
    scenery.flowers.map((flower) => flower.position),
    (first, second) =>
      Math.abs(first.column - second.column) <= flowerAreaReach && Math.abs(first.row - second.row) <= flowerAreaReach,
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
