import { type Level } from '../domain/level/level';
import { FlowerVariant } from '../domain/level/scenery';
import { LevelId } from '../domain/shared/level-id';
import { levelFromLayout, type Shuffle } from './level-layout';

export const thirdLevelId = LevelId.of('third');

const layout = [
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
  'WDDDWWWWWWWWWWWW...WWWWWW',
  'W.#..WW.WWWW.....+.WWWWWW',
  'W.#########.........WWWWW',
  'WW.....#..######..+...WWW',
  'WWW....#.W.FFFFGFFFFF..WW',
  'W....+##...F*..#...*F..WW',
  'W.+.W.#.WW.F.At#.At.F+..W',
  'WW....#.WW.F...#....F.WWW',
  'WWW+..#..W.F+..##At+F.WWW',
  'WWW..##..W.F.At.#...F...W',
  'WWW..#..WW.F**K.#.**F.+WW',
  'WWW..#.....FFFFFGFFFF..WW',
  'WWWW.##..+......#####.WWW',
  'WWW...#...~~+.~~....#..WW',
  'W...+.#.o~~~~~~~~~Tt#.WWW',
  'W.+...##o~~@~~~~~...#.WWW',
  'WW.....#.~~#~~~.....#.WWW',
  'WWW.+..##.~#~~......#...W',
  'WWWW....########....#.+.W',
  'WWWW.+.........######...W',
  'WWWWW.....+....H......@WW',
  'WWWWWWWWWW...+....WW...WW',
  'WWWWWWWWWWWW......WWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
];

export function thirdLevel(shuffle: Shuffle): Level {
  return levelFromLayout(thirdLevelId, layout, shuffle, {
    flowerVariants: [FlowerVariant.CoralBlue, FlowerVariant.WhiteViolet],
    keys: { K: { restores: () => true } },
  });
}
