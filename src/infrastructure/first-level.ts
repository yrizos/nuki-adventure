import { Hero } from '../domain/level/hero';
import { Door, Level, LevelId, Orb, OrbColor, Stone } from '../domain/level/level';
import { Direction, TilePosition } from '../domain/level/position';
import { Fence, Flower, Ground, LevelSize, Scenery, Tree } from '../domain/level/scenery';

export const firstLevelId = LevelId.of('first');

// The two rows outside the fence give the door, which stands three tiles tall, room above its base.
const layout = [
  '..Tt.........Tt...',
  'Tt..........*...Tt',
  'FFFFFFFDDDFFFFFFFF',
  'F......###....Tt.F',
  'F.Tt....#.....*..F',
  'F.......#..o.....F',
  'F..*....##.......F',
  'F.....o..#...~~..F',
  'F.Tt.....#..~~~~.F',
  'F........#...~~O.F',
  'F...*...##....*..F',
  'F.......#..Tt....F',
  'F..o....#.....o..F',
  'F.Tt...##........F',
  'F......#...*.Tt..F',
  'F....###.........F',
  'F..*.#.....o..*..F',
  'F....H.....Tt....F',
  'F.Tt.......*.....F',
  'FFFFFFFFFFFFFFFFFF',
];

export function firstLevel(): Level {
  const size = LevelSize.of(layout[0]!.length, layout.length);
  const cells = layout.flatMap((line, row) => [...line].map((symbol, column) => ({ symbol, at: TilePosition.at(column, row) })));
  const where = (symbol: string): TilePosition[] => cells.filter((cell) => cell.symbol === symbol).map((cell) => cell.at);
  const ground = layout.map((line) =>
    [...line].map((symbol) => ('#DH'.includes(symbol) ? Ground.Path : symbol === '~' ? Ground.Water : Ground.Grass)),
  );
  const scenery = Scenery.of(size, ground, where('T').map(Tree.at), where('*').map(Flower.at), where('F').map(Fence.at));
  const [orb] = where('O');
  const [door] = where('D');
  const [start] = where('H');
  if (!orb || !door || !start) throw new Error('The first level layout needs an orb, a door and a hero start');
  return new Level(firstLevelId, scenery, where('o').map(Stone.at), Orb.at(orb, OrbColor.Violet), Door.closedAt(door),
    new Hero(start, Direction.Up));
}
