import * as z from 'zod';
import { GameProgress } from '../domain/progress/game-progress';
import { Playthrough, PlayTime } from '../domain/progress/playthrough';
import type { ProgressRepository } from '../domain/progress/progress-repository';
import { LevelId } from '../domain/shared/level-id';
import { StarCount } from '../domain/shared/star-count';

export const progressKey = 'nuki-adventure-progress';
const currentVersion = 2;

const count = z.int().nonnegative();
const levelId = z.string().min(1);
const playthroughRecord = z.object({ levelId, frames: count, collectedStars: count, starCount: count });

// Version 1 also kept the best playthrough of each level, which is not the last one, so loading ignores it.
const versionOneSavedProgress = z.object({
  version: z.literal(1),
  continueLevelId: levelId.nullable(),
  unlockedLevelIds: z.array(levelId),
});

const versionTwoSavedProgress = z.object({
  version: z.literal(2),
  continueLevelId: levelId.nullable(),
  unlockedLevelIds: z.array(levelId),
  lastPlaythroughs: z.array(playthroughRecord),
});

const savedProgress = z.discriminatedUnion('version', [versionOneSavedProgress, versionTwoSavedProgress]);

type SavedProgress = z.infer<typeof savedProgress>;
type VersionTwoSavedProgress = z.infer<typeof versionTwoSavedProgress>;

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
  const mapPlaythrough = ({ levelId, frames, collectedStars, starCount }: z.infer<typeof playthroughRecord>) => ({
    level: LevelId.of(levelId),
    playthrough: Playthrough.of(PlayTime.ofFrames(frames), StarCount.of(collectedStars), StarCount.of(starCount)),
  });
  return GameProgress.restore({
    continueLevel: saved.continueLevelId === null ? null : LevelId.of(saved.continueLevelId),
    unlockedLevels: saved.unlockedLevelIds.map((id) => LevelId.of(id)),
    lastPlaythroughs: saved.version === 1 ? [] : saved.lastPlaythroughs.map(mapPlaythrough),
  });
}

function toSaved(progress: GameProgress): VersionTwoSavedProgress {
  const mapRecord = ({ level, playthrough }: { level: LevelId; playthrough: Playthrough }) => ({
    levelId: level.value,
    frames: playthrough.time.frames,
    collectedStars: playthrough.collectedStars.value,
    starCount: playthrough.starCount.value,
  });
  return {
    version: currentVersion,
    continueLevelId: progress.continueLevel?.value ?? null,
    unlockedLevelIds: progress.unlockedLevels.map((level) => level.value),
    lastPlaythroughs: progress.lastPlaythroughs.map(mapRecord),
  };
}
