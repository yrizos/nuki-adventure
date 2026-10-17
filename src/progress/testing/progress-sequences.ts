import { type GameProgress } from '../domain/game-progress';
import { LevelOrder } from '../domain/level-order';
import { Playthrough, PlayTime } from '../domain/playthrough';
import { LevelId, StarCount } from '../../level';

export const progressLevels = ['first', 'second', 'third'].map(LevelId.of);
export const progressOrder = LevelOrder.of(progressLevels);

const playthrough = (frames: number, collectedStars: number): Playthrough =>
  Playthrough.of(PlayTime.ofFrames(frames), StarCount.of(collectedStars), StarCount.of(3));

const steps = progressLevels.flatMap((level) => [
  { label: `reach ${level.value}`, completion: null, apply: (progress: GameProgress) => progress.reach(level) },
  ...[playthrough(600, 2), playthrough(500, 2), playthrough(900, 3)].map((candidate) => ({
    label: `complete ${level.value} with ${candidate.collectedStars.value} stars in ${candidate.time.frames} frames`,
    completion: { level, playthrough: candidate },
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
