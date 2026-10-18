import type { LevelEvent } from '../domain/level-events';
import type { LevelId } from '../domain/level-id';
import type { LevelRepository } from '../domain/level-repository';
import type { LevelSnapshot } from '../domain/level-snapshot';
import type { Heading } from '../domain/position';
import { type LevelView, levelView } from './level-view';

export class PlayLevel {
  constructor(private readonly levels: LevelRepository) {}

  view(id: LevelId): LevelView {
    return levelView(this.levels.load(id));
  }

  snapshot(id: LevelId): LevelSnapshot | null {
    return this.levels.load(id).snapshot;
  }

  // A snapshot that no longer fits the level leaves it as it started, so she plays it afresh.
  resume(id: LevelId, snapshot: LevelSnapshot): boolean {
    try {
      this.levels.save(this.levels.load(id).resumed(snapshot));
      return true;
    } catch (error) {
      if (error instanceof RangeError) return false;
      throw error;
    }
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
