import type { Level, LevelEvent, LevelId } from '../domain/level/level';
import type { LevelRepository } from '../domain/level/level-repository';
import type { Direction } from '../domain/level/position';

export class PlayLevel {
  constructor(private readonly levels: LevelRepository) {}

  view(id: LevelId): Level {
    return this.levels.load(id);
  }

  advance(id: LevelId, direction: Direction | null): readonly LevelEvent[] {
    const level = this.levels.load(id);
    const events = level.tick(direction);
    this.levels.save(level);
    return events;
  }

  read(id: LevelId): readonly LevelEvent[] {
    const level = this.levels.load(id);
    const events = level.read();
    this.levels.save(level);
    return events;
  }
}
