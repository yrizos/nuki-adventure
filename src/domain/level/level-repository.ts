import type { Level, LevelId } from './level';

export interface LevelRepository {
  load(id: LevelId): Level;
  save(level: Level): void;
}
