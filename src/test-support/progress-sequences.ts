import { type GameProgress } from '../domain/progress/game-progress';
import { Playthrough, PlayTime } from '../domain/progress/playthrough';
import { StarCount } from '../domain/shared/star-count';
import { firstLevelId } from '../infrastructure/first-level';
import { secondLevelId } from '../infrastructure/second-level';

export const progressLevels = [firstLevelId, secondLevelId];

const playthrough = (frames: number, collectedStars: number): Playthrough =>
  Playthrough.of(PlayTime.ofFrames(frames), StarCount.of(collectedStars), StarCount.of(3));

const steps = progressLevels.flatMap((level) => [
  { label: `reach ${level.value}`, apply: (progress: GameProgress) => progress.reach(level) },
  ...[playthrough(600, 2), playthrough(500, 2), playthrough(900, 3)].map((candidate) => ({
    label: `complete ${level.value} with ${candidate.collectedStars.value} stars in ${candidate.time.frames} frames`,
    apply: (progress: GameProgress) => progress.complete(level, candidate),
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
