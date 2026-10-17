import { GameProgress } from '../domain/game-progress';
import { LevelOrder } from '../domain/level-order';
import { Playthrough, PlayTime } from '../domain/playthrough';
import type { ProgressRepository } from '../domain/progress-repository';
import { type LevelId, StarCount } from '../../level';

export interface LevelProgressView {
  readonly id: LevelId;
  readonly number: number;
  readonly isUnlocked: boolean;
  readonly lastPlaythrough: Playthrough | null;
}

export interface CompletedRun {
  readonly playFrames: number;
  readonly starsCollected: number;
  readonly starCount: number;
}

export interface ProgressView {
  readonly continueLevel: LevelId | null;
  readonly hasProgress: boolean;
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
      hasProgress: progress.hasProgress,
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

  complete(level: LevelId, run: CompletedRun): void {
    const playthrough = Playthrough.of(
      PlayTime.ofFrames(run.playFrames),
      StarCount.of(run.starsCollected),
      StarCount.of(run.starCount),
    );
    this.change((progress) => progress.complete(level, playthrough, this.order));
  }

  levelAfter(level: LevelId): LevelId | null {
    return this.order.after(level);
  }

  reset(): void {
    this.progress.save(GameProgress.fresh());
  }

  private change(apply: (progress: GameProgress) => void): void {
    const progress = this.progress.load();
    apply(progress);
    this.progress.save(progress);
  }
}
