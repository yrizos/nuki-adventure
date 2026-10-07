import { Area, Orb, type OrbColor } from '../domain/level/collectibles';
import type { StarCount } from '../domain/shared/star-count';
import { Door } from '../domain/level/door';
import { Level, Stone } from '../domain/level/level';
import { type LevelId } from '../domain/shared/level-id';
import { Direction, TilePosition } from '../domain/level/position';
import { Fence, Flower, Ground, LevelSize, Scenery, Tree } from '../domain/level/scenery';
import { Signpost, SignpostText } from '../domain/level/signpost';
import { check2dObstacles } from './check2d-obstacles';

interface LayoutContents {
  readonly orbs: Readonly<
    Record<string, { readonly color: OrbColor; readonly restores: (position: TilePosition) => boolean }>
  >;
  readonly signposts: Readonly<Record<string, string>>;
  readonly starCount: StarCount;
}

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
    [...line].map((symbol) => ('#DH'.includes(symbol) ? Ground.Path : symbol === '~' ? Ground.Water : Ground.Grass)),
  );
  const scenery = Scenery.of(
    size,
    ground,
    where('T').map(Tree.at),
    where('*').map(Flower.at),
    where('F').map(Fence.at),
  );
  const one = (symbol: string): TilePosition => {
    const [position, ...others] = where(symbol);
    if (!position || others.length > 0)
      throw new Error(`The layout of level ${id.value} needs exactly one "${symbol}"`);
    return position;
  };
  const [door] = where('D');
  if (!door) throw new Error(`The layout of level ${id.value} needs a door`);
  const orbs = Object.entries(contents.orbs).map(([symbol, { color, restores }]) =>
    Orb.at(one(symbol), color, Area.of(cells.map((cell) => cell.at).filter(restores))),
  );
  const signposts = Object.entries(contents.signposts).map(([symbol, text]) =>
    Signpost.at(one(symbol), SignpostText.of(text)),
  );
  return Level.withScatteredStars(
    {
      id,
      scenery,
      stones: where('o').map(Stone.at),
      orbs,
      door: Door.closedAt(door),
      hero: { position: one('H'), facing: Direction.Up },
      signposts,
      obstacles: check2dObstacles,
    },
    contents.starCount,
    shuffle,
  );
}
