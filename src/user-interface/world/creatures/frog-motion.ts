import type { Art } from '../../graphics/art';
import { frogArt, frogFrameLength, frogRipple } from '../../graphics/sprite-library';
import { type Frog, frogDiveLength, frogLeapLength } from '../dressing/pond-life';
import { arc } from './movement';

const frogLeapArc = 6;
// A frog blinks for one beat out of this many frames, so its resting pose reads as alive without flickering.
const frogBlinkEvery = 150;
const frogCroakPuffs = 2;
const frogCroakLength = frogArt.right.croak.length * frogFrameLength * frogCroakPuffs;
const frogRippleLength = frogRipple.length * frogFrameLength;

export interface FrogPlace {
  readonly x: number;
  readonly y: number;
  readonly art: Art;
}

const frogFrame = (art: readonly Art[], since: number): Art => art[Math.floor(since / frogFrameLength) % art.length]!;

// A diving frog leaves a ripple where it goes under and another where it comes up, and is hidden in between.
export function frogPlace(frog: Frog, frame: number): FrogPlace | undefined {
  let time = (frame + frog.phase) % frog.cycle;
  for (const leg of frog.legs) {
    if (time < leg.rest) {
      const croakStart = Math.floor(leg.rest / 2);
      const croaking = leg.croaks && time >= croakStart && time < croakStart + frogCroakLength;
      const art = croaking
        ? frogFrame(frogArt[leg.facing].croak, time - croakStart)
        : time % frogBlinkEvery < frogFrameLength
          ? frogArt[leg.facing].sit.at(-1)!
          : frogArt[leg.facing].sit[0]!;
      return { ...leg.from, art };
    }
    time -= leg.rest;
    const facing = leg.to.x === leg.from.x ? leg.facing : leg.to.x < leg.from.x ? 'left' : 'right';
    if (!leg.dive && time < frogLeapLength) {
      const place = arc(leg.from, leg.to, time / frogLeapLength, frogLeapArc);
      const leap = frogArt[facing].leap;
      return { ...place, art: leap[Math.floor((time / frogLeapLength) * leap.length)]! };
    }
    if (leg.dive && time < frogDiveLength) {
      if (time < frogRippleLength) return { ...leg.from, art: frogFrame(frogRipple, time) };
      const surfacing = time - (frogDiveLength - frogRippleLength);
      return surfacing < 0 ? undefined : { ...leg.to, art: frogFrame(frogRipple, surfacing) };
    }
    time -= leg.dive ? frogDiveLength : frogLeapLength;
  }
  return undefined;
}
