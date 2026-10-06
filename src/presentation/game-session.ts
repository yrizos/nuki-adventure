import type { PlayLevel } from '../application/play-level';
import type { Area } from '../domain/level/collectibles';
import { LevelCompleted, OrbCollected, SignpostLeft, SignpostRead, StarCollected } from '../domain/level/level-events';
import type { LevelId } from '../domain/level/level-id';
import type { Controls } from './controls';
import { closingLevel, holdingOrb, type Phase, phaseAfterFrame, playing } from './game-phase';
import { HeroAnimator } from './hero-animator';
import type { LevelEndWindow } from './level-end';
import { MessageBox } from './message-box';
import type { Picture } from './picture';
import type { Sound } from './sound';
import { WorldPainter } from './world-painter';

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
    private readonly controls: Pick<Controls, 'takePress' | 'direction'>,
    private readonly sound: Pick<Sound, 'star' | 'orb' | 'door' | 'footstep' | 'restoring'>,
    private readonly levelEnd: Pick<LevelEndWindow, 'show' | 'hide'>,
  ) {
    this.run = this.begin();
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
      const events = [...(reading ? play.read(id) : []), ...play.advance(id, this.controls.direction())];
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
          const collectedStars = level.collected.length;
          const result = {
            frames: this.frame - this.run.startFrame,
            collectedStars,
            starCount: collectedStars + level.stars.length,
          };
          this.phase = closingLevel(result, this.frame);
        }
      }
      if (play.view(id).hero.step?.framesTaken === 0) this.sound.footstep();
      const restorationMessage = messageBox.text === messages.colorsBack || messageBox.text === messages.someColorsBack;
      if (this.phase.name === 'playing' && restorationMessage && play.view(id).hero.step) messageBox.hide(this.frame);
    }
    if (this.phase.name === 'restoring') {
      const level = play.view(id);
      const doorShown = this.frame - this.phase.since >= this.run.painter.doorOpeningLength(this.phase.origin);
      if (level.orbs.length === 0 && !level.door.isOpen && doorShown) play.openDoor(id);
    }
    const next = phaseAfterFrame(this.phase, {
      frame: this.frame,
      restorationLength: (origin) => this.run.painter.restorationLength(origin),
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
          this.levelEnd.show(this.phase.result);
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
    this.frame++;
  }

  paint(picture: Picture): void {
    const { restored } = this.run;
    const level = this.run.play.view(this.run.id);
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
