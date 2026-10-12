import type { LevelEvent } from '../domain/level/level-events';
import type { LevelId } from '../domain/shared/level-id';
import type { LevelRepository } from '../domain/level/level-repository';
import type { Heading } from '../domain/level/position';
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

  finishGate(id: LevelId): readonly LevelEvent[] {
    const level = this.levels.load(id);
    const events = level.finishGate();
    this.levels.save(level);
    return events;
  }

  push(id: LevelId): void {
    const level = this.levels.load(id);
    level.push();
    this.levels.save(level);
  }

  pull(id: LevelId): void {
    const level = this.levels.load(id);
    level.pull();
    this.levels.save(level);
  }

  openDoor(id: LevelId): void {
    const level = this.levels.load(id);
    level.openDoor();
    this.levels.save(level);
  }
}
