import * as z from 'zod';
import { GameProgress, type LevelInProgress } from '../domain/game-progress';
import { Playthrough, PlayTime } from '../domain/playthrough';
import type { ProgressRepository } from '../domain/progress-repository';
import { Direction, LevelId, StarCount, TilePosition, WorldPosition } from '../../level';

export const progressKey = 'nuki-adventure-progress';
const currentVersion = 3;

const count = z.int().nonnegative();
const levelId = z.string().min(1);
const playthroughRecord = z.object({ levelId, frames: count, collectedStars: count, starCount: count });
const tileRecord = z.object({ column: z.int(), row: z.int() });
const facings = { up: Direction.Up, down: Direction.Down, left: Direction.Left, right: Direction.Right };
const levelInProgressRecord = z.object({
  levelId,
  frames: count,
  hero: z.object({ x: z.number(), y: z.number(), facing: z.enum(['up', 'down', 'left', 'right']) }),
  stars: z.array(tileRecord),
  collectedStars: z.array(tileRecord),
  collectedKeys: z.array(tileRecord),
  gates: z.array(z.enum(['open', 'closed'])),
  boulders: z.array(tileRecord),
});

// Earlier versions are not read, so a save from before this version starts the player afresh.
const savedProgress = z.object({
  version: z.literal(currentVersion),
  continueLevelId: levelId.nullable(),
  unlockedLevelIds: z.array(levelId),
  lastPlaythroughs: z.array(playthroughRecord),
  levelInProgress: z.unknown().optional(),
});

type SavedProgress = z.infer<typeof savedProgress>;
type LevelInProgressRecord = z.infer<typeof levelInProgressRecord>;

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
    lastPlaythroughs: saved.lastPlaythroughs.map(mapPlaythrough),
    levelInProgress: levelInProgressFrom(saved.levelInProgress),
  });
}

// A broken level in progress only costs her the place she left, never the rest of her progress.
function levelInProgressFrom(saved: unknown): LevelInProgress | null {
  if (saved === null) return null;
  const parsed = levelInProgressRecord.safeParse(saved);
  if (!parsed.success) return null;
  const { levelId, frames, hero, stars, collectedStars, collectedKeys, gates, boulders } = parsed.data;
  const tiles = (records: readonly z.infer<typeof tileRecord>[]) =>
    records.map(({ column, row }) => TilePosition.at(column, row));
  try {
    return {
      level: LevelId.of(levelId),
      time: PlayTime.ofFrames(frames),
      snapshot: {
        hero: { feet: WorldPosition.at(hero.x, hero.y), facing: facings[hero.facing] },
        stars: tiles(stars),
        collectedStars: tiles(collectedStars),
        collectedKeys: tiles(collectedKeys),
        gates,
        boulders: tiles(boulders),
      },
    };
  } catch {
    return null;
  }
}

function toSaved(progress: GameProgress): SavedProgress {
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
    levelInProgress: levelInProgressRecordOf(progress.levelInProgress),
  };
}

function levelInProgressRecordOf(inProgress: LevelInProgress | null): LevelInProgressRecord | null {
  if (!inProgress) return null;
  const { level, time, snapshot } = inProgress;
  const tiles = (positions: readonly TilePosition[]) => positions.map(({ column, row }) => ({ column, row }));
  const { feet, facing } = snapshot.hero;
  if (facing.name !== 'up' && facing.name !== 'down' && facing.name !== 'left' && facing.name !== 'right') return null;
  return {
    levelId: level.value,
    frames: time.frames,
    hero: { x: feet.x, y: feet.y, facing: facing.name },
    stars: tiles(snapshot.stars),
    collectedStars: tiles(snapshot.collectedStars),
    collectedKeys: tiles(snapshot.collectedKeys),
    gates: [...snapshot.gates],
    boulders: tiles(snapshot.boulders),
  };
}
