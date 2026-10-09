import { OrbColor } from '../domain/level/collectibles';
import { type Level } from '../domain/level/level';
import { type TilePosition } from '../domain/level/position';
import { FlowerVariant } from '../domain/level/scenery';
import { LevelId } from '../domain/shared/level-id';
import { levelFromLayout, type Shuffle } from './level-layout';

export const thirdLevelId = LevelId.of('third');

const layout = [
  '..Tt....***....**..Tt..*.',
  '...Tt..*****..***...Tt**.',
  'FFFFFFFFFFFDDDFFFFFFFFFFF',
  'F+.......**###E.......+.F',
  'F..Nt.Nt.**###..Nt.Nt...F',
  'F...........####.....oo.F',
  'FFFFFFFFF~..#..###......F',
  'F........~.##..oo###Q...F',
  'FAt.At.At~.#...~~~~#~~~.F',
  'F........~P#..~~~~~#~~~.F',
  'F........###..~~~~~#.~~*F',
  'F........~.#...~~~~..o~*F',
  'FAt.R..At~~#.oo~~~~B.~~.F',
  'F.......*.~#.o~~~~~~~~~+F',
  'F.....***.~##.~~~~~~~~~~F',
  'FFFFFFFFFF~.#..~~~~~~~~~F',
  'F..***......#...~~~~~~~~F',
  'F...*.......#..oo......+F',
  'F..........##...o.......F',
  'F..LtLt.**.#..TtTt..Tt..F',
  'F.......**.#..........TtF',
  'F+..Lt.....##..Tt.......F',
  'F.**........#.*....Tt.TtF',
  'F.***.......H.**........F',
  'FFFFFFFFFFFFFFFFFFFFFFFFF',
];

// r is the orchard side and b the lake side; the seam follows the orange trees, the lake track and a wavering edge between the meadow and the pine forest.
const areas = [
  'rrrrrrrrrrrrrrrrrbbbbbbbb',
  'rrrrrrrrrrrrrrrrrbbbbbbbb',
  'rrrrrrrrrrrrrrrrrbbbbbbbb',
  'rrrrrrrrrrrrrrrrrrbbbbbbb',
  'rrrrrrrrrrrrrrrrbbbbbbbbb',
  'rrrrrrrrrrrrrrrrbbbbbbbbb',
  'rrrrrrrrrrrrrrrbbbbbbbbbb',
  'rrrrrrrrrrrrrrbbbbbbbbbbb',
  'rrrrrrrrrrrrrrbbbbbbbbbbb',
  'rrrrrrrrrrrrbbbbbbbbbbbbb',
  'rrrrrrrrrrrrbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrbbbbbbbbbbbb',
  'rrrrrrrrrrrrrbbbbbbbbbbbb',
  'rrrrrrrrrrrrbbbbbbbbbbbbb',
  'rrrrrrrrrrrrbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrbbbbbbbbbbbb',
  'rrrrrrrrrrrrrrbbbbbbbbbbb',
  'rrrrrrrrrrrrrrrbbbbbbbbbb',
  'rrrrrrrrrrrrrrbbbbbbbbbbb',
  'rrrrrrrrrrrrrbbbbbbbbbbbb',
  'rrrrrrrrrrrrbbbbbbbbbbbbb',
  'rrrrrrrrrrrbbbbbbbbbbbbbb',
  'rrrrrrrrrrrrbbbbbbbbbbbbb',
  'rrrrrrrrrrrrrbbbbbbbbbbbb',
  'rrrrrrrrrrrrbbbbbbbbbbbbb',
];

const inArea =
  (area: string) =>
  (position: TilePosition): boolean =>
    areas[position.row]![position.column] === area;

export function thirdLevel(shuffle: Shuffle): Level {
  return levelFromLayout(thirdLevelId, layout, shuffle, {
    flowerVariants: [FlowerVariant.CoralBlue, FlowerVariant.WhiteViolet],
    orbs: {
      R: { color: OrbColor.Red, restores: inArea('r') },
      B: { color: OrbColor.Blue, restores: inArea('b') },
    },
    signposts: {
      P: 'Η ΚΟΚΚΙΝΗ ΣΦΑΙΡΑ ΠΕΡΙΜΕΝΕΙ ΜΕΣΑ ΣΤΟΝ ΜΗΛΕΩΝΑ, ΣΤΟ ΚΕΝΟ ΜΕΤΑΞΥ ΤΩΝ ΜΗΛΙΩΝ.',
      Q: 'Η ΜΠΛΕ ΣΦΑΙΡΑ ΠΕΡΙΜΕΝΕΙ ΣΤΟ ΤΕΛΟΣ ΤΟΥ ΣΤΕΝΟΥ ΜΟΝΟΠΑΤΙΟΥ ΜΕΣΑ ΣΤΗ ΛΙΜΝΗ.',
      E: 'ΒΡΕΣ ΚΑΙ ΤΙΣ ΔΥΟ ΣΦΑΙΡΕΣ. ΜΟΛΙΣ ΦΕΡΟΥΝ ΠΙΣΩ ΤΑ ΧΡΩΜΑΤΑ, Η ΠΥΛΗ ΘΑ ΑΝΟΙΞΕΙ.',
    },
  });
}
