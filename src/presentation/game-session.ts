import type { PlayLevel } from '../application/play-level';
import { LevelCompleted, type LevelId, OrbCollected, type OrbColor, SignpostLeft, SignpostRead, StarCollected } from '../domain/level/level';
import type { TilePosition } from '../domain/level/position';
import type { Controls } from './controls';
import { HeroAnimator } from './hero-animator';
import type { LevelEndWindow, LevelResult } from './level-end';
import { MessageBox } from './message-box';
import type { Picture } from './picture';
import type { Sound } from './sound';
import { closingLength, WorldPainter } from './world-painter';

const holdFrames = 30;

export const messages = {
  hint: 'ΒΡΕΣ ΤΗ ΜΩΒ ΣΦΑΙΡΑ! ΘΑ ΦΕΡΕΙ ΠΙΣΩ ΤΑ ΧΡΩΜΑΤΑ ΚΑΙ ΘΑ ΑΝΟΙΞΕΙ ΤΗΝ ΠΥΛΗ.',
  colorsBack: 'ΤΑ ΧΡΩΜΑΤΑ ΕΠΕΣΤΡΕΨΑΝ!',
  doorOpen: 'ΜΠΡΑΒΟ! Η ΠΟΡΤΑ ΓΙΑ ΤΟ ΕΠΟΜΕΝΟ ΕΠΙΠΕΔΟ ΕΙΝΑΙ ΑΝΟΙΧΤΗ!',
} as const;

type Phase =
  | { readonly name: 'playing'; readonly restored: boolean }
  | { readonly name: 'holding'; readonly until: number; readonly origin: TilePosition; readonly color: OrbColor }
  | { readonly name: 'restoring'; readonly since: number; readonly origin: TilePosition }
  | { readonly name: 'closing'; readonly since: number; readonly result: LevelResult }
  | { readonly name: 'ended' };

interface LevelRun {
  readonly play: PlayLevel;
  readonly painter: WorldPainter;
  readonly animator: HeroAnimator;
  readonly messageBox: MessageBox;
  readonly startFrame: number;
}

export class GameSession {
  private frame = 0;
  private phase: Phase = { name: 'playing', restored: false };
  private run: LevelRun;

  constructor(
    private readonly createPlay: () => PlayLevel,
    private readonly levelId: LevelId,
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
    this.run = this.begin();
    this.phase = { name: 'playing', restored: false };
  }

  tick(): void {
    const pressedA = this.controls.takePress('a');
    const pressedB = this.controls.takePress('b');
    const { messageBox } = this.run;
    if (this.phase.name === 'playing' || this.phase.name === 'holding' || this.phase.name === 'restoring') {
      const signpostText = this.phase.name !== 'playing' || this.phase.restored ? messages.doorOpen : messages.hint;
      const dismissing = (pressedA || pressedB) && messageBox.text === signpostText;
      if (dismissing) messageBox.hide(this.frame);
      const reading = (pressedA || pressedB) && !dismissing;
      const events = [...(reading ? this.run.play.read(this.levelId) : []), ...this.run.play.advance(this.levelId, this.controls.direction())];
      for (const event of events) {
        if (event instanceof SignpostRead) messageBox.show(signpostText, this.frame);
        else if (event instanceof SignpostLeft && messageBox.text === signpostText) messageBox.hide(this.frame);
        else if (event instanceof StarCollected) this.sound.star();
        else if (event instanceof OrbCollected) {
          this.sound.orb();
          messageBox.show(messages.colorsBack, this.frame);
          this.phase = { name: 'holding', until: this.frame + holdFrames, origin: event.position, color: event.color };
        } else if (event instanceof LevelCompleted) {
          this.sound.door();
          const level = this.run.play.view(this.levelId);
          const collectedStars = level.collected.length;
          const result = { frames: this.frame - this.run.startFrame, collectedStars, starCount: collectedStars + level.stars.length };
          this.phase = { name: 'closing', since: this.frame, result };
        }
      }
      if (this.run.play.view(this.levelId).hero.step?.framesTaken === 0) this.sound.footstep();
      if (this.phase.name === 'playing' && this.phase.restored && messageBox.text === messages.colorsBack &&
        this.run.play.view(this.levelId).hero.step) {
        messageBox.hide(this.frame);
      }
    }
    if (this.phase.name === 'holding' && this.frame >= this.phase.until) {
      this.sound.restoring();
      this.phase = { name: 'restoring', since: this.frame, origin: this.phase.origin };
    } else if (this.phase.name === 'restoring' && this.frame - this.phase.since >= this.run.painter.restorationLength(this.phase.origin)) {
      this.phase = { name: 'playing', restored: true };
    } else if (this.phase.name === 'closing' && this.frame - this.phase.since >= closingLength) {
      this.levelEnd.show(this.phase.result);
      this.phase = { name: 'ended' };
    } else if (this.phase.name === 'ended' && (pressedA || pressedB)) {
      this.continuePlaying();
    }
    this.run.animator.advance(this.run.play.view(this.levelId).hero);
    this.frame++;
  }

  paint(picture: Picture): void {
    const level = this.run.play.view(this.levelId);
    const scene = {
      level,
      frame: this.frame,
      hero: this.run.animator.pose(level.hero, this.frame, this.phase.name === 'holding'),
      heldOrb: this.phase.name === 'holding' ? this.phase.color : null,
    };
    if (this.phase.name === 'restoring') this.run.painter.paintRestoring(picture, scene, this.phase.origin, this.frame - this.phase.since);
    else if (this.phase.name === 'closing') this.run.painter.paintClosing(picture, scene, this.frame - this.phase.since);
    else if (this.phase.name === 'ended') picture.fill('Ink');
    else this.run.painter.paint(picture, scene, this.phase.name === 'playing' && this.phase.restored ? 'colored' : 'faded');
    if (this.phase.name !== 'closing' && this.phase.name !== 'ended') this.run.messageBox.paint(picture, this.frame);
  }

  private begin(): LevelRun {
    const play = this.createPlay();
    return {
      play,
      painter: new WorldPainter(play.view(this.levelId)),
      animator: new HeroAnimator(),
      messageBox: new MessageBox(),
      startFrame: this.frame,
    };
  }
}
