import type { LevelView } from '../application/level-view';
import type { ManageProgress } from '../application/manage-progress';
import type { PlayLevel } from '../application/play-level';
import type { Area } from '../domain/level/collectibles';
import { LevelCompleted, OrbCollected, SignpostLeft, SignpostRead, StarCollected } from '../domain/level/level-events';
import { Playthrough, PlayTime } from '../domain/progress/playthrough';
import type { LevelId } from '../domain/shared/level-id';
import { StarCount } from '../domain/shared/star-count';
import type { Controls } from './controls';
import { closingLevel, holdingOrb, type Phase, phaseAfterFrame, playing } from './game-phase';
import { HeroAnimator } from './hero-animator';
import type { LevelEndWindow } from './level-end';
import { MessageBox } from './message-box';
import type { Picture } from './picture';
import type { Sound } from './sound';
import { WorldPainter } from './world-painter';
import { doorOpeningLength, restorationLength } from './world-transition';

export const messages = {
  someColorsBack: 'ΜΠΡΑΒΟ! ΜΕΝΕΙ ΑΛΛΗ ΜΙΑ ΣΦΑΙΡΑ!',
  colorsBack: 'ΤΑ ΧΡΩΜΑΤΑ ΕΠΕΣΤΡΕΨΑΝ!',
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
    this.levelEnd.hide();
    this.levelIndex = (this.levelIndex + 1) % this.levels.length;
    this.run = this.begin();
    this.phase = playing;
  }

  tick(): void {
    const pressedA = this.controls.takePress('a');
    const pressedB = this.controls.takePress('b');
    const { messageBox, id, play } = this.run;
    if (this.phase.name === 'playing' || this.phase.name === 'holding' || this.phase.name === 'restoring') {
      const dismissing =
        (pressedA || pressedB) && messageBox.text !== null && messageBox.text === this.run.signpostText;
      if (dismissing) messageBox.hide(this.frame);
      const reading = (pressedA || pressedB) && !dismissing;
      const events = [...(reading ? play.read(id) : []), ...play.advance(id, this.controls.heading())];
      for (const event of events) {
        if (event instanceof SignpostRead) {
          // Once the door is open every signpost points the way out, whatever hint it gave before.
          this.run.signpostText = play.view(id).door.isOpen ? messages.doorOpen : event.text.value;
          messageBox.show(this.run.signpostText, this.frame);
        } else if (event instanceof SignpostLeft && messageBox.text === this.run.signpostText)
          messageBox.hide(this.frame);
        else if (event instanceof StarCollected) this.sound.star();
        else if (event instanceof OrbCollected) {
          this.sound.orb();
          // A second orb picked up before the first one's color finishes spreading still keeps the first one's area colored.
          if (this.phase.name === 'holding' || this.phase.name === 'restoring')
            this.run.restored = [...this.run.restored, this.phase.restores];
          messageBox.show(play.view(id).orbs.length > 0 ? messages.someColorsBack : messages.colorsBack, this.frame);
          this.phase = holdingOrb(event, this.frame);
        } else if (event instanceof LevelCompleted) {
          this.sound.door();
          const level = play.view(id);
          const playthrough = Playthrough.of(
            PlayTime.ofFrames(this.frame - this.run.startFrame),
            StarCount.of(level.collected.length),
            StarCount.of(level.collected.length + level.stars.length),
          );
          this.progress.complete(id, playthrough);
          this.phase = closingLevel(playthrough, this.frame);
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
    const next = phaseAfterFrame(this.phase, {
      frame: this.frame,
      restorationLength: (origin) => restorationLength(play.view(id).scenery.size, origin),
      continuing: pressedA || pressedB,
    });
    if (next !== this.phase) {
      switch (this.phase.name) {
        case 'holding':
          this.sound.restoring();
          break;
        case 'restoring':
          this.run.restored = [...this.run.restored, this.phase.restores];
          break;
        case 'closing':
          this.levelEnd.show(this.phase.playthrough);
          break;
        case 'ended':
          this.continuePlaying();
          break;
        case 'playing':
          break;
      }
      this.phase = next;
    }
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
      hero: this.run.animator.pose(level.hero, this.frame, this.phase.name === 'holding'),
      heldOrb: this.phase.name === 'holding' ? this.phase.color : null,
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
