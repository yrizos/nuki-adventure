import { type GameProgress, type LevelInProgress } from '../domain/game-progress';
import { LevelOrder } from '../domain/level-order';
import { Playthrough, PlayTime } from '../domain/playthrough';
import { Direction, LevelId, StarCount, TilePosition, WorldPosition } from '../../level';

export const progressLevels = ['first', 'second', 'third'].map(LevelId.of);
export const progressOrder = LevelOrder.of(progressLevels);

const playthrough = (frames: number, collectedStars: number): Playthrough =>
  Playthrough.of(PlayTime.ofFrames(frames), StarCount.of(collectedStars), StarCount.of(3));

export const leftInProgress = (level: LevelId, frames = 1200): LevelInProgress => ({
  level,
  time: PlayTime.ofFrames(frames),
  snapshot: {
    hero: { feet: WorldPosition.at(48.5, 92.25), facing: Direction.Left },
    stars: [TilePosition.at(2, 4)],
    collectedStars: [TilePosition.at(0, 1)],
    collectedKeys: [TilePosition.at(1, 3)],
    gates: ['open', 'closed'],
    boulders: [TilePosition.at(3, 3)],
  },
});

const steps = progressLevels.flatMap((level) => [
  { label: `reach ${level.value}`, completion: null, apply: (progress: GameProgress) => progress.reach(level) },
  {
    label: `leave ${level.value} in progress`,
    completion: null,
    apply: (progress: GameProgress) => progress.suspend(leftInProgress(level)),
  },
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
