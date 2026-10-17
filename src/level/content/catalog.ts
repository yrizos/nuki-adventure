import type { Level } from '../domain/level';
import type { LevelId } from '../domain/level-id';
import type { PlaceObstacles } from '../domain/obstacles';
import type { Shuffle } from '../domain/shuffle';
import { fifthLevel, fifthLevelId } from './fifth';
import { firstLevel, firstLevelId } from './first';
import { fourthLevel, fourthLevelId } from './fourth';
import { secondLevel, secondLevelId } from './second';
import { sixthLevel, sixthLevelId } from './sixth';
import { thirdLevel, thirdLevelId } from './third';

export interface AuthoredLevel {
  readonly id: LevelId;
  readonly create: (shuffle: Shuffle, placeObstacles: PlaceObstacles) => Level;
  readonly arrives: boolean;
}

// The order here is the level order, so the first entry is the level a new game starts with.
export const authoredLevels: readonly AuthoredLevel[] = [
  { id: firstLevelId, create: firstLevel, arrives: true },
  { id: secondLevelId, create: secondLevel, arrives: true },
  { id: thirdLevelId, create: thirdLevel, arrives: false },
  { id: fourthLevelId, create: fourthLevel, arrives: false },
  { id: fifthLevelId, create: fifthLevel, arrives: false },
  { id: sixthLevelId, create: sixthLevel, arrives: false },
];
