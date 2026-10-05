import type { Level, LevelCompleted, LevelId } from '../domain/level/level';
import type { LevelRepository } from '../domain/level/level-repository';
import type { Direction } from '../domain/level/position';

export class PlayLevel {
  constructor(private readonly levels: LevelRepository) {}

  view(id: LevelId): Level {
    return this.levels.load(id);
  }

  advance(id: LevelId, direction: Direction | null): readonly LevelCompleted[] {
    const level = this.levels.load(id);
    const events = level.tick(direction);
    this.levels.save(level);
    return events;
  }
}
