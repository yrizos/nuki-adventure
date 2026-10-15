import { Boulder } from '../domain/level/boulder';
import { Area, Key, type KeyMaterial } from '../domain/level/collectibles';
import type { StarCount } from '../domain/shared/star-count';
import { Door } from '../domain/level/door';
import { Level, Stone } from '../domain/level/level';
import { type LevelId } from '../domain/shared/level-id';
import { Direction, TilePosition } from '../domain/level/position';
import {
  Fence,
  Flower,
  type FlowerVariant,
  Ground,
  LevelSize,
  Scenery,
  Tree,
  TreeVariant,
} from '../domain/level/scenery';
import { SwingGate } from '../domain/level/swing-gate';
import { check2dObstacles } from './check2d-obstacles';

interface LayoutContents {
  readonly keys: Readonly<
    Record<string, { readonly restores: (position: TilePosition) => boolean; readonly material?: KeyMaterial }>
  >;
  readonly starCount?: StarCount;
  readonly flowerVariants?: readonly FlowerVariant[];
}

const treeVariants = new Map([
  ['T', TreeVariant.NoFruit],
  ['N', TreeVariant.Oranges],
  ['A', TreeVariant.Apples],
  ['L', TreeVariant.Lemons],
]);

export type Shuffle = (positions: readonly TilePosition[]) => readonly TilePosition[];

export function levelFromLayout(
  id: LevelId,
  layout: readonly string[],
  shuffle: Shuffle,
  contents: LayoutContents,
): Level {
  const size = LevelSize.of(layout[0]!.length, layout.length);
  const cells = layout.flatMap((line, row) =>
    [...line].map((symbol, column) => ({ symbol, at: TilePosition.at(column, row) })),
  );
  const where = (symbol: string): TilePosition[] =>
    cells.filter((cell) => cell.symbol === symbol).map((cell) => cell.at);
  const ground = layout.map((line) =>
    [...line].map((symbol) => ('#DHG=P'.includes(symbol) ? Ground.Path : symbol === '~' ? Ground.Water : Ground.Grass)),
  );
  const scenery = Scenery.of(
    size,
    ground,
    cells.flatMap(({ symbol, at }) => {
      const variant = treeVariants.get(symbol);
      return variant ? [Tree.at(at, variant)] : [];
    }),
    where('*').map(Flower.at),
    where('F').map(Fence.at),
    contents.flowerVariants,
    where('W'),
  );
  const one = (symbol: string): TilePosition => {
    const [position, ...others] = where(symbol);
    if (!position || others.length > 0)
      throw new Error(`The layout of level ${id.value} needs exactly one "${symbol}"`);
    return position;
  };
  const [door, ...doorTiles] = where('D');
  if (!door || doorTiles.length !== 2 || !doorTiles.every((tile) => Door.closedAt(door).covers(tile)))
    throw new Error(`The layout of level ${id.value} needs exactly one door`);
  const fenced = (tile: TilePosition): boolean => where('F').some((fence) => fence.equals(tile));
  const gates = where('G').map((gate) => {
    const inRow = fenced(gate.neighbor(Direction.Left)) && fenced(gate.neighbor(Direction.Right));
    const inColumn = fenced(gate.neighbor(Direction.Up)) && fenced(gate.neighbor(Direction.Down));
    if (inRow === inColumn)
      throw new Error(`The gate of level ${id.value} must hang between two fences, in a row or in a column`);
    return SwingGate.closedAt(gate, inColumn ? Direction.Left : Direction.Down);
  });
  if (gates.length > 2) throw new Error(`The layout of level ${id.value} holds at most two gates`);
  const plates = where('P');
  if (plates.length > 1) throw new Error(`The layout of level ${id.value} holds at most one pressure plate`);
  const starSpots = cells.filter((cell) => '+='.includes(cell.symbol)).map((cell) => cell.at);
  const permanentStars = where('@');
  if ((starSpots.length > 0 || permanentStars.length > 0) && contents.starCount)
    throw new Error(`The layout of level ${id.value} marks star spots, so it takes no star count`);
  const keys = Object.entries(contents.keys).map(([symbol, { restores, material }]) =>
    Key.at(one(symbol), Area.of(cells.map((cell) => cell.at).filter(restores)), material),
  );
  const boulderSpots = where('O');
  const definition = (boulders: readonly Boulder[]) => ({
    id,
    scenery,
    stones: where('o').map(Stone.at),
    keys,
    door: Door.closedAt(door),
    hero: { position: one('H'), facing: Direction.Up },
    gates,
    ...(plates[0] ? { plate: plates[0] } : {}),
    boulders,
    obstacles: check2dObstacles,
  });
  const build = (boulders: readonly Boulder[]): Level => {
    if (contents.starCount) return Level.withScatteredStars(definition(boulders), contents.starCount, shuffle);
    return starSpots.length > 0 || permanentStars.length > 0
      ? Level.withStarsAmong(definition(boulders), starSpots, shuffle, permanentStars)
      : Level.create(definition(boulders));
  };
  // The spots mark where the one boulder may start, and every spot must make a sound level, not only the one the shuffle picks.
  for (const spot of boulderSpots) build([Boulder.at(spot)]);
  return build(shuffle(boulderSpots).slice(0, 1).map(Boulder.at));
}
