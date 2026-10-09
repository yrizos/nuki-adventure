import type { GameProgress } from '../domain/progress/game-progress';
import { LevelOrder } from '../domain/progress/level-order';
import type { Playthrough } from '../domain/progress/playthrough';
import type { ProgressRepository } from '../domain/progress/progress-repository';
import type { LevelId } from '../domain/shared/level-id';

export interface LevelProgressView {
  readonly id: LevelId;
  readonly number: number;
  readonly isUnlocked: boolean;
  readonly lastPlaythrough: Playthrough | null;
}

export interface ProgressView {
  readonly continueLevel: LevelId;
  readonly levels: readonly LevelProgressView[];
}

export class ManageProgress {
  private readonly order: LevelOrder;

  constructor(
    private readonly progress: ProgressRepository,
    levels: readonly LevelId[],
  ) {
    this.order = LevelOrder.of(levels);
  }

  view(): ProgressView {
    const progress = this.progress.load();
    return {
      continueLevel: progress.continueLevelAmong(this.order),
      levels: this.order.levels.map((id, index) => ({
        id,
        number: index + 1,
        isUnlocked: progress.isUnlocked(id, this.order),
        lastPlaythrough: progress.lastPlaythroughOf(id),
      })),
    };
  }

  reach(level: LevelId): void {
    this.change((progress) => progress.reach(level));
  }

  complete(level: LevelId, playthrough: Playthrough): void {
    this.change((progress) => progress.complete(level, playthrough, this.order));
  }

  private change(apply: (progress: GameProgress) => void): void {
    const progress = this.progress.load();
    apply(progress);
    this.progress.save(progress);
  }
}
