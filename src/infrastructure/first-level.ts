import { type Level, LevelId, OrbColor, StarCount } from '../domain/level/level';
import { levelFromLayout } from './level-layout';

export const firstLevelId = LevelId.of('first');

// The two rows outside the fence give the door, which stands three tiles tall, room above its base.
const layout = [
  '..Tt.........Tt...',
  'Tt..........*...Tt',
  'FFFFFFFDDDFFFFFFFF',
  'F.....P###....Tt.F',
  'F.Tt....#.....*..F',
  'F.......#..o.....F',
  'F..*....##.......F',
  'F.....o..#...~~..F',
  'F.Tt.....#..~~~~.F',
  'F........#...~~O.F',
  'F...*...##....*..F',
  'F.......#..Tt....F',
  'F..o....#.....o..F',
  'F.Tt...##........F',
  'F......#...*.Tt..F',
  'F....###.........F',
  'F..*.#.....o..*..F',
  'F....H.....Tt....F',
  'F.Tt.......*.....F',
  'FFFFFFFFFFFFFFFFFF',
];

export function firstLevel(): Level {
  return levelFromLayout(firstLevelId, layout, {
    orbs: { O: { color: OrbColor.Violet, restores: () => true } },
    signposts: { P: 'ΒΡΕΣ ΤΗ ΜΩΒ ΣΦΑΙΡΑ! ΘΑ ΦΕΡΕΙ ΠΙΣΩ ΤΑ ΧΡΩΜΑΤΑ ΚΑΙ ΘΑ ΑΝΟΙΞΕΙ ΤΗΝ ΠΥΛΗ.' },
    starCount: StarCount.of(5),
  });
}
