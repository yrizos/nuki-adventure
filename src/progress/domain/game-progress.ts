import type { LevelId, LevelSnapshot } from '../../level';
import type { LevelOrder } from './level-order';
import type { Playthrough, PlayTime } from './playthrough';

export interface LastPlaythrough {
  readonly level: LevelId;
  readonly playthrough: Playthrough;
}

export interface LevelInProgress {
  readonly level: LevelId;
  readonly snapshot: LevelSnapshot;
  readonly time: PlayTime;
}

interface SavedProgress {
  readonly continueLevel: LevelId | null;
  readonly unlockedLevels: readonly LevelId[];
  readonly lastPlaythroughs: readonly LastPlaythrough[];
  readonly levelInProgress?: LevelInProgress | null;
}

export class GameProgress {
  private constructor(
    private continueAt: LevelId | null,
    private readonly unlocked: LevelId[],
    private readonly last: Map<string, LastPlaythrough>,
    private inProgress: LevelInProgress | null,
  ) {}

  static fresh(): GameProgress {
    return new GameProgress(null, [], new Map(), null);
  }

  static restore({ continueLevel, unlockedLevels, lastPlaythroughs, levelInProgress }: SavedProgress): GameProgress {
    const progress = new GameProgress(continueLevel, [], new Map(), null);
    for (const level of unlockedLevels) progress.unlock(level);
    for (const { level, playthrough } of lastPlaythroughs) progress.recordLast(level, playthrough);
    if (levelInProgress) progress.suspend(levelInProgress);
    return progress;
  }

  get continueLevel(): LevelId | null {
    return this.continueAt;
  }

  get unlockedLevels(): readonly LevelId[] {
    return [...this.unlocked];
  }

  get lastPlaythroughs(): readonly LastPlaythrough[] {
    return [...this.last.values()];
  }

  // The order of levels can change between versions of the game, so the first level comes from the current one.
  isUnlocked(level: LevelId, order: LevelOrder): boolean {
    return order.first.equals(level) || this.unlocked.some((unlocked) => unlocked.equals(level));
  }

  get hasProgress(): boolean {
    return this.unlocked.length > 0 || this.last.size > 0;
  }

  // A saved level that is no longer in the game falls back to the first level, so the player is never left without a way on.
  // A completed last level means the game is finished, so nothing is left to continue.
  continueLevelAmong(order: LevelOrder): LevelId | null {
    if (!this.continueAt) return null;
    if (!order.includes(this.continueAt)) return order.first;
    const finished = order.after(this.continueAt) === null && this.lastPlaythroughOf(this.continueAt) !== null;
    return finished ? null : this.continueAt;
  }

  get levelInProgress(): LevelInProgress | null {
    return this.inProgress;
  }

  // Only the level she would continue can be resumed, so a level removed from the game or a finished game resumes nothing.
  levelInProgressAmong(order: LevelOrder): LevelInProgress | null {
    const level = this.continueLevelAmong(order);
    return level && this.inProgress?.level.equals(level) ? this.inProgress : null;
  }

  lastPlaythroughOf(level: LevelId): Playthrough | null {
    return this.last.get(level.value)?.playthrough ?? null;
  }

  // Starting a level afresh drops any level in progress, so only continuing can ever resume one.
  reach(level: LevelId): void {
    this.continueAt = level;
    this.inProgress = null;
    this.unlock(level);
  }

  // Storage that could not be written, or another tab, can leave a different level to continue, and the level she plays must go on regardless.
  suspend(levelInProgress: LevelInProgress): void {
    if (this.continueAt?.equals(levelInProgress.level)) this.inProgress = levelInProgress;
  }

  complete(level: LevelId, playthrough: Playthrough, order: LevelOrder): void {
    if (this.inProgress?.level.equals(level)) this.inProgress = null;
    this.recordLast(level, playthrough);
    const next = order.after(level);
    if (next) this.unlock(next);
  }

  private recordLast(level: LevelId, playthrough: Playthrough): void {
    this.last.set(level.value, { level, playthrough });
  }

  private unlock(level: LevelId): void {
    if (!this.unlocked.some((unlocked) => unlocked.equals(level))) this.unlocked.push(level);
  }
}
