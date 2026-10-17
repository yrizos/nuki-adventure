import './user-interface/shell/style.css';
import { authoredLevels, PlayLevel } from './level';
import { check2dObstacles } from './level/infrastructure/check2d-obstacles';
import { InMemoryLevelRepository } from './level/infrastructure/in-memory-level-repository';
import { randomShuffle } from './level/infrastructure/random-shuffle';
import { ManageProgress } from './progress';
import { LocalProgressRepository } from './progress/infrastructure/local-progress-repository';
import { startGame } from './user-interface/shell/game';

const levels = authoredLevels.map(({ id, create, arrives }) => ({
  id,
  start: () => new PlayLevel(new InMemoryLevelRepository([create(randomShuffle, check2dObstacles)])),
  arrives,
}));

startGame(
  document,
  levels,
  new ManageProgress(
    new LocalProgressRepository(window.localStorage),
    levels.map(({ id }) => id),
  ),
  Math.random,
);
