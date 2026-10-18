import { type Level } from '../domain/level';
import { FlowerVariant } from '../domain/scenery';
import { LevelId } from '../domain/level-id';
import type { PlaceObstacles } from '../domain/obstacles';
import type { Random } from '../domain/random';
import type { Shuffle } from '../domain/shuffle';
import { levelFromLayout } from './level-layout';

export const secondLevelId = LevelId.of('second');

const layout = [
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWDDDWWWW',
  'WW.......WWWWWWWWW###...W',
  'W..o..o...WW..WWWW#.....W',
  'W.######..W.....WW#LtLt.W',
  'W.#.oo.######...WW##*...W',
  'W.#....#....#Nt.WW.#.Q..W',
  'W.######W.Nt####WFFGFFFFW',
  'W.o.#o..W......#.**#**..W',
  'W...#..WW...Nt.#####....W',
  'W...#..WWW..............W',
  'W...#WWWWW.....WWWWWWW.WW',
  'W...##...WWWWWWWWW...WWWW',
  'W....#.~....WWWWW.......W',
  'W...##.~~~~.....W.**.#..W',
  'W...#.~~~~~~~..#######..W',
  'W...#..~~~~~...#**.....WW',
  'W...#..........#..WW...WW',
  'W...######.....#...W....W',
  'WW....#Q.#######........W',
  'WW....#.......W........WW',
  'WWW...H.......W.......WWW',
  'WWWW........WWW.......WWW',
  'WWWWW...WWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
];

export function secondLevel(shuffle: Shuffle, placeObstacles: PlaceObstacles, random: Random): Level {
  return levelFromLayout(secondLevelId, layout, shuffle, placeObstacles, random, {
    flowerVariants: [FlowerVariant.WhiteViolet, FlowerVariant.CoralBlue],
  });
}
