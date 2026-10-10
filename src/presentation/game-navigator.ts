import { LevelOrder } from '../domain/progress/level-order';
import type { LevelId } from '../domain/shared/level-id';
import type { GameSession, PlayableLevel, SessionReport } from './game-session';

type Screen =
  { readonly name: 'start-screen' } | { readonly name: 'playing' | 'level-end'; readonly session: GameSession };

export class GameNavigator {
  private screen: Screen = { name: 'start-screen' };
  private readonly order: LevelOrder;

  constructor(
    private readonly levels: readonly PlayableLevel[],
    private readonly startSession: (level: PlayableLevel, report: SessionReport) => GameSession,
    private readonly showStartScreen: () => void,
  ) {
    this.order = LevelOrder.of(levels.map(({ id }) => id));
  }

  get state(): Screen['name'] {
    return this.screen.name;
  }

  get session(): GameSession | null {
    return this.screen.name === 'start-screen' ? null : this.screen.session;
  }

  openStartScreen(): void {
    this.screen = { name: 'start-screen' };
    this.showStartScreen();
  }

  play(id: LevelId): void {
    const level = this.levels.find((candidate) => candidate.id.equals(id)) ?? this.levels[0]!;
    const session = this.startSession(level, {
      completed: () => {
        this.screen = { name: 'level-end', session };
      },
      continued: () => {
        const next = this.order.after(level.id);
        if (next) this.play(next);
        else this.openStartScreen();
      },
    });
    this.screen = { name: 'playing', session };
  }
}
