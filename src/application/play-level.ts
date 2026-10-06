import type { LevelEvent } from '../domain/level/level-events';
import type { LevelId } from '../domain/level/level-id';
import type { LevelRepository } from '../domain/level/level-repository';
import type { Direction } from '../domain/level/position';
import { type LevelView, levelView } from './level-view';

export class PlayLevel {
  constructor(private readonly levels: LevelRepository) {}

  view(id: LevelId): LevelView {
    return levelView(this.levels.load(id));
  }

  advance(id: LevelId, direction: Direction | null): readonly LevelEvent[] {
    const level = this.levels.load(id);
    const events = level.tick(direction);
    this.levels.save(level);
    return events;
  }

  openDoor(id: LevelId): void {
    const level = this.levels.load(id);
    level.openDoor();
    this.levels.save(level);
  }

  read(id: LevelId): readonly LevelEvent[] {
    const level = this.levels.load(id);
    const events = level.read();
    this.levels.save(level);
    return events;
  }
}
