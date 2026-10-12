import { type Level } from '../domain/level/level';
import { FlowerVariant } from '../domain/level/scenery';
import { LevelId } from '../domain/shared/level-id';
import { levelFromLayout, type Shuffle } from './level-layout';

export const thirdLevelId = LevelId.of('third');

const layout = [
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWDDDWWWWWWWWWWW',
  'WWWWWWW..WW.#...+.WWWWWWW',
  'WWWW+**...+.#.......WWWWW',
  'WWWW...Nt...#.**.....WWWW',
  'WW..........##.~~~..+..WW',
  'W+...........#~~~~~~...WW',
  'W...FFFFFFF..#~~~~~~~..WW',
  'WW..F.....F.##~~~...~.+WW',
  'WWW.F.....F.#..~~.+.~...W',
  'WWW.F..KAtF.#.+~~.#.~~..W',
  'WW+.FAt#..F.#..o~~#~~.+.W',
  'W...FFFGFFF.#...###.o..WW',
  'WW..**.##**.#####......WW',
  'WWW.....#####.........+.W',
  'W.+..o.....##...........W',
  'W...**...+.#.......Tt...W',
  'WLt....#####...+....TtWWW',
  'WLt....#...######..+.WWWW',
  'WWW....#....#...###..WWWW',
  'WWW+...#....#.o...#.**WWW',
  'WWW...+#....H.....##+.WWW',
  'WWWWW....+......+....WWWW',
  'WWWWWWW............WWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
];

export function thirdLevel(shuffle: Shuffle): Level {
  return levelFromLayout(thirdLevelId, layout, shuffle, {
    flowerVariants: [FlowerVariant.CoralBlue, FlowerVariant.WhiteViolet],
    keys: { K: { restores: () => true } },
  });
}
