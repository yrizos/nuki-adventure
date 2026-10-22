import type { Art } from '../../graphics/art';
import { birdArt, birdFrameLength } from '../../graphics/sprite-library';
import { tileSize } from '../world-geometry';
import { between, type Point } from '../point';
import { arc } from './movement';

type Facing = keyof typeof birdArt;
export type BirdHabit = 'perch' | 'ground' | 'sky';

export interface Bird {
  readonly habit: BirdHabit;
  readonly from: Point;
  readonly home: Point;
  readonly to: Point;
  // Open grass a ground bird may flee to.
  readonly spots: readonly Point[];
  readonly stay: number;
  readonly cycle: number;
  readonly phase: number;
}

// Where a visiting bird stands now. A painter keeps one per bird, because fleeing depends on where the hero has been.
export interface BirdVisit {
  round?: number;
  anchor?: Point;
  landed?: number;
  flight?:
    | {
        readonly from: Point;
        readonly to: Point;
        readonly start: number;
        readonly length: number;
        readonly leaving: boolean;
      }
    | undefined;
}

export interface BirdPlace {
  readonly x: number;
  readonly y: number;
  readonly art: Art;
}

const birdFlightSpeed = 1.5;
const shortestBirdFlight = 18;
const birdArc = 10;
const birdFleeArc = 6;
// Visits start and end this far up and to the side, about half a portrait view, so a bird flies in from the edge of the screen instead of appearing beside the hero.
export const birdApproach = { x: 160, y: 112 };
const birdSkyWave = 3;
const fleeDistance = 48;
export const fleeReach = 3 * tileSize;
const birdHopStride = 8;
const pecksPerStop = 2;
const hopsPerStride = 2;

const birdFlight = (from: Point, to: Point): number =>
  Math.max(shortestBirdFlight, Math.round(between(from, to) / birdFlightSpeed));
const heading = (from: Point, to: Point, otherwise: Facing): Facing =>
  to.x > from.x ? 'right' : to.x < from.x ? 'left' : otherwise;

// A ground bird pecks, hops a stride along, pecks, turns and hops back, so it stays within one stride of where it landed.
function strut(
  anchor: Point,
  facing: Facing,
  since: number,
): { readonly spot: Point; readonly animation: 'hop' | 'peck'; readonly facing: Facing; readonly time: number } {
  const peck = pecksPerStop * birdArt[facing].peck.length * birdFrameLength;
  const hop = hopsPerStride * birdArt[facing].hop.length * birdFrameLength;
  const time = since % (2 * (peck + hop));
  const out = time < peck + hop;
  const local = out ? time : time - peck - hop;
  const hopped = local < peck ? 0 : Math.round((birdHopStride * (local - peck)) / hop);
  const offset = out ? hopped : birdHopStride - hopped;
  const sign = facing === 'right' ? 1 : -1;
  return {
    spot: { x: anchor.x + sign * offset, y: anchor.y },
    animation: local < peck ? 'peck' : 'hop',
    facing: out ? facing : facing === 'right' ? 'left' : 'right',
    time: local < peck ? local : local - peck,
  };
}

export function birdPlace(bird: Bird, frame: number, hero: Point, visit: BirdVisit): BirdPlace | undefined {
  const clock = frame + bird.phase;
  const time = clock % bird.cycle;
  const side = heading(bird.from, bird.to, 'right');
  const pose = (animation: keyof (typeof birdArt)[Facing], facing: Facing, spot: Point, since = clock): BirdPlace => {
    const frames = birdArt[facing][animation];
    return { ...spot, art: frames[Math.floor(since / birdFrameLength) % frames.length]! };
  };
  if (bird.habit === 'sky') {
    const crossing = birdFlight(bird.from, bird.to);
    if (time >= crossing) return undefined;
    const progress = time / crossing;
    return pose('fly', side, {
      x: Math.round(bird.from.x + (bird.to.x - bird.from.x) * progress),
      y: Math.round(
        bird.from.y + (bird.to.y - bird.from.y) * progress + Math.sin(2 * Math.PI * 3 * progress) * birdSkyWave,
      ),
    });
  }
  const travel = birdFlight(bird.from, bird.home);
  const since = time - (bird.cycle - 2 * travel - bird.stay);
  if (since < 0) return undefined;
  if (since < travel) return pose('fly', side, arc(bird.from, bird.home, since / travel, birdArc));
  const round = Math.floor(clock / bird.cycle);
  if (visit.round !== round || frame < (visit.flight?.start ?? visit.landed ?? 0)) {
    visit.round = round;
    visit.anchor = bird.home;
    visit.landed = frame - since + travel;
    visit.flight = undefined;
  }
  const { flight } = visit;
  if (flight) {
    const into = frame - flight.start;
    if (into < flight.length)
      return pose(
        'fly',
        heading(flight.from, flight.to, side),
        arc(flight.from, flight.to, into / flight.length, birdFleeArc),
      );
    if (flight.leaving) return undefined;
    visit.anchor = flight.to;
    visit.landed = flight.start + flight.length;
    visit.flight = undefined;
  }
  const standing = (at: number) =>
    bird.habit === 'perch'
      ? { spot: visit.anchor!, animation: 'perch' as const, facing: side, time: clock }
      : strut(visit.anchor!, side, at - visit.landed!);
  const departure = Math.max(frame - since + travel + bird.stay, visit.landed!);
  if (frame < departure) {
    const now = standing(frame);
    if (bird.habit === 'ground' && between(now.spot, hero) < fleeDistance) {
      const refuge = bird.spots
        .filter((spot) => between(spot, hero) >= fleeDistance && between(spot, now.spot) <= fleeReach)
        .reduce<Point | undefined>(
          (best, spot) => (!best || between(spot, hero) > between(best, hero) ? spot : best),
          undefined,
        );
      const away = now.spot.x >= hero.x ? 1 : -1;
      const to = refuge ?? { x: now.spot.x + away * birdApproach.x, y: now.spot.y - birdApproach.y };
      visit.flight = { from: now.spot, to, start: frame, length: birdFlight(now.spot, to), leaving: !refuge };
      return pose('fly', heading(now.spot, to, side), now.spot);
    }
    return pose(now.animation, now.facing, now.spot, now.time);
  }
  const from = standing(departure).spot;
  const to = { x: from.x + bird.to.x - bird.home.x, y: from.y + bird.to.y - bird.home.y };
  const into = frame - departure;
  return into < travel ? pose('fly', side, arc(from, to, into / travel, birdArc)) : undefined;
}
