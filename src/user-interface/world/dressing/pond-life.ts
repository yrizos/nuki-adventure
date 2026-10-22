import { Ground, type Scenery, TilePosition } from '../../../level';
import type { Art } from '../../graphics/art';
import { waterLilyVariants } from '../../graphics/sprite-library';
import { between, type Point } from '../point';
import { tileSize } from '../world-geometry';
import { propVariants } from './prop-variants';

export interface WaterLily {
  readonly x: number;
  readonly y: number;
  readonly art: Art;
}

const lilyDrift = 4;
const secondGroupArea = 12;

export interface Lilies {
  readonly lilies: readonly WaterLily[];
  readonly ponds: readonly (readonly number[])[];
}

// Pads sit on the half-offset ground grid, where four water corners mean a tile with no shore foam at all.
export function waterLilies(scenery: Scenery, random: () => number): Lilies {
  const { columns, rows } = scenery.size;
  const isWater = (column: number, row: number): boolean =>
    scenery.groundAt(TilePosition.at(column, row)).equals(Ground.Water);
  const open = new Set<number>();
  for (let row = 1; row < rows; row++)
    for (let column = 1; column < columns; column++)
      if (isWater(column - 1, row - 1) && isWater(column, row - 1) && isWater(column - 1, row) && isWater(column, row))
        open.add(row * columns + column);
  // Column 0 is never open, so stepping one key across a row edge can never land on an open tile.
  const neighbors = (key: number): number[] =>
    [key - 1, key + 1, key - columns, key + columns].filter((next) => open.has(next));
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
  const between = (low: number, high: number): number => low + Math.floor(random() * (high - low + 1));
  const chosen: number[] = [];
  const ponds: number[][] = [];
  const seen = new Set<number>();
  for (const start of open) {
    if (seen.has(start)) continue;
    seen.add(start);
    const pond = [start];
    for (let index = 0; index < pond.length; index++)
      for (const next of neighbors(pond[index]!))
        if (!seen.has(next)) {
          seen.add(next);
          pond.push(next);
        }
    const taken = new Set<number>();
    const grow = (seed: number, size: number): void => {
      taken.add(seed);
      const group = [seed];
      while (group.length < size) {
        const frontier = group.flatMap(neighbors).filter((next) => !taken.has(next));
        if (frontier.length === 0) break;
        const next = pick(frontier);
        taken.add(next);
        group.push(next);
      }
      chosen.push(...group);
    };
    const firstPad = chosen.length;
    grow(pick(pond), between(3, 5));
    if (pond.length >= secondGroupArea) {
      const apart = pond.filter((key) => !taken.has(key) && neighbors(key).every((next) => !taken.has(next)));
      if (apart.length > 0) grow(pick(apart), between(2, 3));
    }
    ponds.push(Array.from({ length: chosen.length - firstPad }, (_, index) => firstPad + index));
  }
  const positions = chosen.map((key) => TilePosition.at(key % columns, Math.floor(key / columns)));
  const drift = (): number => Math.round((random() * 2 - 1) * lilyDrift);
  const choices = propVariants(
    positions.map((position) => [position]),
    waterLilyVariants.length,
  );
  const lilies = positions.map((position, index) => ({
    x: position.column * tileSize - tileSize / 2 + drift(),
    y: position.row * tileSize - tileSize / 2 + drift(),
    art: waterLilyVariants[choices[index]!]!,
  }));
  return { lilies, ponds };
}

export interface FrogLeg {
  readonly from: Point;
  readonly to: Point;
  readonly facing: 'left' | 'right';
  readonly rest: number;
  readonly croaks: boolean;
  readonly dive: boolean;
}

export interface Frog {
  readonly legs: readonly FrogLeg[];
  readonly cycle: number;
  readonly phase: number;
}

export const frogLeapLength = 24;
export const frogDiveLength = 120;
const mostFrogsPerPond = 2;
const frogLegs = 6;
const shortestFrogRest = 300;
const frogRestSpread = 480;
// A leap only spans neighboring pads, so a frog reaches a distant clump by swimming under water instead.
const frogLeapReach = tileSize * 2;
const frogLeapChance = 0.6;
const frogCroakChance = 0.5;

// Each frog keeps its own share of the pond's pads, so two frogs never land on the same pad.
export function frogs({ lilies, ponds }: Lilies, random: () => number): Frog[] {
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
  const center = ({ x, y }: WaterLily): Point => ({ x: x + tileSize / 2, y: y + tileSize / 2 });
  return ponds.flatMap((pond) => {
    const count = Math.min(pond.length, Math.floor(random() * (mostFrogsPerPond + 1)));
    return Array.from({ length: count }, (_, frog) => {
      const pads = pond.filter((_, index) => index % count === frog).map((index) => center(lilies[index]!));
      const legs: FrogLeg[] = [];
      let at = pads[0]!;
      let facing: FrogLeg['facing'] = random() < 0.5 ? 'left' : 'right';
      for (let leg = 0; leg < frogLegs; leg++) {
        const near = pads.filter((pad) => pad !== at && between(pad, at) <= frogLeapReach);
        // The last leg ends where the first began, so the cycle repeats without a jump.
        const home = leg === frogLegs - 1;
        const leaps = home ? near.includes(pads[0]!) : near.length > 0 && random() < frogLeapChance;
        const to = home ? pads[0]! : leaps ? pick(near) : pick(pads);
        const rest = shortestFrogRest + Math.floor(random() * frogRestSpread);
        legs.push({ from: at, to, facing, rest, croaks: random() < frogCroakChance, dive: !leaps });
        if (to.x !== at.x) facing = to.x < at.x ? 'left' : 'right';
        at = to;
      }
      const cycle = legs.reduce((sum, leg) => sum + leg.rest + (leg.dive ? frogDiveLength : frogLeapLength), 0);
      return { legs, cycle, phase: Math.floor(random() * cycle) };
    });
  });
}
