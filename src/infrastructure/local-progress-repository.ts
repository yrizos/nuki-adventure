import * as z from 'zod';
import { GameProgress } from '../domain/progress/game-progress';
import { Playthrough, PlayTime } from '../domain/progress/playthrough';
import type { ProgressRepository } from '../domain/progress/progress-repository';
import { LevelId } from '../domain/shared/level-id';
import { StarCount } from '../domain/shared/star-count';

export const progressKey = 'nuki-adventure-progress';
const currentVersion = 1;

const count = z.int().nonnegative();
const levelId = z.string().min(1);

const savedProgress = z.object({
  version: z.literal(currentVersion),
  continueLevelId: levelId.nullable(),
  unlockedLevelIds: z.array(levelId),
  bestPlaythroughs: z.array(z.object({ levelId, frames: count, collectedStars: count, starCount: count })),
});

type SavedProgress = z.infer<typeof savedProgress>;

const storedVersion = z.object({ version: z.int() });

export class LocalProgressRepository implements ProgressRepository {
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'>) {}

  // Saved progress comes from outside the game, so anything wrong with it starts the player afresh instead of
  // stopping the game.
  load(): GameProgress {
    try {
      const stored = this.read();
      return stored === null ? GameProgress.fresh() : fromSaved(savedProgress.parse(stored));
    } catch {
      return GameProgress.fresh();
    }
  }

  save(progress: GameProgress): void {
    try {
      // A newer version of the game wrote this, so overwriting it would lose progress the player still has there.
      if (this.newerVersionSaved()) return;
      this.storage.setItem(progressKey, JSON.stringify(toSaved(progress)));
    } catch {
      // Full or blocked storage only costs the player their saved progress, never the level they are playing.
    }
  }

  private read(): unknown {
    const json = this.storage.getItem(progressKey);
    return json === null ? null : JSON.parse(json);
  }

  private newerVersionSaved(): boolean {
    let stored: unknown;
    try {
      stored = this.read();
    } catch {
      return false;
    }
    const version = storedVersion.safeParse(stored);
    return version.success && version.data.version > currentVersion;
  }
}

function fromSaved(saved: SavedProgress): GameProgress {
  return GameProgress.restore({
    continueLevel: saved.continueLevelId === null ? null : LevelId.of(saved.continueLevelId),
    unlockedLevels: saved.unlockedLevelIds.map((id) => LevelId.of(id)),
    bestPlaythroughs: saved.bestPlaythroughs.map(({ levelId, frames, collectedStars, starCount }) => ({
      level: LevelId.of(levelId),
      playthrough: Playthrough.of(PlayTime.ofFrames(frames), StarCount.of(collectedStars), StarCount.of(starCount)),
    })),
  });
}

function toSaved(progress: GameProgress): SavedProgress {
  return {
    version: currentVersion,
    continueLevelId: progress.continueLevel?.value ?? null,
    unlockedLevelIds: progress.unlockedLevels.map((level) => level.value),
    bestPlaythroughs: progress.bestPlaythroughs.map(({ level, playthrough }) => ({
      levelId: level.value,
      frames: playthrough.time.frames,
      collectedStars: playthrough.collectedStars.value,
      starCount: playthrough.starCount.value,
    })),
  };
}
