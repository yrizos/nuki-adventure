import {
  Direction,
  type LevelAction,
  LevelCompleted,
  type LevelId,
  type LevelView,
  OrbCollected,
  PlatePressed,
  PlateReleased,
  type PlayLevel,
  SwingGateClosingStarted,
  SwingGateOpeningStarted,
  SwingGateStuck,
} from '../../level';
import type { ManageProgress, SuspendedRun } from '../../progress';
import type { Controls } from '../input/controls';
import {
  appearing,
  arrivalLength,
  closingLevel,
  restoringOrb,
  type Phase,
  phaseAfterFrame,
  playing,
  swingingGate,
} from './game-phase';
import { HeroAnimator, pushingPose } from '../world/hero/hero-animator';
import { MessageBox } from '../screens/message-box';
import type { Picture } from '../graphics/picture';
import type { Sound } from '../audio/sound';
import { plateSinkLength, WorldPainter } from '../world/painting/world-painter';
import { areaRestorationLength, doorOpeningLength } from '../world/transition/world-transition';

export const messages = {
  colorsBack: 'ΤΑ ΧΡΩΜΑΤΑ ΕΠΕΣΤΡΕΨΑΝ!\nΗ ΠΟΡΤΑ ΑΝΟΙΞΕ!',
  gateStuck: 'Η ΠΟΡΤΑ ΔΕΝ ΑΝΟΙΓΕΙ!',
} as const;

const humReach = 4;
// A mobile browser can close a tab without warning, so play is also saved every so often instead of only on leaving.
const saveEvery = 60;

const buttonFor: Readonly<Record<LevelAction, 'a' | 'b'>> = { operate: 'a', grip: 'a' };

export function humVolume(level: LevelView): number {
  const hero = level.hero.position;
  const nearest = Math.min(
    ...level.orbs.map((orb) => Math.hypot(orb.position.column - hero.column, orb.position.row - hero.row)),
  );
  return Math.max(0, 1 - nearest / humReach);
}

export interface PlayableLevel {
  readonly id: LevelId;
  readonly start: () => PlayLevel;
  readonly arrives?: boolean;
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
  plateDepth: number;
}

export class GameSession {
  private frame = 0;
  private phase: Phase;
  private readonly run: LevelRun;
  private calm: SuspendedRun | null = null;

  constructor(
    level: PlayableLevel,
    private readonly controls: Pick<Controls, 'takePress' | 'isHeld' | 'heading'>,
    private readonly sound: Pick<
      Sound,
      'orb' | 'hum' | 'door' | 'footstep' | 'restoring' | 'arrival' | 'gate' | 'plate'
    >,
    private readonly progress: Pick<ManageProgress, 'reach' | 'complete' | 'suspend'>,
    private readonly report: SessionReport,
    private readonly random?: () => number,
    suspended?: SuspendedRun,
  ) {
    this.run = this.begin(level, suspended);
    // A resumed level shows her where she was at once, so it never replays the arrival.
    const arrives = level.arrives && this.calm === null;
    this.phase = arrives ? appearing(this.frame) : playing;
    if (arrives) this.sound.arrival();
  }

  get level(): LevelView {
    return this.run.play.view(this.run.id);
  }

  prompts(button: 'a' | 'b'): boolean {
    if (this.phase.name !== 'playing') return false;
    const level = this.level;
    const available: readonly LevelAction[] = [
      // The prompt only invites her to open the gate, so it does not nag her to close it once she walks through.
      ...(level.operableGate?.state === 'closed' ? (['operate'] as const) : []),
      ...(level.canGrip ? (['grip'] as const) : []),
    ];
    return available.some((action) => buttonFor[action] === button);
  }

  uses(button: 'a' | 'b'): boolean {
    return this.level.actions.some((action) => buttonFor[action] === button);
  }

  get messageText(): string {
    return this.run.messageBox.text ?? '';
  }

