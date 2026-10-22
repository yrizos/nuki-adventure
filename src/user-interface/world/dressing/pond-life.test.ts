import { describe, expect, test } from 'vitest';
import { levelView } from '../../../level/application/level-view';
import { Orb } from '../../../level/domain/collectibles';
import { Door } from '../../../level/domain/door';
import { Level } from '../../../level/domain/level';
import { LevelId } from '../../../level/domain/level-id';
import { Direction, TilePosition } from '../../../level/domain/position';
import { FlowerVariant, Ground, LevelSize, Scenery } from '../../../level/domain/scenery';
import { check2dObstacles } from '../../../level/infrastructure/check2d-obstacles';
import { waterLilyVariants } from '../../graphics/sprite-library';
import { tileSize } from '../world-geometry';
import { dressWorld } from './world-dressing';
import { frogDiveLength, frogLeapLength, frogs, waterLilies } from './pond-life';

const seeded = (seed: number) => (): number => (seed = (seed * 16807) % 2147483647) / 2147483647;
const land = (water: (row: number) => boolean): Scenery =>
  Scenery.of(
    LevelSize.of(12, 12),
    Array.from({ length: 12 }, (_, row) =>
      Array.from({ length: 12 }, () => (water(row) ? Ground.Water : Ground.Grass)),
    ),
    [],
    [],
    [],
    FlowerVariant.All,
  );
const pond = land((row) => row >= 4);
const dry = land(() => false);

describe('water lilies', () => {
  test('dry land has no pads and no ponds', () => {
    expect(waterLilies(dry, seeded(1))).toEqual({ lilies: [], ponds: [] });
  });

  test('a pond gets pads of the available art', () => {
    const { lilies } = waterLilies(pond, seeded(1));
    expect(lilies.length).toBeGreaterThanOrEqual(3);
    for (const { art } of lilies) expect(waterLilyVariants).toContain(art);
  });

  test('each pond lists its own pads and every pad belongs to exactly one pond', () => {
    const { lilies, ponds } = waterLilies(pond, seeded(2));
    expect(ponds.flat().sort((first, second) => first - second)).toEqual(lilies.map((_, index) => index));
  });

  test('a pond gets a group of three to five pads and a second small group only when it is big enough', () => {
    const { ponds } = waterLilies(pond, seeded(3));
    for (const pads of ponds) {
      expect(pads.length).toBeGreaterThanOrEqual(3);
      expect(pads.length).toBeLessThanOrEqual(8);
    }
    const small = land((row) => row === 5 || row === 6);
    for (const pads of waterLilies(small, seeded(3)).ponds) expect(pads.length).toBeLessThanOrEqual(5);
  });

  test('the same seed gives the same pads', () => {
    expect(waterLilies(pond, seeded(4))).toEqual(waterLilies(pond, seeded(4)));
  });
});

describe('frogs', () => {
  const lakes = Array.from({ length: 30 }, (_, seed) => {
    const random = seeded(seed + 1);
    const water = waterLilies(pond, random);
    return { water, found: frogs(water, random) };
  });

  test('dry land has no frogs', () => {
    expect(frogs({ lilies: [], ponds: [] }, seeded(1))).toEqual([]);
  });

  test('each frog makes six legs that chain together and end where the first began', () => {
    for (const { found } of lakes)
      for (const { legs } of found) {
        expect(legs).toHaveLength(6);
        legs.forEach((leg, index) => expect(legs[(index + 1) % legs.length]!.from).toBe(leg.to));
      }
  });

  test('a cycle adds up each rest and its leap or dive, and the phase falls inside it', () => {
    for (const { found } of lakes)
      for (const { legs, cycle, phase } of found) {
        expect(cycle).toBe(legs.reduce((sum, leg) => sum + leg.rest + (leg.dive ? frogDiveLength : frogLeapLength), 0));
        expect(phase).toBeGreaterThanOrEqual(0);
        expect(phase).toBeLessThan(cycle);
      }
  });
});

describe('a dressed pond', () => {
  const level = levelView(
    Level.create({
      id: LevelId.of('pond'),
      scenery: land((row) => row >= 4),
      stones: [],
      orbs: [Orb.at(TilePosition.at(0, 0), 4, LevelSize.of(12, 12))],
      door: Door.closedAt(TilePosition.at(9, 0)),
      hero: { position: TilePosition.at(2, 2), facing: Direction.Down },
      obstacles: check2dObstacles,
    }),
  );
  const ponds = Array.from({ length: 40 }, (_, seed) => dressWorld(level, seeded(seed + 1)));

  test('gets no frog, one frog or two frogs at random', () => {
    expect(new Set(ponds.map(({ frogs }) => frogs.length))).toEqual(new Set([0, 1, 2]));
  });

  test('has frogs that rest only on lily pads of their own, leap only to near pads and end each cycle where they began', () => {
    for (const { lilies, frogs } of ponds) {
      const pads = lilies.map(({ x, y }) => `${x + tileSize / 2},${y + tileSize / 2}`);
      const owned = frogs.map((frog) => new Set(frog.legs.map(({ from }) => `${from.x},${from.y}`)));
      for (const [index, frog] of frogs.entries()) {
        for (const pad of owned[index]!) expect(pads).toContain(pad);
        for (const other of owned.slice(index + 1)) for (const pad of other) expect(owned[index]!.has(pad)).toBe(false);
        frog.legs.forEach((leg, step) => {
          expect(frog.legs[(step + 1) % frog.legs.length]!.from).toBe(leg.to);
          if (!leg.dive)
            expect(Math.hypot(leg.to.x - leg.from.x, leg.to.y - leg.from.y)).toBeLessThanOrEqual(2 * tileSize);
        });
      }
    }
  });
});
