import { packedColor } from '../../graphics/picture';
import type { OrbHue } from '../../graphics/sprite-library';

const orbFloatFrames = 150;
const orbSwayFrames = 60;
// Seventy frames apart, up to eight orbs show different swirl frames and stand at different points of their float path.
export const orbPhaseSpacing = 70;
export const orbInset = 4;

// Rounding a sine holds each pixel longest near the turning points, so the orb eases up and down and side to side instead of jerking.
// The frame is reduced to its cycle first, because a sine that lands exactly on a half would otherwise round differently from cycle to cycle.
export function orbFloat(frame: number): { readonly x: number; readonly y: number } {
  return {
    x: Math.round(Math.sin((2 * Math.PI * (frame % orbSwayFrames)) / orbSwayFrames)),
    y: Math.round(2 * Math.sin((2 * Math.PI * (frame % orbFloatFrames)) / orbFloatFrames)),
  };
}

export interface OrbLook {
  readonly hue: OrbHue;
  readonly phase: number;
}

// Few specks keep the pop a light scatter rather than a cloud.
export const popSpecks = 8;
const popLength = 40;
// Specks start past the hero's shoulders, because she stands on the orb's tile and would hide them.
const popStart = 12;
const popTravel = 80;
// Two pixels square, because single pixels vanish in the busy dither of the color wave.
export const popSize = 2;
export const popColor = packedColor('Paper');

// Specks ease out to a stop and drop out one by one, so the pop fades instead of ending on a hard frame.
export function popSpeck(
  index: number,
  framesSinceStart: number,
): { readonly x: number; readonly y: number } | undefined {
  const lasts = popLength / 2 + ((index * 5) % (popLength / 2));
  if (framesSinceStart >= lasts) return undefined;
  const progress = framesSinceStart / popLength;
  const reach = popStart + popTravel * (1 - (1 - progress) * (1 - progress));
  const angle = (2 * Math.PI * (index + 0.5 * (index % 2))) / popSpecks;
  return { x: Math.round(Math.cos(angle) * reach), y: Math.round(Math.sin(angle) * reach) };
}
