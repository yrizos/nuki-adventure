import { type Level } from '../domain/level/level';
import { FlowerVariant } from '../domain/level/scenery';
import { LevelId } from '../domain/shared/level-id';
import { levelFromLayout, type Shuffle } from './level-layout';

export const firstLevelId = LevelId.of('first');

const layout = [
  '..Tt.***.Tt..**..',
  '.Tt.*****.Tt.***.',
  'FFFFFDDDFFFFFFFFF',
  'F+**.##...+....+F',
  'FK....#....*+...F',
  'F.Tt..##..**.Tt.F',
  'F..Tt+.##.oo..TtF',
  'F.......#o...oo+F',
  'F**..####~~.+**.F',
  'F=####..~~~~..*+F',
  'F..#.+oo~~~+....F',
  'F..###########..F',
  'F.Lt.+.Lt....#..F',
  'F+.Lt.**..+..#H+F',
  'FFFFFFFFFFFFFFFFF',
];

export function firstLevel(shuffle: Shuffle): Level {
  return levelFromLayout(firstLevelId, layout, shuffle, {
    flowerVariants: [FlowerVariant.WhiteCoral, FlowerVariant.BlueViolet],
    keys: { K: { restores: () => true } },
  });
}
