import { type GameProgress, type LevelInProgress } from '../domain/game-progress';
import { LevelOrder } from '../domain/level-order';
import { Playthrough, PlayTime } from '../domain/playthrough';
import { Direction, LevelId, TilePosition, WorldPosition } from '../../level';

export const progressLevels = ['first', 'second', 'third'].map(LevelId.of);
export const progressOrder = LevelOrder.of(progressLevels);

const playthrough = (frames: number): Playthrough => Playthrough.of(PlayTime.ofFrames(frames));

export const leftInProgress = (level: LevelId, frames = 1200): LevelInProgress => ({
  level,
  time: PlayTime.ofFrames(frames),
  snapshot: {
    hero: { feet: WorldPosition.at(48.5, 92.25), facing: Direction.Left },
    orbs: [{ position: TilePosition.at(2, 4), radius: 5 }],
    collectedOrbs: [{ position: TilePosition.at(0, 1), radius: 4 }],
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
  ...[playthrough(600), playthrough(500), playthrough(900)].map((candidate) => ({
    label: `complete ${level.value} in ${candidate.time.frames} frames`,
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
