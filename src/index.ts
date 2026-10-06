import './presentation/style.css';
import { PlayLevel } from './application/play-level';
import type { Level } from './domain/level/level';
import { firstLevel, firstLevelId } from './infrastructure/first-level';
import { InMemoryLevelRepository } from './infrastructure/in-memory-level-repository';
import type { Shuffle } from './infrastructure/level-layout';
import { randomShuffle } from './infrastructure/random-shuffle';
import { secondLevel, secondLevelId } from './infrastructure/second-level';
import { startGame } from './presentation/game';

const playing = (create: (shuffle: Shuffle) => Level) => () =>
  new PlayLevel(new InMemoryLevelRepository([create(randomShuffle)]));

startGame(document, [
  { id: firstLevelId, start: playing(firstLevel) },
  { id: secondLevelId, start: playing(secondLevel) },
]);
