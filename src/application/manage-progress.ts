import type { GameProgress } from '../domain/progress/game-progress';
import type { Playthrough } from '../domain/progress/playthrough';
import type { ProgressRepository } from '../domain/progress/progress-repository';
import type { LevelId } from '../domain/shared/level-id';

export interface LevelProgressView {
  readonly id: LevelId;
  readonly number: number;
  readonly isUnlocked: boolean;
  readonly bestPlaythrough: Playthrough | null;
}

export interface ProgressView {
  readonly continueLevel: LevelId;
  readonly levels: readonly LevelProgressView[];
}

export class ManageProgress {
  constructor(
    private readonly progress: ProgressRepository,
    private readonly levels: readonly LevelId[],
  ) {}

  view(): ProgressView {
    const progress = this.progress.load();
    return {
      continueLevel: progress.continueLevelAmong(this.levels),
      levels: this.levels.map((id, index) => ({
        id,
        number: index + 1,
        isUnlocked: progress.isUnlocked(id, this.levels),
        bestPlaythrough: progress.bestPlaythroughOf(id),
      })),
    };
  }

  reach(level: LevelId): void {
    this.change((progress) => progress.reach(level));
  }

  complete(level: LevelId, playthrough: Playthrough): void {
    this.change((progress) => progress.complete(level, playthrough));
  }

  private change(apply: (progress: GameProgress) => void): void {
    const progress = this.progress.load();
    apply(progress);
    this.progress.save(progress);
  }
}
