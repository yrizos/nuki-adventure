import { type Level } from '../domain/level/level';
import { FlowerVariant } from '../domain/level/scenery';
import { LevelId } from '../domain/shared/level-id';
import { levelFromLayout, type Shuffle } from './level-layout';

export const fifthLevelId = LevelId.of('fifth');

// Only a boulder resting on the plate holds the lemon garden gate open, so each boulder spot sits within two tiles of it.
// The woodland reaching up from under the garden leaves the glade open only beside the door, so she sees the exit before the key.
const layout = [
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWDDDWWWWWWWWWWWWWWW',
  'WWWW....#...WWWWW....WWWW',
  'WWW.....#.####....~~..WWW',
  'WW..+At.###..#...~~~~..WW',
  'WW***...#..WW##..~~+~+.WW',
  'WW.....##.WWW.##=~+.~.WWW',
  'WW###..#..WWW.#O..***..WW',
  'WW..=###.WWW..##FFFFFF.WW',
  'WWW..+#..WWWW.OPF....F.WW',
  'WWW...#...WWW..#F..LtF.WW',
  'WW..Tt#...WW..*#G#K..F..W',
  'WW...##..WWW.**.F....F..W',
  'WW..+#....WWW...F....F+.W',
  'WWWW.#.....WWW+.FFFFFF.WW',
  'WWWW.###..WWWW..**.+...WW',
  'WWWW.+.#...WWW.+*......WW',
  'WW....####..WWW..WWWWWWWW',
  'WW....#..#....WWWWWWWWWWW',
  'WW*+###..###.....WWW...WW',
  'WW*.#..Nt..###.......+.WW',
  'WW..#.....+o.#H..**.+.WWW',
  'WWWW=...........+.+..WWWW',
  'WWWW...WWW..........WWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
];

export function fifthLevel(shuffle: Shuffle): Level {
  return levelFromLayout(fifthLevelId, layout, shuffle, {
    flowerVariants: [FlowerVariant.CoralViolet, FlowerVariant.WhiteBlue],
    keys: { K: { restores: () => true } },
  });
}
