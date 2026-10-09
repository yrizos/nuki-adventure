import { OrbColor } from '../domain/level/collectibles';
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
  'F..**....###..**.O.+F',
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
    orbs: { O: { color: OrbColor.Teal, restores: () => true } },
    signposts: {
      1: 'Η ΤΥΡΚΟΥΑΖ ΣΦΑΙΡΑ ΣΕ ΠΕΡΙΜΕΝΕΙ ΣΤΑ ΛΟΥΛΟΥΔΙΑ ΔΙΠΛΑ ΣΤΗ ΛΙΜΝΗ.',
      E: 'ΒΡΕΣ ΤΗ ΣΦΑΙΡΑ. ΘΑ ΦΕΡΕΙ ΠΙΣΩ ΤΑ ΧΡΩΜΑΤΑ ΚΑΙ ΘΑ ΑΝΟΙΞΕΙ ΤΗΝ ΠΥΛΗ.',
    },
  });
}
