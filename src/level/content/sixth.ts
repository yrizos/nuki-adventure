import { type Level } from '../domain/level';
import { KeyMaterial } from '../domain/collectibles';
import { FlowerVariant } from '../domain/scenery';
import { type TilePosition } from '../domain/position';
import { LevelId } from '../domain/level-id';
import type { PlaceObstacles } from '../domain/obstacles';
import type { Shuffle } from '../domain/shuffle';
import { levelFromLayout } from './level-layout';

export const sixthLevelId = LevelId.of('sixth');

// The shortest walk to both keys climbs the lake shore to the silver key in the ruins, winds back down through the grove,
// passes the orchard and ends at the fenced garden beside the door, so the route tours the level. The courtyard opens only
// toward the garden, so she sees the door before the last key and leaves straight from the garden.
const layout = [
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWW..WWWWWWWWDDDWW..WWWW',
  'WW......WWWW...#.......WW',
  'WW.S.oo..WW....#.FFFFF.WW',
  'WW.##....WW..+.##G#K*F..W',
  'W...#...WWWWW...#F*.*F+.W',
  'W..o#.o.WWWWWWWW#F.*.F.WW',
  'W.+.#......WWWWW#FFFFF.WW',
  'WW..#####.....WW##.....WW',
  'WW..~.#.#.....W..#..+...W',
  'WW..~.#.#.Tt..WWW#Nt..+.W',
  'W..~~.#.####...WW#.....WW',
  'W..~~.#W...#...W##.+Nt.WW',
  'W..@~##W.Tt#Tt.W#.......W',
  'WW.~~#WW...######Nt.....W',
  'WW.~.#W..+...+.W##..Nt+.W',
  'WW.+.#WWW..WW.WW.#.....WW',
  'W....#.WWWWWWWWW.#.+...WW',
  'W.+..#####WW..W..#......W',
  'WW.......##...####..~~@.W',
  'WW..+.....#####..+...~..W',
  'W...........H......+...WW',
  'WW.+............+....+.WW',
  'WWW..WW...W...WW...WW.WWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
];

// Silver restores every tile west of the seam in its row, and gold the rest. The seam runs through the woodland between the
// ruins and the courtyard, along the woodland between the grove and the orchard, and down the track to the pond, so silver
// colors the ruins, lake, grove and meadows and gold the courtyard, garden, orchard and pond.
const seam = [11, 11, 11, 11, 11, 11, 11, 11, 15, 15, 15, 15, 15, 15, 15, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17];
const silverHalf = ({ column, row }: TilePosition): boolean => column < seam[row]!;

export function sixthLevel(shuffle: Shuffle, placeObstacles: PlaceObstacles): Level {
  return levelFromLayout(sixthLevelId, layout, shuffle, placeObstacles, {
    flowerVariants: [FlowerVariant.White, FlowerVariant.Coral],
    keys: {
      K: { restores: (position) => !silverHalf(position) },
      S: { restores: silverHalf, material: KeyMaterial.Silver },
    },
  });
}
