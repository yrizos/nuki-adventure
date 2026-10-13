import { type Level } from '../domain/level/level';
import { FlowerVariant } from '../domain/level/scenery';
import { LevelId } from '../domain/shared/level-id';
import { levelFromLayout, type Shuffle } from './level-layout';

export const firstLevelId = LevelId.of('first');

const layout = [
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWDDDWWWWW...WWW',
  'WWWWW*.*WWW.#.WW.*..+.*WW',
  'WW....+..W.###....###..*W',
  'WW*......###.###.##.#K.WW',
  'W.*Tt..+##...WW###.*....W',
  'W.......#..WWWWW..**..+.W',
  'WW+...Tt##WWWWWWWWW..W..W',
  'WW.Tt....#WWWWWWW.WWWWWWW',
  'WW.....oo##WWWW.....W...W',
  'W....~~~..###W....+...+WW',
  'W.+~~~~~~~..###.At.....WW',
  'W..~~~~@~~~...#...*+At.WW',
  'WW.+.~~.~~..At##.......*W',
  'WW..**....+....#.At.....W',
  'WWWW.*.+.......##...At..W',
  'WWWWWWW.WWW.WWW.#*+....WW',
  'WWWWWWWWW.WWW.W.#....+.WW',
  'WWW.**WWW.....W.#*.~~*..W',
  'W.**@.###.+...###o~~~.+.W',
  'WW*..oo.###.###.......*.W',
  'WW.*+*....##H....*..+.WWW',
  'WWWW......W.#..WW..W.WWWW',
  'WWWWWWW.WWW...WWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
];

export function firstLevel(shuffle: Shuffle): Level {
  return levelFromLayout(firstLevelId, layout, shuffle, {
    flowerVariants: [FlowerVariant.WhiteCoral, FlowerVariant.BlueViolet],
    keys: { K: { restores: () => true } },
  });
}
