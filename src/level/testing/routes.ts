import type { Level } from '../domain/level';
import { Direction, TilePosition, TilePositions, tileKey } from '../domain/position';

const directions = [Direction.Up, Direction.Down, Direction.Left, Direction.Right];
// Three steps keep a star out of the view she has while walking the route, so finding it takes a detour.
const explorationDistance = 3;

// Gates and any boulder count as open, because she can always open the gates and move the boulder.
function open(level: Level): (tile: TilePosition) => boolean {
  return (tile) =>
    level.scenery.isWalkable(tile) &&
    !level.stones.some((stone) => stone.position.equals(tile)) &&
    !level.door.covers(tile);
}

function distances(level: Level, sources: readonly TilePosition[]): Map<number, number> {
  const enterable = open(level);
  const distance = new Map(sources.map((tile) => [tileKey(tile), 0]));
  const reached = [...sources];
  for (let index = 0; index < reached.length; index++) {
    const here = reached[index]!;
    for (const direction of directions) {
      const next = here.neighbor(direction);
      if (distance.has(tileKey(next)) || !enterable(next)) continue;
      distance.set(tileKey(next), distance.get(tileKey(here))! + 1);
      reached.push(next);
    }
  }
  return distance;
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]),
  );
}

// Every tile of every equally short walk counts, because she may take any of them.
export function mandatoryRoute(level: Level): TilePositions {
  const reachable = [...distances(level, [level.hero.position]).keys()];
  const tiles = level.scenery.size;
  const all = Array.from({ length: tiles.columns * tiles.rows }, (_, index) =>
    TilePosition.at(index % tiles.columns, Math.floor(index / tiles.columns)),
  ).filter((tile) => reachable.includes(tileKey(tile)));
  const beforeDoor = all.filter((tile) => directions.some((direction) => level.door.covers(tile.neighbor(direction))));
  const legs = permutations(level.keys.map((key) => key.position)).map((order) =>
    [[level.hero.position], ...order.map((key) => [key])]
      .map((from, index) => [from, index < order.length ? [order[index]!] : beforeDoor] as const)
      .map(([from, to]) => ({ from: distances(level, from), to: distances(level, to) })),
  );
  const length = (leg: { from: Map<number, number>; to: Map<number, number> }): number =>
    Math.min(...all.map((tile) => leg.from.get(tileKey(tile))! + leg.to.get(tileKey(tile))!));
  const totals = legs.map((walk) => walk.reduce((sum, leg) => sum + length(leg), 0));
  const shortest = Math.min(...totals);
  return TilePositions.of(
    all.filter((tile) =>
      legs.some(
        (walk, index) =>
          totals[index] === shortest &&
          walk.some((leg) => leg.from.get(tileKey(tile))! + leg.to.get(tileKey(tile))! === length(leg)),
      ),
    ),
  );
}

export function explorationArea(level: Level): TilePositions {
  const enterable = open(level);
  const route = mandatoryRoute(level).tiles;
  const distance = new Map(route.map((tile) => [tileKey(tile), 0]));
  const reached = [...route];
  for (let index = 0; index < reached.length; index++) {
    const here = reached[index]!;
    for (const direction of directions) {
      const next = here.neighbor(direction);
      if (distance.has(tileKey(next)) || !enterable(next)) continue;
      distance.set(tileKey(next), distance.get(tileKey(here))! + 1);
      reached.push(next);
    }
  }
  return TilePositions.of(reached.filter((tile) => distance.get(tileKey(tile))! >= explorationDistance));
}
