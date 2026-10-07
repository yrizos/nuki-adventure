import type { GameProgress } from './game-progress';

export interface ProgressRepository {
  load(): GameProgress;
  save(progress: GameProgress): void;
}
