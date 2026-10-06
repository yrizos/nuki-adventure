import { Hero } from '../domain/level/hero';
import {
  Area,
  Door,
  Level,
  type LevelId,
  Orb,
  type OrbColor,
  Signpost,
  SignpostText,
  type StarCount,
  Stone,
} from '../domain/level/level';
import { Direction, TilePosition } from '../domain/level/position';
import { Fence, Flower, Ground, LevelSize, Scenery, Tree } from '../domain/level/scenery';

interface LayoutContents {
  readonly orbs: Readonly<
    Record<string, { readonly color: OrbColor; readonly restores: (position: TilePosition) => boolean }>
  >;
  readonly signposts: Readonly<Record<string, string>>;
  readonly starCount: StarCount;
}

function shuffled(positions: readonly TilePosition[]): TilePosition[] {
  const result = [...positions];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other]!, result[index]!];
  }
  return result;
}

export function levelFromLayout(id: LevelId, layout: readonly string[], contents: LayoutContents): Level {
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
    id,
    scenery,
    where('o').map(Stone.at),
    orbs,
    Door.closedAt(door),
    new Hero(one('H'), Direction.Up),
    contents.starCount,
    signposts,
    shuffled,
  );
}
