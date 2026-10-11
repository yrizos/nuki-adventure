import { KeyMaterial } from '../domain/level/collectibles';
import { type Level } from '../domain/level/level';
import { type TilePosition } from '../domain/level/position';
import { FlowerVariant } from '../domain/level/scenery';
import { LevelId } from '../domain/shared/level-id';
import { levelFromLayout, type Shuffle } from './level-layout';

export const thirdLevelId = LevelId.of('third');

const layout = [
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWDDDWWWWWWWWWWWWWW',
  'WWWWWWWWWW....#..+WWWWWWWWWWWW',
  'WWWWWWW**.....#......WWWWWWWWW',
  'WWWWW..+.Nt..##.....+..WWWWWWW',
  'WWW...*......#.....o....WWWWWW',
  'WWW.FFFFFFFF.#...~~~~.....WWWW',
  'WW..F..+...F.##.~~~~~~~..+WWWW',
  'WW.+FAt..AtF..#~~~~~~~~~...WWW',
  'WW..F..K#..F.##~~~~~...~~.+.WW',
  'WW..F...#AtF.#..~~~+.#S.~~...W',
  'WW..F+..#.+F.##o~~~~.#.~~~...W',
  'WWW.FFFFGFFF..#..~~~~#~~~....W',
  'WW.+.**.###...#...~~~#~~..+.WW',
  'WW........#######....#...o..WW',
  'WWWLt.........#.######.......W',
  'WW............#.........Tt...W',
  'WWW...o...######.**.........WW',
  'WW..+.....#+...#...+........WW',
  'WW.....####....##......**.+..W',
  'WWW.**.#........####.........W',
  'WW....+#.......##..####..Tt.WW',
  'WWW.......At...#......#.....WW',
  'WWW...........##.o....#+...WWW',
  'WWWWLt........#...Nt........WW',
  'WWWW......+...#...........WWWW',
  'WWWWWW........H........o.WWWWW',
  'WWWWWWWW........*.+....WWWWWWW',
  'WWWWWWWWWWW.........WWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
];

// r is the orchard side and b the pond side. The seam bends along the pond's western shore, then sways west and back east around the southern track's bends.
const areas = [
  'rrrrrrrrrrrrrbbbbbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrbbbbbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrbbbbbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrrbbbbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrrbbbbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrrrbbbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrrrrbbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrrrrbbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrrrbbbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrrrbbbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrrrrbbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrrrrbbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrrrrrbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrrrrrrbbbbbbbbbbbb',
  'rrrrrrrrrrrrrrrrrbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrrrrrbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrrrrbbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrrrrbbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrrrbbbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrrrbbbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrrbbbbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrrrbbbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrrrbbbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrrbbbbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrbbbbbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrbbbbbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrrbbbbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrrrbbbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrrrrbbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrrrrbbbbbbbbbbbbbb',
];

const inArea =
  (area: string) =>
  (position: TilePosition): boolean =>
    areas[position.row]![position.column] === area;

export function thirdLevel(shuffle: Shuffle): Level {
  return levelFromLayout(thirdLevelId, layout, shuffle, {
    flowerVariants: [FlowerVariant.CoralBlue, FlowerVariant.WhiteViolet],
    keys: {
      K: { restores: inArea('r') },
      S: { restores: inArea('b'), material: KeyMaterial.Silver },
    },
  });
}
