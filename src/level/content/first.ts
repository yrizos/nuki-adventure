import { type Level } from '../domain/level';
import { FlowerVariant } from '../domain/scenery';
import { LevelId } from '../domain/level-id';
import type { PlaceObstacles } from '../domain/obstacles';
import type { Random } from '../domain/random';
import type { Shuffle } from '../domain/shuffle';
import { levelFromLayout } from './level-layout';

export const firstLevelId = LevelId.of('first');

const layout = [
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWDDDWWWWW...WWW',
  'WWWWW*.*WWW.#.WW.*....*WW',
  'WW.......W.###....###..*W',
  'WW*......###.###.##.#Q.WW',
  'W.*Tt...##...WW###.*....W',
  'W.......#..WWWWW..**....W',
  'WW....Tt##WWWWWWWWW..W..W',
  'WW.Tt....#WWWWWWW.WWWWWWW',
  'WW.....oo##WWWW.....W...W',
  'W....~~~..###W.........WW',
  'W..~~~~~~~..###.At.....WW',
  'W..~~~~.~~~...#...*.At.WW',
  'WW...~~.~~..At##.......*W',
  'WW..**.........#.At.....W',
  'WWWW.*.........##...At..W',
  'WWWWWWW.WWW.WWW.#*.....WW',
  'WWWWWWWWW.WWW.W.#......WW',
  'WWW.**WWW.....W.#*.~~*..W',
  'W.**..###...Q.###o~~~...W',
  'WW*..oo.###.###.......*.W',
  'WW.*.*....##H....*....WWW',
  'WWWW......W.#..WW..W.WWWW',
  'WWWWWWW.WWW...WWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
];

export function firstLevel(shuffle: Shuffle, placeObstacles: PlaceObstacles, random: Random): Level {
  return levelFromLayout(firstLevelId, layout, shuffle, placeObstacles, random, {
    flowerVariants: [FlowerVariant.WhiteCoral, FlowerVariant.BlueViolet],
  });
}
