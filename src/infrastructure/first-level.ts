import { OrbColor } from '../domain/level/collectibles';
import { type Level } from '../domain/level/level';
import { FlowerVariant } from '../domain/level/scenery';
import { LevelId } from '../domain/shared/level-id';
import { levelFromLayout, type Shuffle } from './level-layout';

export const firstLevelId = LevelId.of('first');

const layout = [
  '..Tt.***.Tt..**..',
  '.Tt.*****.Tt.***.',
  'FFFFFDDDFFFFFFFFF',
  'F+**.###..+.....F',
  'FO....#....*....F',
  'F.Tt..##..**.Tt.F',
  'F..Tt..##.oo..TtF',
  'F.......#o...oo.F',
  'F**..####~~..**.F',
  'F=####..~~~~..*+F',
  'F..#..oo~~~.....F',
  'F..###########..F',
  'F.Lt...Lt....#.PF',
  'F..Lt.**.....#H+F',
  'FFFFFFFFFFFFFFFFF',
];

export function firstLevel(shuffle: Shuffle): Level {
  return levelFromLayout(firstLevelId, layout, shuffle, {
    flowerVariants: [FlowerVariant.WhiteCoral, FlowerVariant.BlueViolet],
    orbs: { O: { color: OrbColor.Violet, restores: () => true } },
    signposts: { P: 'ΒΡΕΣ ΤΗ ΜΩΒ ΣΦΑΙΡΑ! ΘΑ ΦΕΡΕΙ ΠΙΣΩ ΤΑ ΧΡΩΜΑΤΑ ΚΑΙ ΘΑ ΑΝΟΙΞΕΙ ΤΗΝ ΠΥΛΗ.' },
  });
}
