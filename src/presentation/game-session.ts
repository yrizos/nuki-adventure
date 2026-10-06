import type { PlayLevel } from '../application/play-level';
import {
  type Area,
  LevelCompleted,
  type LevelId,
  OrbCollected,
  type OrbColor,
  SignpostLeft,
  SignpostRead,
  StarCollected,
} from '../domain/level/level';
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
  someColorsBack: 'ΜΠΡΑΒΟ! ΜΕΝΕΙ ΑΛΛΗ ΜΙΑ ΣΦΑΙΡΑ!',
  colorsBack: 'ΤΑ ΧΡΩΜΑΤΑ ΕΠΕΣΤΡΕΨΑΝ!',
  doorOpen: 'ΜΠΡΑΒΟ! Η ΠΟΡΤΑ ΓΙΑ ΤΟ ΕΠΟΜΕΝΟ ΕΠΙΠΕΔΟ ΕΙΝΑΙ ΑΝΟΙΧΤΗ!',
} as const;

type Phase =
  | { readonly name: 'playing' }
  | {
      readonly name: 'holding';
      readonly until: number;
      readonly origin: TilePosition;
      readonly color: OrbColor;
      readonly restores: Area;
    }
  | { readonly name: 'restoring'; readonly since: number; readonly origin: TilePosition; readonly restores: Area }
  | { readonly name: 'closing'; readonly since: number; readonly result: LevelResult }
  | { readonly name: 'ended' };

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
  private phase: Phase = { name: 'playing' };
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
    this.phase = { name: 'playing' };
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
          this.phase = {
            name: 'holding',
            until: this.frame + holdFrames,
            origin: event.position,
            color: event.color,
            restores: event.restores,
          };
        } else if (event instanceof LevelCompleted) {
          this.sound.door();
          const level = play.view(id);
          const collectedStars = level.collected.length;
          const result = {
            frames: this.frame - this.run.startFrame,
            collectedStars,
            starCount: collectedStars + level.stars.length,
          };
          this.phase = { name: 'closing', since: this.frame, result };
        }
      }
      if (play.view(id).hero.step?.framesTaken === 0) this.sound.footstep();
      const restorationMessage = messageBox.text === messages.colorsBack || messageBox.text === messages.someColorsBack;
      if (this.phase.name === 'playing' && restorationMessage && play.view(id).hero.step) messageBox.hide(this.frame);
    }
    if (this.phase.name === 'holding' && this.frame >= this.phase.until) {
      this.sound.restoring();
      this.phase = { name: 'restoring', since: this.frame, origin: this.phase.origin, restores: this.phase.restores };
    } else if (
      this.phase.name === 'restoring' &&
      this.frame - this.phase.since >= this.run.painter.restorationLength(this.phase.origin)
    ) {
      this.run.restored = [...this.run.restored, this.phase.restores];
      this.phase = { name: 'playing' };
    } else if (this.phase.name === 'closing' && this.frame - this.phase.since >= closingLength) {
      this.levelEnd.show(this.phase.result);
      this.phase = { name: 'ended' };
    } else if (this.phase.name === 'ended' && (pressedA || pressedB)) {
      this.continuePlaying();
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
