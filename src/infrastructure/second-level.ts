import { type Level } from '../domain/level/level';
import { FlowerVariant } from '../domain/level/scenery';
import { LevelId } from '../domain/shared/level-id';
import { levelFromLayout, type Shuffle } from './level-layout';

export const secondLevelId = LevelId.of('second');

const layout = [
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWDDDWWWW',
  'WW.......WWWWWWWWW###...W',
  'W..o+.o+..WW..WWWW#.....W',
  'W.######..W.....WW#LtLt.W',
  'W.#.oo.######...WW##*...W',
  'W.#@...#....#Nt.WW.#.K+.W',
  'W.######W.Nt####WFFGFFFFW',
  'W.o.#o..W......#.**#**..W',
  'W.+.#..WW...Nt+#####..+.W',
  'W...#..WWW+.............W',
  'W...#WWWWW.....WWWWWWW.WW',
  'W...##...WWWWWWWWW...WWWW',
  'W....#.~....WWWWW..+....W',
  'W.+.##.~~~~.....W.**.#+.W',
  'W...#.~~~~~~~+.#######..W',
  'W...#..~~~~~...#**.....WW',
  'W...#..........#.+WW.@.WW',
  'W.+.######.....#...W....W',
  'WW.+..#..#######......+.W',
  'WW....#.......W...+....WW',
  'WWW...H..+....W.+.....WWW',
  'WWWW........WWW.......WWW',
  'WWWWW...WWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
];

export function secondLevel(shuffle: Shuffle): Level {
  return levelFromLayout(secondLevelId, layout, shuffle, {
    flowerVariants: [FlowerVariant.WhiteViolet, FlowerVariant.CoralBlue],
    keys: { K: { restores: () => true } },
  });
}
