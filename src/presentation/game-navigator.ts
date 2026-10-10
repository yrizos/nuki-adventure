import type { ManageProgress } from '../application/manage-progress';
import { LevelOrder } from '../domain/progress/level-order';
import type { LevelId } from '../domain/shared/level-id';
import type { GameSession, PlayableLevel, SessionReport } from './game-session';

export interface Screens {
  readonly showStartScreen: () => void;
  readonly animateStartScreen: (framesOpen: number) => void;
  readonly showLevelPicker: () => void;
  readonly showLevel: () => void;
}

type Screen =
  | { readonly name: 'start-screen' | 'level-picker' }
  | { readonly name: 'playing' | 'level-end'; readonly session: GameSession };

export class GameNavigator {
  private screen: Screen = { name: 'start-screen' };
  private framesOpen = 0;
  private readonly order: LevelOrder;

  constructor(
    private readonly levels: readonly PlayableLevel[],
    private readonly progress: Pick<ManageProgress, 'view'>,
    private readonly startSession: (level: PlayableLevel, report: SessionReport) => GameSession,
    private readonly screens: Screens,
  ) {
    this.order = LevelOrder.of(levels.map(({ id }) => id));
  }

  get state(): Screen['name'] {
    return this.screen.name;
  }

  get session(): GameSession | null {
    return 'session' in this.screen ? this.screen.session : null;
  }

  // The screen shows its first frame as it opens, so it never appears with a pose left over from its last visit.
  openStartScreen(): void {
    this.screen = { name: 'start-screen' };
    this.screens.showStartScreen();
    this.screens.animateStartScreen(0);
    this.framesOpen = 1;
  }

  openLevelPicker(): void {
    this.screen = { name: 'level-picker' };
    this.framesOpen = 0;
    this.screens.showLevelPicker();
  }

  // Menus animate on the same frames as gameplay, so their timing is as deterministic as a level's.
  tick(): void {
    if ('session' in this.screen) this.screen.session.tick();
    else if (this.screen.name === 'start-screen') this.screens.animateStartScreen(this.framesOpen++);
  }

  // A disabled row is the only thing keeping a locked level out of reach on the page, so the choice is checked here too.
  play(id: LevelId): void {
    const level = this.levels.find((candidate) => candidate.id.equals(id));
    const unlocked = this.progress.view().levels.some((candidate) => candidate.id.equals(id) && candidate.isUnlocked);
    if (!level || !unlocked) return;
    this.screens.showLevel();
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
