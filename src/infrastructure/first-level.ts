import { Hero } from '../domain/level/hero';
import { Level, LevelId, Orb, OrbColor, Stone } from '../domain/level/level';
import { Direction, TilePosition } from '../domain/level/position';
import { Flower, Ground, LevelSize, Scenery, Tree } from '../domain/level/scenery';

export const firstLevelId = LevelId.of('first');

const layout = [
  '..................',
  '.....*......Tt....',
  '..Tt..........*...',
  '.............O....',
  '....*..Tt....#....',
  '.............#..o.',
  '......o......#....',
  '..........**.#....',
  '...............Tt.',
  '..############....',
  '..#...*.........*.',
  'Tt#...............',
  '..#..o...~~~...o..',
  '..#.....~~~~~.....',
  '..#......~~~....*.',
  '..H....*.....Tt...',
  '.....Tt...........',
  '..................',
];

export function firstLevel(): Level {
  const size = LevelSize.of(layout[0]!.length, layout.length);
  const cells = layout.flatMap((line, row) => [...line].map((symbol, column) => ({ symbol, at: TilePosition.at(column, row) })));
  const where = (symbol: string): TilePosition[] => cells.filter((cell) => cell.symbol === symbol).map((cell) => cell.at);
  const ground = layout.map((line) =>
    [...line].map((symbol) => ('#OH'.includes(symbol) ? Ground.Path : symbol === '~' ? Ground.Water : Ground.Grass)),
  );
  const scenery = Scenery.of(size, ground, where('T').map(Tree.at), where('*').map(Flower.at));
  const [orb] = where('O');
  const [start] = where('H');
  if (!orb || !start) throw new Error('The first level layout needs an orb and a hero start');
  return new Level(firstLevelId, scenery, where('o').map(Stone.at), Orb.at(orb, OrbColor.Violet), new Hero(start, Direction.Down));
}
