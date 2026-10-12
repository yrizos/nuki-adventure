import { type Level } from '../domain/level/level';
import { FlowerVariant } from '../domain/level/scenery';
import { LevelId } from '../domain/shared/level-id';
import { levelFromLayout, type Shuffle } from './level-layout';

export const secondLevelId = LevelId.of('second');

const layout = [
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWW.....DDD.....WWWWWW',
  'WWWW........#..+.....+WWW',
  'WWW.*+......#......*..WWW',
  'W....~~~.#####..*.Tt....W',
  'W.+o~~~~~.*+.#....o+....W',
  'W..~~~~~~..####.o....#..W',
  'W.K~~~~~~~.#..########..W',
  'W...~~~~~..##*.##...+Tt.W',
  'W.....~~....#.*.##.*o#..W',
  'WWW..+*...+......#####..W',
  'WWWWW.......WWWW.#...+..W',
  'W...WWWW..WWWWWWFGFWW...W',
  'W....WWWWWW..+...#..WWWWW',
  'W........*......######.WW',
  'W..*+At*+At....##Nt.*#..W',
  'W...o###########..*..o+.W',
  'W....#Lt..+#.#######Nt..W',
  'W.+At.#.*#####.+...###..W',
  'W...o.##....#Lt*....*#+.W',
  'W....+.####H#....Nt.Lt..W',
  'WW..**.At........o+....WW',
  'WWW...................WWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
];

export function secondLevel(shuffle: Shuffle): Level {
  return levelFromLayout(secondLevelId, layout, shuffle, {
    flowerVariants: [FlowerVariant.WhiteCoral, FlowerVariant.BlueViolet],
    keys: { K: { restores: () => true } },
  });
}
