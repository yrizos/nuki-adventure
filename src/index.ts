import './presentation/style.css';
import { ManageProgress } from './application/manage-progress';
import { PlayLevel } from './application/play-level';
import type { Level } from './domain/level/level';
import { fifthLevel, fifthLevelId } from './infrastructure/fifth-level';
import { firstLevel, firstLevelId } from './infrastructure/first-level';
import { InMemoryLevelRepository } from './infrastructure/in-memory-level-repository';
import type { Shuffle } from './infrastructure/level-layout';
import { LocalProgressRepository } from './infrastructure/local-progress-repository';
import { randomShuffle } from './infrastructure/random-shuffle';
import { secondLevel, secondLevelId } from './infrastructure/second-level';
import { fourthLevel, fourthLevelId } from './infrastructure/fourth-level';
import { thirdLevel, thirdLevelId } from './infrastructure/third-level';
import { startGame } from './presentation/game';

const playing = (create: (shuffle: Shuffle) => Level) => () =>
  new PlayLevel(new InMemoryLevelRepository([create(randomShuffle)]));

const levels = [
  { id: firstLevelId, start: playing(firstLevel), arrives: true },
  { id: secondLevelId, start: playing(secondLevel), arrives: true },
  { id: thirdLevelId, start: playing(thirdLevel) },
  { id: fourthLevelId, start: playing(fourthLevel) },
  { id: fifthLevelId, start: playing(fifthLevel) },
];

startGame(
  document,
  levels,
  new ManageProgress(
    new LocalProgressRepository(window.localStorage),
    levels.map(({ id }) => id),
  ),
  Math.random,
);
