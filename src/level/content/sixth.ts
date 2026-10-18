import { type Level } from '../domain/level';
import { FlowerVariant } from '../domain/scenery';
import { LevelId } from '../domain/level-id';
import type { PlaceObstacles } from '../domain/obstacles';
import type { Random } from '../domain/random';
import type { Shuffle } from '../domain/shuffle';
import { levelFromLayout } from './level-layout';

export const sixthLevelId = LevelId.of('sixth');

// The shortest walk to both permanent orbs climbs the lake shore to the orb in the ruins, winds back down through the grove,
// passes the orchard and ends at the fenced garden beside the door, so the route tours the level. The courtyard opens only
// toward the garden, so she sees the door before its orb and leaves straight from the garden.
const layout = [
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWW..WWWWWWWWDDDWW..WWWW',
  'WW......WWWW...#.......WW',
  'WW.Q.oo..WW....#.FFFFF.WW',
  'WW.##....WW....##G#Q*F..W',
  'W...#...WWWWW...#F*.*F..W',
  'W..o#.o.WWWWWWWW#F.*.F.WW',
  'W...#......WWWWW#FFFFF.WW',
  'WW..#####.....WW##.....WW',
  'WW..~.#.#.....W..#......W',
  'WW..~.#.#.Tt..WWW#Nt....W',
  'W..~~.#.####...WW#.....WW',
  'W..~~.#W...#...W##..Nt.WW',
  'W...~##W.Tt#Tt.W#.......W',
  'WW.~~#WW...######Nt.....W',
  'WW.~.#W........W##..Nt..W',
  'WW...#WWW..WW.WW.#.....WW',
  'W....#.WWWWWWWWW.#.....WW',
  'W....#####WW..W..#......W',
  'WW.......##...####..~~..W',
  'WW........#####......~..W',
  'W.........Q.H..........WW',
  'WW.....................WW',
  'WWW..WW...W...WW...WW.WWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWW',
];

export function sixthLevel(shuffle: Shuffle, placeObstacles: PlaceObstacles, random: Random): Level {
  return levelFromLayout(sixthLevelId, layout, shuffle, placeObstacles, random, {
    flowerVariants: [FlowerVariant.White, FlowerVariant.Coral],
  });
}
