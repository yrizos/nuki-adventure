import type { Level } from './level';
import type { LevelId } from '../shared/level-id';

export interface LevelRepository {
  load(id: LevelId): Level;
  save(level: Level): void;
}
