import { type Level } from '../domain/level/level';
import { FlowerVariant } from '../domain/level/scenery';
import { LevelId } from '../domain/shared/level-id';
import { levelFromLayout, type Shuffle } from './level-layout';

export const firstLevelId = LevelId.of('first');

const layout = [
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWDDDWW.+WWWWWWWWWWWW',
  'WWW....#..+......+**WWWWW',
  'WWW.Lt.#.....Nt......AtWW',
  'WW+Lt..######......K...WW',
  'WW.....***..#...o***.AtWW',
  'WWW....o....#...o..*...+W',
  'WW......At####...Nt.....W',
  'W+....#####At#+......*.WW',
  'W...+.#......#.....Nt.WWW',
  'WWNt..#At....#######..+WW',
  'WW....#...At##..Nt.##...W',
  'WW.Nt.####..#.....+*#...W',
  'W.....At*####......Nt.+WW',
  'WW...*..*+At#..........WW',
  'W+..**.~~...##***Nt...LtW',
  'W**...~~~~At.#..+...o...W',
  'W....~~~~~...####..Nt..WW',
  'WW....~~~oo###..####..+WW',
  'WWAt.o.+...#.....Nt#...WW',
  'WW.....#Lt##..Lt...#.LtWW',
  'WW+....#####H..**.+....WW',
  'WW.**...#.+##..*....*+WWW',
  'WWW..WWW.W..#....WWW..WWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
];

export function firstLevel(shuffle: Shuffle): Level {
  return levelFromLayout(firstLevelId, layout, shuffle, {
    flowerVariants: [FlowerVariant.WhiteCoral, FlowerVariant.BlueViolet],
    keys: { K: { restores: () => true } },
  });
}
