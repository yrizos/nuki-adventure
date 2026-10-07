import type { Area, OrbColor } from '../domain/level/collectibles';
import type { OrbCollected } from '../domain/level/level-events';
import type { TilePosition } from '../domain/level/position';
import type { Playthrough } from '../domain/progress/playthrough';
import { closingLength } from './world-transition';

export const holdFrames = 30;

export type Phase =
  | { readonly name: 'playing' }
  | {
      readonly name: 'holding';
      readonly until: number;
      readonly origin: TilePosition;
      readonly color: OrbColor;
      readonly restores: Area;
    }
  | { readonly name: 'restoring'; readonly since: number; readonly origin: TilePosition; readonly restores: Area }
  | { readonly name: 'closing'; readonly since: number; readonly playthrough: Playthrough }
  | { readonly name: 'ended' };

export const playing: Phase = { name: 'playing' };

export function holdingOrb(orb: OrbCollected, frame: number): Phase {
  return { name: 'holding', until: frame + holdFrames, origin: orb.position, color: orb.color, restores: orb.restores };
}

export function closingLevel(playthrough: Playthrough, frame: number): Phase {
  return { name: 'closing', since: frame, playthrough };
}

interface FrameEnd {
  readonly frame: number;
  readonly restorationLength: (origin: TilePosition) => number;
  readonly continuing: boolean;
}

export function phaseAfterFrame(phase: Phase, { frame, restorationLength, continuing }: FrameEnd): Phase {
  switch (phase.name) {
    case 'playing':
      return phase;
    case 'holding':
      return frame >= phase.until
        ? { name: 'restoring', since: frame, origin: phase.origin, restores: phase.restores }
        : phase;
    case 'restoring':
      return frame - phase.since >= restorationLength(phase.origin) ? playing : phase;
    case 'closing':
      return frame - phase.since >= closingLength ? { name: 'ended' } : phase;
    case 'ended':
      return continuing ? playing : phase;
  }
}
