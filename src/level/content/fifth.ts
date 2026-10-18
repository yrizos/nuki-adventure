import { type Level } from '../domain/level';
import { FlowerVariant } from '../domain/scenery';
import { LevelId } from '../domain/level-id';
import type { PlaceObstacles } from '../domain/obstacles';
import type { Random } from '../domain/random';
import type { Shuffle } from '../domain/shuffle';
import { levelFromLayout } from './level-layout';

export const fifthLevelId = LevelId.of('fifth');

// Only a boulder resting on the plate holds the lemon garden gate open, so each boulder spot sits within two tiles of it.
// The woodland reaching up from under the garden leaves the glade open only beside the door, so she sees the exit before the permanent orb.
const layout = [
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWDDDWWWWWWW.WWWWWWW',
  'WWWW....#...WWWWW....WWWW',
  'WWW.....#.####.W..~~..WWW',
  'WWW..At.###..#...~~~~..WW',
  'WWW**...#..WW##..~~.~..WW',
  'WW.....##.WWW.#..~..~.WWW',
  'WW###..#..WWW.#O..***..WW',
  'WW..####.WWW..##FFFFFF..W',
  'WWW...#..WWWW.OPF....F..W',
  'WWW...#...WWW..#F..LtF.WW',
  'WW..Tt#...WW..*#G#Q..F..W',
  'WW...##..WWW.**.F....F..W',
  'WW...#....WWW...F....F..W',
  'WWWW.#.....WWW..FFFFFF.WW',
  'WWWW.###..WWWW..**.....WW',
  'WWWW...#...WWW..*......WW',
  'WW....####..WWW..WWW..WWW',
  'WW....#..#....WWWWWWWWWWW',
  'W.*.###..###.....WWW...WW',
  'W.*.#..Nt..###.........WW',
  'WW..#o.......#H..**...WWW',
  'WWWW#.......W........WWWW',
  'WWWW...WWW..W...WW..WWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
];

export function fifthLevel(shuffle: Shuffle, placeObstacles: PlaceObstacles, random: Random): Level {
  return levelFromLayout(fifthLevelId, layout, shuffle, placeObstacles, random, {
    flowerVariants: [FlowerVariant.CoralViolet, FlowerVariant.WhiteBlue],
  });
}
