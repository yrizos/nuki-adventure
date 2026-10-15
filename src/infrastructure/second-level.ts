import { type Level } from '../domain/level/level';
import { FlowerVariant } from '../domain/level/scenery';
import { LevelId } from '../domain/shared/level-id';
import { levelFromLayout, type Shuffle } from './level-layout';

export const secondLevelId = LevelId.of('second');

const layout = [
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWDDDWWWW',
  'WW.......WWWWWWWWF###...W',
  'W..o..o+..WW..WWWF#.+...W',
  'W.######..W######G#..Lt.W',
  'W.#.oo.#####.....F#.*...W',
  'W.#@...#.....Nt..F##....W',
  'W.######W.Nt....+F.K.Lt.W',
  'W.o.#o..W........F......W',
  'W.+.#..WW...Nt.+.F*...+.W',
  'W...#..WWW+.....WF.W**..W',
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
