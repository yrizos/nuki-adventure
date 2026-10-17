import { type Level } from '../domain/level';
import { FlowerVariant } from '../domain/scenery';
import { LevelId } from '../domain/level-id';
import type { PlaceObstacles } from '../domain/obstacles';
import type { Shuffle } from '../domain/shuffle';
import { levelFromLayout } from './level-layout';

export const fourthLevelId = LevelId.of('fourth');

// The boulder fills the only gap into the glade, so it alone guards the key.
const layout = [
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWDDDWWWWWW',
  'WWWW...WWWWWW**..#.WW..WW',
  'WWW..+...WWW..+.##.W...*W',
  'WW..~~~..WWW#####.WW.@.*W',
  'W*.~~~~~.####.#...WWW#K.W',
  'W*+~~@~..#....#....W.#.WW',
  'WW..~.~..#WW..###..WWOWWW',
  'W..+.....#.WW...##...#..W',
  'WW.......#WWWWWW.#####..W',
  'WWWW....##WWWWWWW......WW',
  'WWWWW..*#WWWWWWWWWW...WWW',
  'WWW.....#WWWWWWWWWWWWWWWW',
  'WW..+.At##WWWWW**.WW**WWW',
  'W........#WWWW..+......WW',
  'W..At....#WWWW..........W',
  'W.....+..##WW...Nt..+...W',
  'WW+.......#WW.........+WW',
  'W...At....#....+...Nt..WW',
  'WW........##....W.......W',
  'W..+.......#..+WW.....+.W',
  'WW.........H.@*WWW..+..WW',
  'WWW**+........*WWWW.+.WWW',
  'WWWWW..WWW...WWWWWWW.WWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
];

export function fourthLevel(shuffle: Shuffle, placeObstacles: PlaceObstacles): Level {
  return levelFromLayout(fourthLevelId, layout, shuffle, placeObstacles, {
    flowerVariants: [FlowerVariant.WhiteCoral, FlowerVariant.BlueViolet],
    keys: { K: { restores: () => true } },
  });
}
