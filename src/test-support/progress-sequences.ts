import { type GameProgress } from '../domain/progress/game-progress';
import { LevelOrder } from '../domain/progress/level-order';
import { Playthrough, PlayTime } from '../domain/progress/playthrough';
import { StarCount } from '../domain/shared/star-count';
import { firstLevelId } from '../infrastructure/first-level';
import { secondLevelId } from '../infrastructure/second-level';
import { thirdLevelId } from '../infrastructure/third-level';

export const progressLevels = [firstLevelId, secondLevelId, thirdLevelId];
export const progressOrder = LevelOrder.of(progressLevels);

const playthrough = (frames: number, collectedStars: number): Playthrough =>
  Playthrough.of(PlayTime.ofFrames(frames), StarCount.of(collectedStars), StarCount.of(3));

const steps = progressLevels.flatMap((level) => [
  { label: `reach ${level.value}`, completes: false, apply: (progress: GameProgress) => progress.reach(level) },
  ...[playthrough(600, 2), playthrough(500, 2), playthrough(900, 3)].map((candidate) => ({
    label: `complete ${level.value} with ${candidate.collectedStars.value} stars in ${candidate.time.frames} frames`,
    completes: true,
    apply: (progress: GameProgress) => progress.complete(level, candidate, progressOrder),
  })),
]);

export const progressSequences = steps.flatMap((first) =>
  steps.flatMap((second) =>
    steps.map((third) => ({
      label: [first, second, third].map((step) => step.label).join(', '),
      steps: [first, second, third],
    })),
  ),
);
