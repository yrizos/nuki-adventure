import type { ManageProgress, SuspendedRun } from '../../progress';
import type { LevelId } from '../../level';
import { endScreenFadeLength } from '../screens/end-screen';
import type { Intro } from '../screens/intro';
import type { GameSession, PlayableLevel, SessionReport } from '../session/game-session';

export interface Screens {
  readonly showIntro: () => void;
  readonly showMenuScreen: () => void;
  readonly animateMenuScreen: (framesOpen: number) => void;
  readonly showLevelPicker: () => void;
  readonly closeLevelPicker: () => void;
  readonly animateLevelPicker: () => void;
  readonly showEndScreen: () => void;
  readonly animateEndScreen: (framesOpen: number, framesLeaving: number) => void;
  readonly showLevel: (usesA: boolean, usesB: boolean) => void;
}

type Screen =
  | { readonly name: 'menu-screen' | 'level-picker' }
  | { readonly name: 'end-screen'; leavingFrom: number | null }
  | { readonly name: 'intro'; readonly intro: Intro }
  | { readonly name: 'playing'; readonly session: GameSession };

const endScreenStay = 120;

export class GameNavigator {
  private screen: Screen = { name: 'menu-screen' };
  private framesOpen = 0;

  constructor(
    private readonly levels: readonly PlayableLevel[],
    private readonly progress: Pick<ManageProgress, 'view' | 'levelAfter'>,
    private readonly startSession: (
      level: PlayableLevel,
      report: SessionReport,
      suspended: SuspendedRun | undefined,
    ) => GameSession,
    private readonly startIntro: () => Intro,
    private readonly screens: Screens,
  ) {}

  get state(): Screen['name'] {
    return this.screen.name;
  }

  get session(): GameSession | null {
    return 'session' in this.screen ? this.screen.session : null;
  }

  get intro(): Intro | null {
    return 'intro' in this.screen ? this.screen.intro : null;
  }

  openIntro(): void {
    this.screen = { name: 'intro', intro: this.startIntro() };
    this.screens.showIntro();
  }

  // The screen shows its first frame as it opens, so it never appears with a pose left over from its last visit.
  // Leaving a level keeps where she was, so continuing can take her back there.
  openMenuScreen(): void {
    this.suspend();
    this.screen = { name: 'menu-screen' };
    this.screens.showMenuScreen();
    this.screens.animateMenuScreen(0);
    this.framesOpen = 1;
  }

  suspend(): void {
    this.session?.suspend();
  }

  // The level picker opens over the menu screen, which keeps its frame count so closing the picker never
  // replays the title.
  openLevelPicker(): void {
    this.screen = { name: 'level-picker' };
    this.screens.showLevelPicker();
  }

  closeLevelPicker(): void {
    if (this.screen.name !== 'level-picker') return;
    this.screen = { name: 'menu-screen' };
    this.screens.closeLevelPicker();
  }

  openEndScreen(): void {
    this.screen = { name: 'end-screen', leavingFrom: null };
    this.framesOpen = 0;
    this.screens.showEndScreen();
    this.screens.animateEndScreen(0, 0);
  }

  leaveEndScreen(): void {
    if (this.screen.name === 'end-screen') this.screen.leavingFrom ??= this.framesOpen;
  }

  // Menus animate on the same frames as gameplay, so their timing is as deterministic as a level's.
  tick(): void {
    if ('session' in this.screen) this.screen.session.tick();
    else if ('intro' in this.screen) {
      this.screen.intro.tick();
      if (this.screen.intro.finished) this.play(this.levels[0]!.id);
    } else if (this.screen.name === 'menu-screen') this.screens.animateMenuScreen(this.framesOpen++);
    else if (this.screen.name === 'level-picker') this.screens.animateLevelPicker();
    else if (this.screen.name === 'end-screen') {
      this.framesOpen++;
      if (this.framesOpen >= endScreenStay) this.leaveEndScreen();
      const leaving = this.screen.leavingFrom === null ? 0 : this.framesOpen - this.screen.leavingFrom;
      if (leaving >= endScreenFadeLength) this.openMenuScreen();
      else this.screens.animateEndScreen(this.framesOpen, leaving);
    }
  }

  // A disabled row is the only thing keeping a locked level out of reach on the page, so the choice is checked here too.
  play(id: LevelId, suspended?: SuspendedRun): void {
    const level = this.levels.find((candidate) => candidate.id.equals(id));
    const unlocked = this.progress.view().levels.some((candidate) => candidate.id.equals(id) && candidate.isUnlocked);
    if (!level || !unlocked) return;
    const session = this.startSession(
      level,
      {
        completed: () => {
          const next = this.progress.levelAfter(level.id);
          if (next) this.play(next);
          else this.openEndScreen();
        },
      },
      suspended,
    );
    this.screens.showLevel(session.uses('a'), session.uses('b'));
    this.screen = { name: 'playing', session };
  }
}
