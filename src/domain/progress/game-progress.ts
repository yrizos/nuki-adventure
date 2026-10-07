import type { LevelId } from '../shared/level-id';
import type { Playthrough } from './playthrough';

export interface BestPlaythrough {
  readonly level: LevelId;
  readonly playthrough: Playthrough;
}

interface SavedProgress {
  readonly continueLevel: LevelId | null;
  readonly unlockedLevels: readonly LevelId[];
  readonly bestPlaythroughs: readonly BestPlaythrough[];
}

export class GameProgress {
  private constructor(
    private continueAt: LevelId | null,
    private readonly unlocked: LevelId[],
    private readonly best: Map<string, BestPlaythrough>,
  ) {}

  static fresh(): GameProgress {
    return new GameProgress(null, [], new Map());
  }

  static restore({ continueLevel, unlockedLevels, bestPlaythroughs }: SavedProgress): GameProgress {
    const progress = new GameProgress(continueLevel, [], new Map());
    for (const level of unlockedLevels) progress.unlock(level);
    for (const { level, playthrough } of bestPlaythroughs) progress.complete(level, playthrough);
    return progress;
  }

  get continueLevel(): LevelId | null {
    return this.continueAt;
  }

  get unlockedLevels(): readonly LevelId[] {
    return [...this.unlocked];
  }

  get bestPlaythroughs(): readonly BestPlaythrough[] {
    return [...this.best.values()];
  }

  // The order of levels can change between versions of the game, so the first level comes from the current one.
  isUnlocked(level: LevelId, levels: readonly LevelId[]): boolean {
    return levels[0]?.equals(level) === true || this.unlocked.some((unlocked) => unlocked.equals(level));
  }

  continueLevelAmong(levels: readonly LevelId[]): LevelId {
    const first = levels[0];
    if (!first) throw new RangeError('A game needs at least one level');
    return levels.find((level) => this.continueAt?.equals(level)) ?? first;
  }

  bestPlaythroughOf(level: LevelId): Playthrough | null {
    return this.best.get(level.value)?.playthrough ?? null;
  }

  reach(level: LevelId): void {
    this.continueAt = level;
    this.unlock(level);
  }

  complete(level: LevelId, playthrough: Playthrough): void {
    const best = this.bestPlaythroughOf(level);
    if (!best || playthrough.isBetterThan(best)) this.best.set(level.value, { level, playthrough });
  }

  private unlock(level: LevelId): void {
    if (!this.unlocked.some((unlocked) => unlocked.equals(level))) this.unlocked.push(level);
  }
}
