import type { LevelView } from '../application/level-view';
import type { ManageProgress } from '../application/manage-progress';
import type { PlayLevel } from '../application/play-level';
import type { Area } from '../domain/level/collectibles';
import { LevelCompleted, OrbCollected, SignpostLeft, SignpostRead, StarCollected } from '../domain/level/level-events';
import { Playthrough, PlayTime } from '../domain/progress/playthrough';
import type { LevelId } from '../domain/shared/level-id';
import { StarCount } from '../domain/shared/star-count';
import type { Controls } from './controls';
import { closingLevel, restoringOrb, type Phase, phaseAfterFrame, playing } from './game-phase';
import { HeroAnimator } from './hero-animator';
import type { LevelEndWindow } from './level-end';
import { MessageBox } from './message-box';
import type { Picture } from './picture';
import type { Sound } from './sound';
import { WorldPainter } from './world-painter';
import { doorOpeningLength, restorationLength } from './world-transition';

export const messages = {
  someColorsBack: 'ΜΠΡΑΒΟ! ΜΕΝΕΙ ΑΛΛΗ ΜΙΑ ΣΦΑΙΡΑ!',
  colorsBack: 'ΜΠΡΑΒΟ! ΤΑ ΧΡΩΜΑΤΑ ΕΠΕΣΤΡΕΨΑΝ!',
  doorOpen: 'ΜΠΡΑΒΟ! Η ΠΟΡΤΑ ΓΙΑ ΤΟ ΕΠΟΜΕΝΟ ΕΠΙΠΕΔΟ ΕΙΝΑΙ ΑΝΟΙΧΤΗ!',
} as const;

export interface PlayableLevel {
  readonly id: LevelId;
  readonly start: () => PlayLevel;
}

interface LevelRun {
  readonly id: LevelId;
  readonly play: PlayLevel;
  readonly painter: WorldPainter;
  readonly animator: HeroAnimator;
  readonly messageBox: MessageBox;
  readonly startFrame: number;
  restored: readonly Area[];
  signpostText: string | null;
}

export class GameSession {
  private frame = 0;
  private phase: Phase = playing;
  private levelIndex = 0;
  private run: LevelRun;

  constructor(
    private readonly levels: readonly PlayableLevel[],
    private readonly controls: Pick<Controls, 'takePress' | 'heading'>,
    private readonly sound: Pick<Sound, 'star' | 'orb' | 'door' | 'footstep' | 'restoring'>,
    private readonly levelEnd: Pick<LevelEndWindow, 'show' | 'hide'>,
    private readonly progress: Pick<ManageProgress, 'reach' | 'complete'>,
    first: LevelId,
  ) {
    this.levelIndex = Math.max(
      0,
      levels.findIndex(({ id }) => id.equals(first)),
    );
    this.run = this.begin();
  }

  get level(): LevelView {
    return this.run.play.view(this.run.id);
  }

  get messageText(): string {
    return this.run.messageBox.text ?? '';
  }

  continuePlaying(): void {
    if (this.phase.name !== 'ended') return;
    this.transitionTo(playing);
  }

