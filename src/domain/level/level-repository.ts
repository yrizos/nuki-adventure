import type { Level } from './level';
import type { LevelId } from './level-id';

export interface LevelRepository {
  load(id: LevelId): Level;
  save(level: Level): void;
}
