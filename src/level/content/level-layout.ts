import { Boulder } from '../domain/boulder';
import { Door } from '../domain/door';
import { Level, Stone } from '../domain/level';
import { type LevelId } from '../domain/level-id';
import { Direction, TilePosition } from '../domain/position';
import { Fence, Flower, type FlowerVariant, Ground, LevelSize, Scenery, Tree, TreeVariant } from '../domain/scenery';
import { SwingGate } from '../domain/swing-gate';
import type { PlaceObstacles } from '../domain/obstacles';
import type { Random } from '../domain/random';
import type { Shuffle } from '../domain/shuffle';

interface LayoutContents {
  readonly flowerVariants?: readonly FlowerVariant[];
}

const treeVariants = new Map([
  ['T', TreeVariant.NoFruit],
  ['N', TreeVariant.Oranges],
  ['A', TreeVariant.Apples],
  ['L', TreeVariant.Lemons],
]);

export function levelFromLayout(
  id: LevelId,
  layout: readonly string[],
  shuffle: Shuffle,
  placeObstacles: PlaceObstacles,
  random: Random,
  contents: LayoutContents = {},
): Level {
  const size = LevelSize.of(layout[0]!.length, layout.length);
  const cells = layout.flatMap((line, row) =>
    [...line].map((symbol, column) => ({ symbol, at: TilePosition.at(column, row) })),
  );
  const where = (symbol: string): TilePosition[] =>
    cells.filter((cell) => cell.symbol === symbol).map((cell) => cell.at);
  const ground = layout.map((line) =>
    [...line].map((symbol) => ('#DHGPB'.includes(symbol) ? Ground.Path : symbol === '~' ? Ground.Water : Ground.Grass)),
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
  const permanentOrbs = where('Q');
  const boulderSpots = [...where('O'), ...where('B')];
  const definition = (boulders: readonly Boulder[]) => ({
    id,
    scenery,
    stones: where('o').map(Stone.at),
    door: Door.closedAt(door),
    hero: { position: one('H'), facing: Direction.Up },
    gates,
    ...(plates[0] ? { plate: plates[0] } : {}),
    boulders,
    obstacles: placeObstacles,
  });
  const build = (boulders: readonly Boulder[]): Level => Level.withOrbs(definition(boulders), permanentOrbs, random);
  // The spots mark where the one boulder may start, and every spot must make a sound level, not only the one the shuffle picks.
  for (const spot of boulderSpots) build([Boulder.at(spot)]);
  return build(shuffle(boulderSpots).slice(0, 1).map(Boulder.at));
}
