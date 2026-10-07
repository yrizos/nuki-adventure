import { OrbColor } from '../domain/level/collectibles';
import { type Level } from '../domain/level/level';
import { LevelId } from '../domain/shared/level-id';
import { levelFromLayout, type Shuffle } from './level-layout';

export const firstLevelId = LevelId.of('first');

// The two rows outside the fence give the door, which stands three tiles tall, room above its base.
const layout = [
  '.Tt.......Tt..',
  'Tt..........Tt',
  'FFFFFDDDFFFFFF',
  'F+**P###...TtF',
  'F.*...#....**F',
  'F.....H..Tt.+F',
  'FTt...##.....F',
  'F..Tt..#.Tt..F',
  'FTt....##....F',
  'F+....**#.oo.F',
  'F..Tt...##o..F',
  'F.......~#O~.F',
  'F.Tt...~~~~~+F',
  'F+.**.o~~~~~~F',
  'FFFFFFFFFFFFFF',
];

export function firstLevel(shuffle: Shuffle): Level {
  return levelFromLayout(firstLevelId, layout, shuffle, {
    orbs: { O: { color: OrbColor.Violet, restores: () => true } },
    signposts: { P: 'ΒΡΕΣ ΤΗ ΜΩΒ ΣΦΑΙΡΑ! ΘΑ ΦΕΡΕΙ ΠΙΣΩ ΤΑ ΧΡΩΜΑΤΑ ΚΑΙ ΘΑ ΑΝΟΙΞΕΙ ΤΗΝ ΠΥΛΗ.' },
  });
}
