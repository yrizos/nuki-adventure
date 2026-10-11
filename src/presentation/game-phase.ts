import type { Area } from '../domain/level/collectibles';
import type { KeyCollected } from '../domain/level/level-events';
import type { TilePosition } from '../domain/level/position';
import { closingLength } from './world-transition';

export type Phase =
  | { readonly name: 'appearing'; readonly since: number }
  | { readonly name: 'playing' }
  | { readonly name: 'swinging-gate'; readonly since: number }
  | { readonly name: 'restoring'; readonly since: number; readonly origin: TilePosition; readonly restores: Area }
  | { readonly name: 'closing'; readonly since: number }
  | { readonly name: 'ended' };

export const playing: Phase = { name: 'playing' };

export const arrivalLength = 48;

export function appearing(frame: number): Phase {
  return { name: 'appearing', since: frame };
}

export const gateSwingLength = 16;

export function swingingGate(frame: number): Phase {
  return { name: 'swinging-gate', since: frame };
}

export function restoringKey(key: KeyCollected, frame: number): Phase {
  return { name: 'restoring', since: frame, origin: key.position, restores: key.restores };
}

export function closingLevel(frame: number): Phase {
  return { name: 'closing', since: frame };
}

interface FrameEnd {
  readonly frame: number;
  readonly restorationLength: (origin: TilePosition) => number;
}

export function phaseAfterFrame(phase: Phase, { frame, restorationLength }: FrameEnd): Phase {
  switch (phase.name) {
    // The phase is checked at the end of a frame, so leaving it after the last arrival frame lets the next frame play.
    case 'appearing':
      return frame - phase.since >= arrivalLength - 1 ? playing : phase;
    case 'playing':
      return phase;
    case 'swinging-gate':
      return frame - phase.since >= gateSwingLength - 1 ? playing : phase;
    case 'restoring':
      return frame - phase.since >= restorationLength(phase.origin) ? playing : phase;
    case 'closing':
      return frame - phase.since >= closingLength ? { name: 'ended' } : phase;
    case 'ended':
      return phase;
  }
}
