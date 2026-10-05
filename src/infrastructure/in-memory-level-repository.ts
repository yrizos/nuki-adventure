import type { Level, LevelId } from '../domain/level/level';
import type { LevelRepository } from '../domain/level/level-repository';

export class InMemoryLevelRepository implements LevelRepository {
  private readonly levels = new Map<string, Level>();

  constructor(levels: readonly Level[]) {
    for (const level of levels) this.save(level);
  }

  load(id: LevelId): Level {
    const level = this.levels.get(id.value);
    if (!level) throw new Error(`No level with id ${id.value}`);
    return level;
  }

  save(level: Level): void {
    this.levels.set(level.id.value, level);
  }
}
