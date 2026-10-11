import type { LevelView } from '../application/level-view';
import type { ManageProgress } from '../application/manage-progress';
import type { PlayLevel } from '../application/play-level';
import type { Area } from '../domain/level/collectibles';
import { LevelCompleted, KeyCollected, StarCollected } from '../domain/level/level-events';
import { Playthrough, PlayTime } from '../domain/progress/playthrough';
import type { LevelId } from '../domain/shared/level-id';
import { StarCount } from '../domain/shared/star-count';
import type { Controls } from './controls';
import { closingLevel, restoringKey, type Phase, phaseAfterFrame, playing } from './game-phase';
import { HeroAnimator } from './hero-animator';
import { MessageBox } from './message-box';
import type { Picture } from './picture';
import type { Sound } from './sound';
import { WorldPainter } from './world-painter';
import { doorOpeningLength, restorationLength } from './world-transition';

export const messages = {
  someColorsBack: 'ΜΠΡΑΒΟ! ΜΕΝΕΙ ΑΚΟΜΑ ΕΝΑ ΚΛΕΙΔΙ!',
  colorsBack: 'ΜΠΡΑΒΟ! ΤΑ ΧΡΩΜΑΤΑ ΕΠΕΣΤΡΕΨΑΝ!',
} as const;

const humReach = 4;

export function humVolume(level: LevelView): number {
  const hero = level.hero.position;
  const nearest = Math.min(
    ...level.keys.map((key) => Math.hypot(key.position.column - hero.column, key.position.row - hero.row)),
  );
  return Math.max(0, 1 - nearest / humReach);
}

export interface PlayableLevel {
  readonly id: LevelId;
  readonly start: () => PlayLevel;
}

export interface SessionReport {
  readonly completed: () => void;
}

interface LevelRun {
  readonly id: LevelId;
  readonly play: PlayLevel;
  readonly painter: WorldPainter;
  readonly animator: HeroAnimator;
  readonly messageBox: MessageBox;
  readonly startFrame: number;
  restored: readonly Area[];
}

export class GameSession {
  private frame = 0;
  private phase: Phase = playing;
  private readonly run: LevelRun;

  constructor(
    level: PlayableLevel,
    private readonly controls: Pick<Controls, 'takePress' | 'heading'>,
    private readonly sound: Pick<Sound, 'star' | 'key' | 'hum' | 'door' | 'footstep' | 'restoring'>,
    private readonly progress: Pick<ManageProgress, 'reach' | 'complete'>,
    private readonly report: SessionReport,
  ) {
    this.run = this.begin(level);
  }

  get level(): LevelView {
    return this.run.play.view(this.run.id);
  }

  get messageText(): string {
    return this.run.messageBox.text ?? '';
  }

  tick(): void {
    // Nothing in a level answers A or B, so presses are dropped instead of waiting for a later screen.
    this.controls.takePress('a');
    this.controls.takePress('b');
    const { messageBox, id, play } = this.run;
    if (this.phase.name === 'playing' || this.phase.name === 'restoring') {
      const events = play.advance(id, this.controls.heading());
      for (const event of events) {
        if (event instanceof StarCollected) this.sound.star(play.view(id).stars.length === 0);
        else if (event instanceof KeyCollected) {
          this.sound.key();
          messageBox.show(play.view(id).keys.length > 0 ? messages.someColorsBack : messages.colorsBack, this.frame);
          this.transitionTo(restoringKey(event, this.frame));
        } else if (event instanceof LevelCompleted) {
          this.sound.door();
          const level = play.view(id);
          const playthrough = Playthrough.of(
            PlayTime.ofFrames(this.frame - this.run.startFrame),
            StarCount.of(level.collected.length),
            StarCount.of(level.collected.length + level.stars.length),
          );
          this.progress.complete(id, playthrough);
          this.transitionTo(closingLevel(this.frame));
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
      if (level.keys.length === 0 && !level.door.isOpen && doorShown) play.openDoor(id);
    }
    this.transitionTo(
      phaseAfterFrame(this.phase, {
        frame: this.frame,
        restorationLength: (origin) => restorationLength(play.view(id).scenery.size, origin),
      }),
    );
    this.run.animator.advance(this.run.play.view(this.run.id).hero);
    if (this.run.animator.footfall) this.sound.footstep();
    this.sound.hum(this.phase.name === 'playing' ? humVolume(play.view(id)) : 0);
    this.frame++;
  }

  paint(picture: Picture, tickProgress = 1): void {
    const { restored } = this.run;
    const current = this.run.play.view(this.run.id);
    const level = { ...current, hero: current.hero.between(tickProgress) };
    const scene = {
      level,
      frame: this.frame,
      hero: this.run.animator.pose(level.hero, this.frame),
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
    this.phase = next;
    if (next.name === 'restoring') this.sound.restoring();
    if (previous.name === 'closing' && next.name === 'ended') this.report.completed();
  }

  private begin({ id, start }: PlayableLevel): LevelRun {
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
    };
  }
}
