import './presentation/style.css';
import { ManageProgress } from './application/manage-progress';
import { PlayLevel } from './application/play-level';
import type { Level } from './domain/level/level';
import { firstLevel, firstLevelId } from './infrastructure/first-level';
import { InMemoryLevelRepository } from './infrastructure/in-memory-level-repository';
import type { Shuffle } from './infrastructure/level-layout';
import { LocalProgressRepository } from './infrastructure/local-progress-repository';
import { randomShuffle } from './infrastructure/random-shuffle';
import { secondLevel, secondLevelId } from './infrastructure/second-level';
import { startGame } from './presentation/game';

const playing = (create: (shuffle: Shuffle) => Level) => () =>
  new PlayLevel(new InMemoryLevelRepository([create(randomShuffle)]));

const levels = [
  { id: firstLevelId, start: playing(firstLevel) },
  { id: secondLevelId, start: playing(secondLevel) },
];

startGame(
  document,
  levels,
  new ManageProgress(
    new LocalProgressRepository(window.localStorage),
    levels.map(({ id }) => id),
  ),
);
