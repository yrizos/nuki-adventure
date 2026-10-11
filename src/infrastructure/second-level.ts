import { type Level } from '../domain/level/level';
import { FlowerVariant } from '../domain/level/scenery';
import { LevelId } from '../domain/shared/level-id';
import { levelFromLayout, type Shuffle } from './level-layout';

export const secondLevelId = LevelId.of('second');

const layout = [
  '..Nt...***....Nt.....',
  '.Nt...*****....Nt....',
  'FFFFFFFFFDDDFFFFFFFFF',
  'F.+**.+.E##....***..F',
  'F..**....###..**.K.+F',
  'F.Nt.Nt.#########**.F',
  'F.......#~~~~~~~~~~~F',
  'F.Nt+Nt###..+.~~~~~~F',
  'F.**..##..~~~.##~~~~F',
  'F.....#.+~~~~~.###~~F',
  'F..+..#.~~~~~~.#.oo+F',
  'F.oo..#..~~~~..#**o.F',
  'F.o...##..~~+.##.*..F',
  'F+.....########....+F',
  'F..**..#..**..#.Lt..F',
  'F..At+At...+..###.**F',
  'F..**..#######...Lt.F',
  'F.+At.AtH1**......+.F',
  'FFFFFFFFFFFFFFFFFFFFF',
];

export function secondLevel(shuffle: Shuffle): Level {
  return levelFromLayout(secondLevelId, layout, shuffle, {
    flowerVariants: [FlowerVariant.WhiteCoral, FlowerVariant.BlueViolet],
    keys: { K: { restores: () => true } },
    signposts: {
      1: 'ΤΟ ΚΛΕΙΔΙ ΣΕ ΠΕΡΙΜΕΝΕΙ ΣΤΑ ΛΟΥΛΟΥΔΙΑ ΔΙΠΛΑ ΣΤΗ ΛΙΜΝΗ.',
      E: 'ΒΡΕΣ ΤΟ ΚΛΕΙΔΙ. ΘΑ ΦΕΡΕΙ ΠΙΣΩ ΤΑ ΧΡΩΜΑΤΑ ΚΑΙ ΘΑ ΑΝΟΙΞΕΙ ΤΗΝ ΠΥΛΗ.',
    },
  });
}
