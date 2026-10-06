import { type Level, LevelId, OrbColor, StarCount } from '../domain/level/level';
import { levelFromLayout } from './level-layout';

export const secondLevelId = LevelId.of('second');

// The forest winds back and forth between rows of trees, and the lake keeps its orb on a strip reached only by the east shore.
const layout = [
  '..Tt..................Tt..',
  'Tt......................Tt',
  'FFFFFFFFFFFDDDFFFFFFFFFFFF',
  'F#######RF1###.~~~~~~~~~~F',
  'FTtTtTt##F.###.~~~~~~~~~~F',
  'F########F.###.~~~~~~~~~~F',
  'F########F.###.~~~~~~~~~~F',
  'F##TtTtTtF.###.~~~B######F',
  'F########F.###.~~~~~~~~~#F',
  'F########F.###.~~~~~~~~~#F',
  'FTtTtTt##F.###.~~~~~~~~~#F',
  'F########F.###.~~~~~~~~~#F',
  'F########F.###...~~~~~~~#F',
  'F##TtTtTtF.###....3.....#F',
  'F##FFFFFFF.##############F',
  'F##.......###.~~~~~~~~~..F',
  'F##..Tt...###.~~~~~~~~~..F',
  'F##.......###.~~~~~~~~~..F',
  'F########################F',
  'F..2.##......Tt......##..F',
  'F~~~.##.....*........##..F',
  'F~~~.##.FFFFFFFF.....##..F',
  'F~~~.##.F######F..~~~##..F',
  'F~~~.##.F##o###F..~~~##TtF',
  'F~~~.##.F######F..~~~##..F',
  'F....##################..F',
  'F..........###...........F',
  'F~~~~......###.......Tt..F',
  'F~~~~~.....###..~~~~~....F',
  'F~~~~~.....###..~~~~~.Tt.F',
  'F~~~~......#H#...~~~.....F',
  'F..Tt......###...........F',
  'FFFFFFFFFFFFFFFFFFFFFFFFFF',
];

export function secondLevel(): Level {
  return levelFromLayout(secondLevelId, layout, {
    orbs: {
      R: { color: OrbColor.Red, restores: (position) => position.column < 13 },
      B: { color: OrbColor.Blue, restores: (position) => position.column >= 13 },
    },
    signposts: {
      1: 'ΔΥΟ ΣΦΑΙΡΕΣ ΚΡΥΒΟΝΤΑΙ ΕΔΩ. Η ΠΥΛΗ ΑΝΟΙΓΕΙ ΜΟΝΟ ΜΕ ΤΙΣ ΔΥΟ.',
      2: 'ΟΠΟΥ ΤΑ ΔΕΝΤΡΑ ΣΤΕΚΟΝΤΑΙ ΠΥΚΝΑ, ΚΑΤΙ ΚΟΚΚΙΝΟ ΠΕΡΙΜΕΝΕΙ ΣΤΗΝ ΑΚΡΗ.',
      3: 'ΤΟ ΝΕΡΟ ΔΕΝ ΣΕ ΑΦΗΝΕΙ ΝΑ ΠΕΡΑΣΕΙΣ. ΔΟΚΙΜΑΣΕ ΤΗΝ ΑΛΛΗ ΟΧΘΗ.',
    },
    starCount: StarCount.of(8),
  });
}
