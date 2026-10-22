import type { Butterfly } from '../dressing/world-dressing';
import { arc } from './movement';

const butterflyArc = 6;
const butterflyFlutter = 2;
const butterflyFlutterBeats = 3;
// A resting butterfly still opens and closes its wings, only more slowly, so it never looks frozen.
export const butterflyRestingBeat = 5;

export function butterflyPlace(
  butterfly: Butterfly,
  frame: number,
): { readonly x: number; readonly y: number; readonly flying: boolean } {
  let time = (frame + butterfly.phase) % butterfly.cycle;
  for (const leg of butterfly.legs) {
    if (time < leg.rest) return { x: leg.from.x, y: leg.from.y, flying: false };
    time -= leg.rest;
    if (time < leg.flight) {
      const progress = time / leg.flight;
      const flutter = Math.sin(2 * Math.PI * butterflyFlutterBeats * progress) * butterflyFlutter;
      return { ...arc(leg.from, leg.to, progress, butterflyArc, flutter), flying: true };
    }
    time -= leg.flight;
  }
  const first = butterfly.legs[0]!.from;
  return { x: first.x, y: first.y, flying: false };
}
