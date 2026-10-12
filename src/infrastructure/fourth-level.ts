import { type Level } from '../domain/level/level';
import { FlowerVariant } from '../domain/level/scenery';
import { LevelId } from '../domain/shared/level-id';
import { levelFromLayout, type Shuffle } from './level-layout';

export const fourthLevelId = LevelId.of('fourth');

// The boulder fills the only gap into the lemon glade, so it alone guards the key.
const layout = [
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWDDDWWWWWWWWWW',
  'WWWWWWWWWWW..#..WWWWWWWWW',
  'WWWW..+.WWW..#..+....WWWW',
  'WWW......WW..##.**...+WWW',
  'WW..Lt....WW..#..~~~~..WW',
  'WW......+.WW.##..~~~~~..W',
  'WWW..K#...WW.#.+.~~~~..+W',
  'WW*...#..WWW.#..~~~.....W',
  'WW**..#.WWW+.#..oo.+....W',
  'WWWWWWOWWW...#..........W',
  'WWW+..#......#...+...+.*W',
  'WWW...####...#.........*W',
  'WWWW.....#####..Nt..Nt..W',
  'WW.+.........#....+...WWW',
  'WW*.At..At..##.........WW',
  'WW*.......+.#..Nt..Nt...W',
  'WW+........##.........+.W',
  'WW....At...#............W',
  'WW...+.....#..+.Nt..Nt..W',
  'WW.........##.......oo..W',
  'WW..At..At..H.......+...W',
  'WWW.....+.....**.......WW',
  'WWWW............WWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
];

export function fourthLevel(shuffle: Shuffle): Level {
  return levelFromLayout(fourthLevelId, layout, shuffle, {
    flowerVariants: [FlowerVariant.WhiteCoral, FlowerVariant.BlueViolet],
    keys: { K: { restores: () => true } },
  });
}
