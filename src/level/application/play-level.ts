import type { LevelEvent } from '../domain/level-events';
import type { LevelId } from '../domain/level-id';
import type { LevelRepository } from '../domain/level-repository';
import type { Heading } from '../domain/position';
import { type LevelView, levelView } from './level-view';

export class PlayLevel {
  constructor(private readonly levels: LevelRepository) {}

  view(id: LevelId): LevelView {
    return levelView(this.levels.load(id));
  }

  advance(id: LevelId, heading: Heading | null): readonly LevelEvent[] {
    const level = this.levels.load(id);
    const events = level.tick(heading);
    this.levels.save(level);
    return events;
  }

  operateGate(id: LevelId): readonly LevelEvent[] {
    const level = this.levels.load(id);
    const events = level.operateGate();
    this.levels.save(level);
    return events;
  }

  grip(id: LevelId): void {
    const level = this.levels.load(id);
    level.grip();
    this.levels.save(level);
  }

  release(id: LevelId): void {
    const level = this.levels.load(id);
    level.release();
    this.levels.save(level);
  }

  openDoor(id: LevelId): void {
    const level = this.levels.load(id);
    level.openDoor();
    this.levels.save(level);
  }
}
