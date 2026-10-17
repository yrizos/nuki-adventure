import type { LevelId } from '../../level';
import type { LevelOrder } from './level-order';
import type { Playthrough } from './playthrough';

export interface LastPlaythrough {
  readonly level: LevelId;
  readonly playthrough: Playthrough;
}

interface SavedProgress {
  readonly continueLevel: LevelId | null;
  readonly unlockedLevels: readonly LevelId[];
  readonly lastPlaythroughs: readonly LastPlaythrough[];
}

export class GameProgress {
  private constructor(
    private continueAt: LevelId | null,
    private readonly unlocked: LevelId[],
    private readonly last: Map<string, LastPlaythrough>,
  ) {}

  static fresh(): GameProgress {
    return new GameProgress(null, [], new Map());
  }

  static restore({ continueLevel, unlockedLevels, lastPlaythroughs }: SavedProgress): GameProgress {
    const progress = new GameProgress(continueLevel, [], new Map());
    for (const level of unlockedLevels) progress.unlock(level);
    for (const { level, playthrough } of lastPlaythroughs) progress.recordLast(level, playthrough);
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

  lastPlaythroughOf(level: LevelId): Playthrough | null {
    return this.last.get(level.value)?.playthrough ?? null;
  }

  reach(level: LevelId): void {
    this.continueAt = level;
    this.unlock(level);
  }

  complete(level: LevelId, playthrough: Playthrough, order: LevelOrder): void {
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