  tick(): void {
    const pressedA = this.controls.takePress('a');
    const pressedB = this.controls.takePress('b');
    const { messageBox, id, play } = this.run;
    if (this.phase.name === 'playing' || this.phase.name === 'restoring') {
      const dismissing =
        (pressedA || pressedB) && messageBox.text !== null && messageBox.text === this.run.signpostText;
      if (dismissing) messageBox.hide(this.frame);
      const reading = (pressedA || pressedB) && !dismissing;
      const events = [...(reading ? play.read(id) : []), ...play.advance(id, this.controls.heading())];
      for (const event of events) {
        if (event instanceof SignpostRead) {
          this.run.signpostText = play.view(id).door.isOpen ? messages.doorOpen : event.text.value;
          messageBox.show(this.run.signpostText, this.frame);
        } else if (event instanceof SignpostLeft && messageBox.text === this.run.signpostText)
          messageBox.hide(this.frame);
        else if (event instanceof StarCollected) this.sound.star(play.view(id).stars.length === 0);
        else if (event instanceof OrbCollected) {
          this.sound.orb();
          messageBox.show(play.view(id).orbs.length > 0 ? messages.someColorsBack : messages.colorsBack, this.frame);
          this.transitionTo(restoringOrb(event, this.frame));
        } else if (event instanceof LevelCompleted) {
          this.sound.door();
          const level = play.view(id);
          const playthrough = Playthrough.of(
            PlayTime.ofFrames(this.frame - this.run.startFrame),
            StarCount.of(level.collected.length),
            StarCount.of(level.collected.length + level.stars.length),
          );
          this.progress.complete(id, playthrough);
          this.transitionTo(closingLevel(playthrough, this.frame));
        }
      }
      const restorationMessage = messageBox.text === messages.colorsBack || messageBox.text === messages.someColorsBack;
      if (this.phase.name === 'playing' && restorationMessage && play.view(id).hero.isWalking)
        messageBox.hide(this.frame);
    }
    if (this.phase.name === 'restoring') {
      const level = play.view(id);
      const doorShown =
        this.frame - this.phase.since >= doorOpeningLength(level.door, level.scenery.size, this.phase.origin);
      if (level.orbs.length === 0 && !level.door.isOpen && doorShown) play.openDoor(id);
    }
    this.transitionTo(
      phaseAfterFrame(this.phase, {
        frame: this.frame,
        restorationLength: (origin) => restorationLength(play.view(id).scenery.size, origin),
        continuing: pressedA || pressedB,
      }),
    );
    this.run.animator.advance(this.run.play.view(this.run.id).hero);
    if (this.run.animator.footfall) this.sound.footstep();
    this.frame++;
  }

  paint(picture: Picture, tickProgress = 1): void {
    const { restored } = this.run;
    const current = this.run.play.view(this.run.id);
    const level = { ...current, hero: current.hero.between(tickProgress) };
    const scene = {
      level,
      frame: this.frame,
      hero: this.run.animator.pose(level.hero, this.frame, false),
      heldOrb: null,
    };
    if (this.phase.name === 'restoring') {
      this.run.painter.paintRestoring(picture, scene, this.phase.origin, this.frame - this.phase.since, restored, [
        ...restored,
        this.phase.restores,
      ]);
    } else if (this.phase.name === 'closing')
      this.run.painter.paintClosing(picture, scene, this.frame - this.phase.since);
    else if (this.phase.name === 'ended') picture.fill('Ink');
    else this.run.painter.paint(picture, scene, restored);
    if (this.phase.name !== 'closing' && this.phase.name !== 'ended') this.run.messageBox.paint(picture, this.frame);
  }

  private transitionTo(next: Phase): void {
    const previous = this.phase;
    if (next === previous) return;
    if (previous.name === 'restoring' && (next.name === 'playing' || next.name === 'restoring'))
      this.run.restored = [...this.run.restored, previous.restores];
    if (previous.name === 'closing' && next.name === 'ended') this.levelEnd.show(previous.playthrough);
    if (previous.name === 'ended' && next.name === 'playing') {
      this.levelEnd.hide();
      this.levelIndex = (this.levelIndex + 1) % this.levels.length;
      this.run = this.begin();
    }
    this.phase = next;
    if (next.name === 'restoring') this.sound.restoring();
  }

  private begin(): LevelRun {
    const { id, start } = this.levels[this.levelIndex]!;
    const play = start();
    this.progress.reach(id);
    return {
      id,
      play,
      painter: new WorldPainter(play.view(id)),
      animator: new HeroAnimator(),
      messageBox: new MessageBox(),
      startFrame: this.frame,
      restored: [],
      signpostText: null,
    };
  }
}