  tick(): void {
    // Presses that nothing answers are dropped instead of waiting for a later screen.
    const pressedA = this.controls.takePress('a');
    this.controls.takePress('b');
    const { messageBox, id, play } = this.run;
    const operated = pressedA && this.phase.name === 'playing' ? play.operateGate(id) : [];
    if (operated.some((event) => event instanceof SwingGateStuck)) messageBox.show(messages.gateStuck, this.frame);
    if (
      operated.some((event) => event instanceof SwingGateOpeningStarted || event instanceof SwingGateClosingStarted)
    ) {
      this.sound.gate();
      this.transitionTo(swingingGate(this.frame));
    }
    if (this.phase.name === 'swinging-gate') play.advance(id, null);
    else if (this.phase.name === 'playing' || this.phase.name === 'restoring') {
      // Holding A keeps her attached to the boulder, and the joystick then moves it one whole tile at a time.
      if (!this.controls.isHeld('a')) play.release(id);
      else if (this.phase.name === 'playing') play.grip(id);
      const events = play.advance(id, this.controls.heading());
      for (const event of events) {
        // A plate swings the gate while she keeps walking, because stepping on and off it must never freeze her.
        if (event instanceof SwingGateOpeningStarted || event instanceof SwingGateClosingStarted) this.sound.gate();
        else if (event instanceof PlatePressed || event instanceof PlateReleased)
          this.sound.plate(event instanceof PlatePressed);
        else if (event instanceof OrbCollected) {
          this.sound.orb(event.last);
          if (event.last) messageBox.show(messages.colorsBack, this.frame);
          this.transitionTo(restoringOrb(event, this.frame));
        } else if (event instanceof LevelCompleted) {
          this.sound.door();
          this.calm = null;
          this.progress.complete(id, { playFrames: this.frame - this.run.startFrame });
          this.transitionTo(closingLevel(this.frame));
        }
      }
      const walkAwayMessage = [messages.colorsBack, messages.gateStuck].some((message) => messageBox.text === message);
      if (this.phase.name === 'playing' && walkAwayMessage && play.view(id).hero.isWalking) messageBox.hide(this.frame);
    }
    // Depth steps one frame at a time, so a plate released halfway down rises from where it is.
    this.run.plateDepth = Math.min(
      Math.max(this.run.plateDepth + (play.view(id).isPlateDown ? 1 : -1), 0),
      plateSinkLength,
    );
    if (this.phase.name === 'restoring') {
      const level = play.view(id);
      const doorShown =
        this.frame - this.phase.since >= doorOpeningLength(level.door, level.scenery.size, this.phase.origin);
      if (level.orbs.length === 0 && !level.door.isOpen && doorShown) play.openDoor(id);
    }
    this.transitionTo(
      phaseAfterFrame(this.phase, {
        frame: this.frame,
        restorationLength: (origin, restores) => areaRestorationLength(play.view(id).scenery.size, origin, restores),
        gateSwinging: play.view(id).gates.some((gate) => gate.isSwinging),
      }),
    );
    // She stands still while the gate swings, so her last stride must not keep her walking or stepping.
    if (this.phase.name !== 'swinging-gate') {
      this.run.animator.advance(this.run.play.view(this.run.id).hero);
      if (this.run.animator.footfall) this.sound.footstep();
    }
    this.sound.hum(this.phase.name === 'playing' ? humVolume(play.view(id)) : 0);
    this.frame++;
    // Only a moment with nothing moving is kept, so leaving halfway through a swing or a slide goes back to just before it.
    const snapshot = this.phase.name === 'playing' ? play.snapshot(id) : null;
    if (snapshot) this.calm = { snapshot, playFrames: this.frame - this.run.startFrame };
    if (this.phase.name === 'playing' && this.frame % saveEvery === 0) this.suspend();
  }

  // The level is saved as it was at its last calm moment, so continuing goes on from there with the same play time.
  suspend(): void {
    if (this.calm) this.progress.suspend(this.run.id, this.calm);
  }

  paint(picture: Picture, tickProgress = 1): void {
    const current = this.run.play.view(this.run.id);
    const level = { ...current, hero: current.hero.between(tickProgress) };
    const sliding = level.boulders.find((boulder) => boulder.isSliding);
    const opening = level.gates.find((gate) => gate.state === 'opening');
    const scene = {
      level,
      frame: this.frame,
      // The push art faces north, so it fits only a gate she swings open north, away from her, or a boulder pushed north.
      hero:
        this.phase.name === 'swinging-gate' &&
        opening !== undefined &&
        !level.plate &&
        opening.swing === Direction.Up &&
        level.hero.position.row > opening.position.row
          ? pushingPose(this.frame - this.phase.since)
          : sliding?.heading === Direction.Up && level.hero.facing === Direction.Up
            ? pushingPose(sliding.travelled / 2)
            : this.run.animator.pose(level.hero, this.frame),
      plateDepth: this.run.plateDepth,
      ...(this.phase.name === 'appearing' ? { arrival: this.frame - this.phase.since } : {}),
    };
    if (this.phase.name === 'restoring') {
      const { restores } = this.phase;
      const before = level.restored.filter((area) => area !== restores);
      this.run.painter.paintRestoring(picture, scene, this.phase.origin, this.frame - this.phase.since, before, [
        ...before,
        restores,
      ]);
    } else if (this.phase.name === 'closing')
      this.run.painter.paintClosing(picture, scene, this.frame - this.phase.since);
    else if (this.phase.name === 'ended') picture.fill('Ink');
    else this.run.painter.paint(picture, scene, level.restored);
    if (this.phase.name !== 'closing' && this.phase.name !== 'ended') this.run.messageBox.paint(picture, this.frame);
  }

  private transitionTo(next: Phase): void {
    const previous = this.phase;
    if (next === previous) return;
    this.phase = next;
    if (next.name === 'restoring') this.sound.restoring();
    if (previous.name === 'closing' && next.name === 'ended') this.report.completed();
  }

  private begin({ id, start, arrives }: PlayableLevel, suspended: SuspendedRun | undefined): LevelRun {
    const play = start();
    const resumed = suspended !== undefined && play.resume(id, suspended.snapshot);
    if (resumed) this.calm = suspended;
    else this.progress.reach(id);
    return {
      id,
      play,
      painter: new WorldPainter(play.view(id), this.random),
      animator: new HeroAnimator(),
      messageBox: new MessageBox(),
      // Play time starts on the first playable frame, so the arrival never counts toward it.
      // A resumed level has already been played for a while, so its play time goes on from there.
      startFrame: resumed ? this.frame - suspended.playFrames : this.frame + (arrives ? arrivalLength : 0),
      plateDepth: resumed && play.view(id).isPlateDown ? plateSinkLength : 0,
    };
  }
}
