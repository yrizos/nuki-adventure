/// <reference types="node" />
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { levelView } from '../../../level/application/level-view';
import { Area, Orb } from '../../../level/domain/collectibles';
import { Direction, Heading, TilePosition, WorldPosition } from '../../../level/domain/position';
import { Door } from '../../../level/domain/door';
import { HeroState } from '../../../level/domain/hero';
import { LevelId } from '../../../level/domain/level-id';
import { Level, Stone } from '../../../level/domain/level';
import { Flower, FlowerVariant, Ground, LevelSize, Scenery, Tree, TreeVariant } from '../../../level/domain/scenery';
import { check2dObstacles } from '../../../level/infrastructure/check2d-obstacles';
import { firstLevel } from '../../../level/content/first';
import { levelFromLayout } from '../../../level/content/level-layout';
import { secondLevel } from '../../../level/content/second';
import { thirdLevel } from '../../../level/content/third';
import { fourthLevel } from '../../../level/content/fourth';
import { fifthLevel } from '../../../level/content/fifth';
import { sixthLevel } from '../../../level/content/sixth';
import { pixelDifference } from '../../testing/pictures';
import { png } from '../../testing/png';
import { settleGate } from '../../../level/testing/walk-level';
import type { Art } from '../../graphics/art';
import * as library from '../../graphics/sprite-library';
import { faded, lighter, palette, type PaletteCode } from '../../graphics/palette';
import { lighten, Picture, sprite } from '../../graphics/picture';
import { cameraPosition, heroPixels, tileSize } from '../world-geometry';
import { arrivalMotes, risingEdge } from '../transition/arrival';
import { dressWorld } from '../dressing/world-dressing';
import { propVariants } from '../dressing/prop-variants';
import { orbFloat } from '../creatures/orb-motion';
import { renderingLevel } from '../../testing/rendering-level';
import { WorldPainter } from './world-painter';
import { closingLength, crestLength, restorationAge, restorationLength } from '../transition/world-transition';

const scenery = {
  grassArt: library.grassArt,
  pathArt: library.pathArt,
  waterArt: library.waterArt,
  terrainArt: library.terrainArt,
  treeArt: library.treeArt,
  fruitTreeArt: library.fruitTreeArt,
  flowerArt: library.flowerArt,
  fenceArt: library.fenceArt,
  doorArt: library.doorArt,
  waterLilyVariants: library.waterLilyVariants,
};
const sprites = {
  heroArt: library.heroArt,
  orbArt: Object.fromEntries(library.orbHues.map((hue) => [hue, library.orbFrames[hue][0]!])) as Record<
    (typeof library.orbHues)[number],
    Art
  >,
  stoneVariants: library.stoneVariants,
  mossyStoneVariants: library.mossyStoneVariants,
  lightMote: library.lightMote,
  groundShadow: library.groundShadow,
};

const area = (keep: (position: TilePosition) => boolean): Area =>
  Area.of(Array.from({ length: 1600 }, (_, index) => TilePosition.at(index % 40, Math.floor(index / 40))).filter(keep));
const everywhere = area(() => true);
const leftHalf = area((position) => position.column < 6);
const rightHalf = area((position) => position.column >= 6);

function allArt(value: unknown): Art[] {
  if (value && typeof value === 'object' && 'rows' in value && 'legend' in value) return [value as Art];
  if (value && typeof value === 'object') return Object.values(value).flatMap(allArt);
  return [];
}

function colorAt(picture: Picture, column: number, row: number): string {
  const offset = (row * picture.width + column) * 4;
  return `#${[...picture.pixels.subarray(offset, offset + 3)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

const paletteCodes = Object.keys(palette) as PaletteCode[];

function packedOf(code: PaletteCode): number {
  const swatch = new Picture(1, 1);
  swatch.fill(code);
  return swatch.packedPixels[0]!;
}

const codeOfPacked = new Map(paletteCodes.map((code) => [packedOf(code), code]));

function firstArrival(worldX: number, worldY: number, origin: TilePosition): number {
  let frame = 0;
  while (restorationAge(worldX, worldY, origin, frame) < 0) frame++;
  return frame;
}

async function checksum(picture: Picture): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', picture.pixels.slice());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// A hash alone cannot show what changed, so a mismatch leaves the actual frame behind for inspection.
async function expectChecksum(picture: Picture, expected: string): Promise<void> {
  const actual = await checksum(picture);
  if (actual === expected) return;
  const directory = new URL('../../../test-output/', import.meta.url);
  const name = `${(expect.getState().currentTestName ?? 'frame').replace(/[^a-z0-9]+/gi, '-')}.png`;
  mkdirSync(directory, { recursive: true });
  const file = new URL(name, directory);
  writeFileSync(file, png(picture));
  expect(actual, `actual frame written to ${decodeURIComponent(file.pathname)}`).toBe(expected);
}

describe('whole frames of the first level', () => {
  const level = firstLevel(
    (positions) => positions,
    check2dObstacles,
    () => 0,
  );
  const scene = { level, frame: 0, hero: sprites.heroArt.down.stand };
  const painter = new WorldPainter(level);
  const picture = new Picture(224, 320);

  test('renders the current fully faded fixture unchanged', async () => {
    painter.paint(picture, scene, []);
    await expectChecksum(picture, 'f5640570bd612d066eb89ab62d21448f55d69d4a40284a16454ccd4cd95d1553');
  });

  test('renders the current partially restored fixture unchanged', async () => {
    // Starting the wave at the hero leaves its front inside the frame.
    painter.paintRestoring(picture, scene, level.hero.position, 20, [], [everywhere]);
    await expectChecksum(picture, '3cdee6dafd153b5377ad010a66dcb57bed57cc80a4e97fc25ed350b0da65af88');
  });

  test('renders the current fully colored fixture unchanged', async () => {
    painter.paint(picture, scene, [everywhere]);
    await expectChecksum(picture, '0ae81883531ff09af00cac59afe0dae80d2f25bdfaecd45a4d036ffff5188a0f');
  });
});

test.each([
  { name: 'first', create: firstLevel },
  { name: 'second', create: secondLevel },
  { name: 'third', create: thirdLevel },
  { name: 'fourth', create: fourthLevel },
  { name: 'fifth', create: fifthLevel },
  { name: 'sixth', create: sixthLevel },
])('the $name level has ground art for every place where terrains meet and paints', ({ create }) => {
  const level = levelView(
    create(
      (positions) => positions,
      check2dObstacles,
      () => 0,
    ),
  );
  expect(() =>
    new WorldPainter(level).paint(new Picture(224, 448), { level, frame: 0, hero: sprites.heroArt.up.stand }, []),
  ).not.toThrow();
});

test('native terrain grids cover all 81 three-terrain corner combinations', () => {
  for (const art of allArt(scenery)) {
    const size = art.legend.t === 'E1' ? 64 : Object.values(scenery.doorArt).includes(art) ? 96 : 32;
    expect(sprite(art).width).toBe(size);
    expect(sprite(art).height).toBe(size);
    expect(Object.values(art.legend)).not.toContain('Ink');
  }
  for (const topLeft of [Ground.Grass, Ground.Path, Ground.Water]) {
    for (const topRight of [Ground.Grass, Ground.Path, Ground.Water]) {
      for (const bottomLeft of [Ground.Grass, Ground.Path, Ground.Water]) {
        for (const bottomRight of [Ground.Grass, Ground.Path, Ground.Water]) {
          const ground = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => Ground.Grass));
          ground[1]![1] = topLeft;
          ground[1]![2] = topRight;
          ground[2]![1] = bottomLeft;
          ground[2]![2] = bottomRight;
          const level = Level.create({
            id: LevelId.of('terrain'),
            scenery: Scenery.of(LevelSize.of(4, 4), ground, [], []),
            stones: [],
            orbs: [Orb.at(TilePosition.at(3, 3), 4, LevelSize.of(4, 4))],
            door: Door.closedAt(TilePosition.at(0, 0)),
            hero: { position: TilePosition.at(0, 3), facing: Direction.Down },
            obstacles: check2dObstacles,
          });
          expect(() => new WorldPainter(level)).not.toThrow();
        }
      }
    }
  }
});

test('native interactive sprites use their documented dimensions', () => {
  for (const art of allArt(sprites.heroArt)) {
    expect(sprite(art).width).toBe(32);
    expect(sprite(art).height).toBe(32);
  }
  for (const art of [...sprites.stoneVariants, ...sprites.mossyStoneVariants])
    expect([sprite(art).width, sprite(art).height]).toEqual([32, 32]);
  expect([sprite(sprites.lightMote).width, sprite(sprites.lightMote).height]).toEqual([1, 1]);
});

test('interactive sprites keep a closed one-pixel Ink silhouette', () => {
  const art: readonly Art[] = [
    ...[sprites.heroArt.down, sprites.heroArt.up, sprites.heroArt.left, sprites.heroArt.right].flatMap((direction) => [
      direction.stand,
      direction.breathe,
      ...direction.walk,
    ]),
    ...sprites.stoneVariants,
    ...sprites.mossyStoneVariants,
  ];
  for (const piece of art) {
    piece.rows.forEach((row, vertical) =>
      [...row].forEach((symbol, horizontal) => {
        if (symbol === '.') return;
        const boundary = [
          [horizontal - 1, vertical],
          [horizontal + 1, vertical],
          [horizontal, vertical - 1],
          [horizontal, vertical + 1],
        ].some(([column, line]) => (piece.rows[line!]?.[column!] ?? '.') === '.');
        if (boundary) expect(piece.legend[symbol]).toBe('Ink');
      }),
    );
  }
});

test('ground variants keep equal detail density within the allowed twenty percent', () => {
  for (const [variants, base] of [
    [scenery.grassArt, 'g'],
    [scenery.pathArt, 'p'],
    [scenery.waterArt.map((frames) => frames[0]!), 'w'],
  ] as const) {
    const counts = variants.map((art) => art.rows.join('').replaceAll(base, '').length);
    expect(new Set(counts).size).toBe(1);
    expect(counts[0]).toBeLessThanOrEqual(32 * 32 * 0.2);
    if (base === 'g') expect(counts[0]).toBeGreaterThanOrEqual(32 * 32 * 0.1);
    for (const art of variants) {
      expect(art.rows[0]).toBe(base.repeat(32));
      expect(art.rows[31]).toBe(base.repeat(32));
      expect(art.rows.every((row) => row[0] === base && row[31] === base)).toBe(true);
    }
  }
});

function flowerArtDrawn(level: Level, frame: number): Art[] {
  const picture = new Picture(level.scenery.size.columns * tileSize, level.scenery.size.rows * tileSize);
  const camera = cameraPosition(level, picture.width, picture.height);
  const draw = vi.spyOn(picture, 'draw');
  new WorldPainter(level).paint(picture, { level, frame, hero: sprites.heroArt.down.stand }, [everywhere]);
  const flowerFrames = scenery.flowerArt.flat();
  const calls = draw.mock.calls.filter(([art]) => flowerFrames.includes(art));
  expect(calls).toHaveLength(level.scenery.flowers.length);
  return level.scenery.flowers.map(({ position }) => {
    const atPosition = calls.filter(
      ([, column, row]) =>
        column === position.column * tileSize - camera.x && row === position.row * tileSize - camera.y,
    );
    expect(atPosition).toHaveLength(1);
    return atPosition[0]![0];
  });
}

test('all first-level flowers render exactly the two allowed variants in both sway frames', () => {
  const level = firstLevel(
    (positions) => positions,
    check2dObstacles,
    () => 0,
  );
  expect(level.scenery.flowers).toHaveLength(27);
  const first = flowerArtDrawn(level, 0);
  const second = flowerArtDrawn(level, library.flowerFrameLength);
  const allowed = [scenery.flowerArt[0]!, scenery.flowerArt[1]!];
  expect(new Set([...first, ...second])).toEqual(new Set(allowed.flat()));
  first.forEach((art, index) => {
    const frames = allowed.find((variant) => variant.includes(art));
    expect(frames).toBeDefined();
    expect(new Set([art, second[index]!])).toEqual(new Set(frames));
  });
});

test.each([0, library.flowerFrameLength])('touching first-level flowers never share a variant at frame %i', (frame) => {
  const level = firstLevel(
    (positions) => positions,
    check2dObstacles,
    () => 0,
  );
  const drawn = flowerArtDrawn(level, frame);
  const variants = drawn.map((art) => scenery.flowerArt.findIndex((frames) => frames.includes(art)));
  let touchingPairs = 0;
  level.scenery.flowers.forEach(({ position }, first) => {
    for (let second = first + 1; second < level.scenery.flowers.length; second++) {
      const neighbor = level.scenery.flowers[second]!.position;
      if (Math.abs(position.column - neighbor.column) + Math.abs(position.row - neighbor.row) !== 1) continue;
      touchingPairs++;
      expect(variants[first]).not.toBe(variants[second]);
    }
  });
  expect(touchingPairs).toBeGreaterThan(0);
});

test('flower choices use the allowed count and map a non-prefix selection to sprite indices 9 and 7', () => {
  const flowers = [TilePosition.at(1, 1), TilePosition.at(2, 1), TilePosition.at(1, 2), TilePosition.at(2, 2)].map(
    Flower.at,
  );
  const level = renderingLevel(Ground.Grass, TilePosition.at(2, 2), [], [], flowers, [
    FlowerVariant.Violet,
    FlowerVariant.Coral,
  ]);
  const choices = propVariants(
    flowers.map(({ position }) => [position]),
    2,
  );
  expect(new Set(choices)).toEqual(new Set([0, 1]));
  const first = flowerArtDrawn(level, 0);
  const second = flowerArtDrawn(level, library.flowerFrameLength);
  choices.forEach((choice, index) => {
    expect(new Set([first[index]!, second[index]!])).toEqual(new Set(scenery.flowerArt[[9, 7][choice]!]));
  });
});

function firstLevelStoneArtDrawn(): { position: TilePosition; art: Art }[] {
  const level = firstLevel(
    (positions) => positions,
    check2dObstacles,
    () => 0,
  );
  const picture = new Picture(level.scenery.size.columns * tileSize, level.scenery.size.rows * tileSize);
  const camera = cameraPosition(level, picture.width, picture.height);
  const draw = vi.spyOn(picture, 'draw');
  new WorldPainter(level).paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand }, [everywhere]);
  return level.stones.map(({ position }) => {
    const calls = draw.mock.calls.filter(
      ([art, column, row]) =>
        [...sprites.stoneVariants, ...sprites.mossyStoneVariants].includes(art) &&
        column === position.column * tileSize - camera.x &&
        row === position.row * tileSize - camera.y,
    );
    expect(calls).toHaveLength(1);
    return { position, art: calls[0]![0] };
  });
}

test.each([firstLevel, secondLevel, thirdLevel, fourthLevel, fifthLevel, sixthLevel])(
  'level %# floats lilies in groups inside its pond, with different art on touching tiles',
  (create) => {
    const level = create(
      (positions) => positions,
      check2dObstacles,
      () => 0,
    );
    const picture = new Picture(level.scenery.size.columns * tileSize, level.scenery.size.rows * tileSize);
    const camera = cameraPosition(level, picture.width, picture.height);
    const draw = vi.spyOn(picture, 'draw');
    let seed = 7;
    const random = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647;
    new WorldPainter(level, random).paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand }, [everywhere]);
    const water = (column: number, row: number): boolean =>
      level.scenery.groundAt(TilePosition.at(column, row)).equals(Ground.Water);
    const lilies = draw.mock.calls
      .filter(([art]) => library.waterLilyVariants.includes(art))
      .map(([art, x, y]) => ({
        art,
        column: Math.round((x + camera.x + tileSize / 2) / tileSize),
        row: Math.round((y + camera.y + tileSize / 2) / tileSize),
      }));
    expect(lilies.length).toBeGreaterThan(0);
    for (const { column, row } of lilies)
      for (const [dx, dy] of [
        [-1, -1],
        [0, -1],
        [-1, 0],
        [0, 0],
      ])
        expect(water(column + dx!, row + dy!)).toBe(true);
    for (const first of lilies)
      for (const second of lilies)
        if (Math.abs(first.column - second.column) + Math.abs(first.row - second.row) === 1)
          expect(first.art).not.toBe(second.art);
    const open = (column: number, row: number): boolean =>
      water(column - 1, row - 1) && water(column, row - 1) && water(column - 1, row) && water(column, row);
    const sides = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const;
    for (const { column, row } of lilies)
      if (sides.some(([dx, dy]) => open(column + dx, row + dy)))
        expect(
          sides.some(([dx, dy]) => lilies.some((other) => other.column === column + dx && other.row === row + dy)),
        ).toBe(true);
  },
);

test('the first level renders at least three distinct stone variants', () => {
  const drawn = firstLevelStoneArtDrawn();
  expect(new Set(drawn.map(({ art }) => art)).size).toBeGreaterThanOrEqual(3);
});

test('the first level renders different stone art for each touching neighbor', () => {
  const drawn = firstLevelStoneArtDrawn();
  let touchingPairs = 0;
  for (let first = 0; first < drawn.length; first++) {
    for (let second = first + 1; second < drawn.length; second++) {
      const left = drawn[first]!;
      const right = drawn[second]!;
      if (
        Math.abs(left.position.column - right.position.column) + Math.abs(left.position.row - right.position.row) !==
        1
      )
        continue;
      touchingPairs++;
      expect(left.art).not.toBe(right.art);
    }
  }
  expect(touchingPairs).toBe(2);
});

test('stones within two tiles of water are mossy and stones further away are plain', () => {
  const ground = Array.from({ length: 12 }, () =>
    Array.from({ length: 12 }, (_, column) => (column === 0 ? Ground.Water : Ground.Grass)),
  );
  const level = Level.create({
    id: LevelId.of('moss'),
    scenery: Scenery.of(LevelSize.of(12, 12), ground, [], []),
    stones: [Stone.at(TilePosition.at(2, 5)), Stone.at(TilePosition.at(3, 8))],
    orbs: [Orb.at(TilePosition.at(9, 9), 4, LevelSize.of(12, 12))],
    door: Door.closedAt(TilePosition.at(9, 0)),
    hero: { position: TilePosition.at(6, 2), facing: Direction.Down },
    obstacles: check2dObstacles,
  });
  const [near, far] = dressWorld(levelView(level)).stones;
  expect(sprites.mossyStoneVariants).toContain(near);
  expect(sprites.stoneVariants).toContain(far);
});

test.each([
  [Ground.Grass, 'G1', 'N2'],
  [Ground.Path, 'E2', 'N3'],
] as const)('contact shadows on %s use the surface shade in both world versions', (ground, colored, neutral) => {
  const level = renderingLevel(ground, TilePosition.at(2, 2), [Stone.at(TilePosition.at(4, 4))]);
  const painter = new WorldPainter(level);
  for (const [restored, code] of [
    [[everywhere], colored],
    [[], neutral],
  ] as const) {
    const picture = new Picture(384, 384);
    painter.paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand }, restored);
    expect(colorAt(picture, 73, 160)).toBe(palette[code]);
    expect(colorAt(picture, 137, 219)).toBe(palette[code]);
  }
  const shadow = sprites.groundShadow(14, colored);
  expect(shadow.rows.map((row) => row.replaceAll('.', '').length)).toEqual([14, 10, 10, 10, 6]);
});

test('an orb keeps its color in a faded world', () => {
  const level = renderingLevel();
  const picture = new Picture(384, 384);
  new WorldPainter(level).paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand }, []);
  const camera = cameraPosition(level, picture.width, picture.height);
  const art = sprite(sprites.orbArt.red).colored;
  const violations: string[] = [];
  for (let y = 0; y < 24; y++)
    for (let x = 0; x < 24; x++) {
      const offset = (y * 24 + x) * 4;
      if (art[offset + 3] === 0) continue;
      const rendered = ((4 + y - camera.y) * picture.width + 4 + x - camera.x) * 4;
      if (art.subarray(offset, offset + 4).some((byte, channel) => picture.pixels[rendered + channel] !== byte))
        violations.push(`orb pixel ${x}, ${y}`);
    }
  expect(violations).toEqual([]);
});

describe('orbs of the first level', () => {
  const level = firstLevel(
    (positions) => positions,
    check2dObstacles,
    () => 0,
  );
  const swirls = Object.values(library.orbFrames);
  const swirlDrawn = (frame: number): { frame: number; x: number; y: number }[] => {
    const picture = new Picture(level.scenery.size.columns * tileSize, level.scenery.size.rows * tileSize);
    const draw = vi.spyOn(picture, 'draw');
    new WorldPainter(level).paint(picture, { level, frame, hero: sprites.heroArt.down.stand }, []);
    return draw.mock.calls.flatMap(([art, x, y]) => {
      const swirl = swirls.find((frames) => frames.includes(art));
      return swirl ? [{ frame: swirl.indexOf(art), x, y }] : [];
    });
  };

  test('swirl through every frame, each orb out of step with the others', () => {
    expect(level.orbs.length).toBeGreaterThan(1);
    const seen = level.orbs.map(() => new Set<number>());
    for (let frame = 0; frame < library.orbFrameLength * 8; frame += library.orbFrameLength)
      swirlDrawn(frame).forEach((drawn, index) => seen[index]!.add(drawn.frame));
    for (const frames of seen) expect(frames.size).toBe(8);
    const shown = swirlDrawn(0).map((drawn) => drawn.frame);
    expect(new Set(shown).size).toBe(level.orbs.length);
  });

  test('float on their own phases', () => {
    const rest = level.orbs.map(({ position }) => ({ x: position.column * tileSize, y: position.row * tileSize }));
    const offsets = (frame: number): string[] =>
      swirlDrawn(frame).map((drawn, index) => `${drawn.x - rest[index]!.x},${drawn.y - rest[index]!.y}`);
    const steps = Array.from({ length: 30 }, (_, step) => offsets(step * 10));
    const paths = level.orbs.map((_, index) => steps.map((step) => step[index]).join(' '));
    expect(new Set(paths).size).toBe(level.orbs.length);
  });
});

test('oversized views extend edge terrain without leaving empty map margins', () => {
  const level = renderingLevel();
  const picture = new Picture(801, 901);
  new WorldPainter(level).paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand }, [everywhere]);
  for (const [column, row] of [
    [0, 0],
    [800, 0],
    [0, 900],
    [800, 900],
  ]) {
    expect(['G1', 'G2', 'G3'].map((code) => palette[code as PaletteCode])).toContain(colorAt(picture, column!, row!));
  }
});

test('whole-pixel camera centers the hero until clamped at a map edge', () => {
  for (const [position, expected] of [
    [TilePosition.at(5, 5), [96, 115]],
    [TilePosition.at(0, 0), [0, 64]],
    [TilePosition.at(11, 11), [193, 231]],
  ] as const) {
    const level = renderingLevel(Ground.Grass, position);
    const picture = new Picture(225, 263);
    const draw = vi.spyOn(picture, 'draw');
    new WorldPainter(level).paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand }, [everywhere]);
    expect(draw.mock.calls.find(([art]) => art === sprites.heroArt.down.stand)?.slice(1, 3)).toEqual(expected);
    expect(draw.mock.calls.every(([, column, row]) => Number.isInteger(column) && Number.isInteger(row))).toBe(true);
  }
});

test('tall props occlude the hero behind them and never paint over a hero in front', () => {
  const tree = Tree.at(TilePosition.at(4, 5), TreeVariant.NoFruit);
  for (const [hero, treeLast] of [
    [TilePosition.at(4, 4), true],
    [TilePosition.at(4, 6), false],
  ] as const) {
    const level = renderingLevel(Ground.Grass, hero, [], [tree]);
    const picture = new Picture(384, 384);
    const draw = vi.spyOn(picture, 'draw');
    new WorldPainter(level).paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand }, [everywhere]);
    const heroIndex = draw.mock.calls.findIndex(([art]) => art === sprites.heroArt.down.stand);
    const treeIndex = draw.mock.calls.findIndex(([art]) => art.legend.t === 'E1');
    expect(treeIndex > heroIndex).toBe(treeLast);
  }
});

test('restoring both halves paints the same picture as restoring everywhere', () => {
  const level = Level.create({
    id: LevelId.of('areas'),
    scenery: Scenery.of(
      LevelSize.of(12, 12),
      Array.from({ length: 12 }, () => Array<Ground>(12).fill(Ground.Grass)),
      [],
      [],
    ),
    stones: [],
    orbs: [Orb.at(TilePosition.at(0, 0), 4, LevelSize.of(12, 12))],
    door: Door.closedAt(TilePosition.at(9, 0)),
    hero: { position: TilePosition.at(2, 2), facing: Direction.Down },
    obstacles: check2dObstacles,
  });
  const painter = new WorldPainter(level);
  const painted = (restored: readonly Area[]): Picture => {
    const picture = new Picture(384, 384);
    painter.paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand }, restored);
    return picture;
  };
  expect(pixelDifference(painted([leftHalf, rightHalf]), painted([everywhere]))).toBeUndefined();
});

// A view of the whole 12 x 12 map plus the two tiles of door height above it, so the camera is clamped to the map.
const overview = { width: 12 * tileSize, height: 14 * tileSize };
const seamEdge = 6 * tileSize;
const seamHalfWidth = 1.5 * tileSize;

function overviewPaints() {
  const level = renderingLevel();
  const painter = new WorldPainter(level);
  const scene = { level, frame: 0, hero: sprites.heroArt.down.stand };
  const paint = (restored: readonly Area[], using = painter): Picture => {
    const picture = new Picture(overview.width, overview.height);
    using.paint(picture, scene, restored);
    return picture;
  };
  return { level, painter, scene, paint };
}

function seamFixture() {
  const fixture = overviewPaints();
  const { paint } = fixture;
  return { ...fixture, faded: paint([]), colored: paint([everywhere]), seam: paint([leftHalf]) };
}

// A pixel shared by both pictures says nothing about which one the seam shows, so only differing pixels are counted.
function seamColumns(faded: Picture, colored: Picture, seam: Picture): { faded: number; colored: number }[] {
  const columns = Array.from({ length: faded.width }, () => ({ faded: 0, colored: 0 }));
  for (let index = 0; index < faded.packedPixels.length; index++) {
    const fadedPixel = faded.packedPixels[index]!;
    const coloredPixel = colored.packedPixels[index]!;
    if (fadedPixel === coloredPixel) continue;
    const column = columns[index % faded.width]!;
    if (seam.packedPixels[index] === coloredPixel) column.colored++;
    else if (seam.packedPixels[index] === fadedPixel) column.faded++;
  }
  return columns;
}

test('the colored share of a straight restored edge only falls from the colored side to the faded side', () => {
  const { faded, colored, seam } = seamFixture();
  const columns = seamColumns(faded, colored, seam);
  const shares = Array.from({ length: overview.width / tileSize }, (_, tileColumn) => {
    const tileColumns = columns.slice(tileColumn * tileSize, (tileColumn + 1) * tileSize);
    const coloredPixels = tileColumns.reduce((sum, column) => sum + column.colored, 0);
    return coloredPixels / (coloredPixels + tileColumns.reduce((sum, column) => sum + column.faded, 0));
  });
  expect(shares.every(Number.isFinite), 'every tile column must hold pixels that differ between the pictures').toBe(
    true,
  );
  shares.slice(1).forEach((share, index) => expect(share).toBeLessThanOrEqual(shares[index]!));
  const edgeColumn = seamEdge / tileSize;
  for (const tileColumn of [edgeColumn - 1, edgeColumn]) {
    expect(shares[tileColumn]!, `tile column ${tileColumn} lies inside the band`).toBeGreaterThan(0);
    expect(shares[tileColumn]!, `tile column ${tileColumn} lies inside the band`).toBeLessThan(1);
  }
});

test('a straight restored edge blends over a band about three tiles wide', () => {
  const { faded, colored, seam } = seamFixture();
  const columns = seamColumns(faded, colored, seam);
  const firstFaded = columns.findIndex((column) => column.faded > 0);
  const lastColored = columns.findLastIndex((column) => column.colored > 0);
  expect(firstFaded, 'the faded picture shows no farther than 1.5 tiles inside the edge').toBeGreaterThanOrEqual(
    seamEdge - seamHalfWidth,
  );
  expect(lastColored, 'the colored picture shows no farther than 1.5 tiles outside the edge').toBeLessThan(
    seamEdge + seamHalfWidth,
  );
  expect(lastColored - firstFaded + 1).toBeGreaterThanOrEqual(2 * tileSize);
});

test('the seam follows the restored set, whatever was painted before it', () => {
  const { level, paint, seam } = seamFixture();
  const wider = area((position) => position.column < 8);
  expect(
    pixelDifference(paint([area((position) => position.column < 6)]), seam),
    'the same set on a later paint',
  ).toBeUndefined();
  const widerSeam = paint([wider]);
  expect(pixelDifference(widerSeam, seam)).toBeDefined();
  expect(pixelDifference(paint([leftHalf]), seam), 'the first set again after another set').toBeUndefined();
  expect(
    pixelDifference(paint([wider], new WorldPainter(level)), widerSeam),
    'a painter that never painted the first set',
  ).toBeUndefined();
});

test('a jagged seam between two areas keeps clear tiles pure and mixes both pictures near the seam', () => {
  const inRed = (position: TilePosition) => position.column + (position.row % 4 < 2 ? 0 : 1) < 6;
  const level = levelFromLayout(
    LevelId.of('jagged'),
    [
      'WWWWDDDWWWWW',
      '............',
      '..K.........',
      '...Lt.......',
      '.........*..',
      '............',
      '.......Nt...',
      '............',
      '.........S..',
      '..*.........',
      '.....H......',
      '............',
    ],
    (positions) => positions,
    check2dObstacles,
    () => 0,
  );
  const red = area(inRed);
  const blue = area((position) => !inRed(position));
  const { columns, rows } = level.scenery.size;
  const side = columns * tileSize;
  expect(cameraPosition(level, side, side), 'the whole map must fill the picture from its corner').toEqual({
    x: 0,
    y: 0,
  });
  const painter = new WorldPainter(level);
  const scene = { level, frame: 0, hero: sprites.heroArt.down.stand };
  const paint = (restored: readonly Area[]): Picture => {
    const picture = new Picture(side, side);
    painter.paint(picture, scene, restored);
    return picture;
  };
  const faded = paint([]);
  const colored = paint([red, blue]);
  const seam = paint([red]);
  const clearance = (tile: TilePosition): number =>
    Math.min(
      ...(red.covers(tile) ? blue : red).tiles.map((far) =>
        Math.max(Math.abs(far.column - tile.column), Math.abs(far.row - tile.row)),
      ),
    );
  let foreign = 0;
  let mixedNearSeam = 0;
  const checked = { red: 0, blue: 0 };
  const wrongTiles: string[] = [];
  for (let index = 0; index < columns * rows; index++) {
    const tile = TilePosition.at(index % columns, Math.floor(index / columns));
    const inRed = red.covers(tile);
    const clear = clearance(tile) >= 3;
    let shownColored = 0;
    let shownFaded = 0;
    let wrong = 0;
    for (let y = tile.row * tileSize; y < (tile.row + 1) * tileSize; y++) {
      for (let x = tile.column * tileSize; x < (tile.column + 1) * tileSize; x++) {
        const offset = y * side + x;
        const fadedPixel = faded.packedPixels[offset]!;
        const coloredPixel = colored.packedPixels[offset]!;
        const shown = seam.packedPixels[offset]!;
        if (shown !== fadedPixel && shown !== coloredPixel) foreign++;
        if (fadedPixel === coloredPixel) continue;
        if (shown === coloredPixel) shownColored++;
        else if (shown === fadedPixel) shownFaded++;
        if (clear) {
          checked[inRed ? 'red' : 'blue']++;
          if (shown !== (inRed ? coloredPixel : fadedPixel)) wrong++;
        }
      }
    }
    if (wrong > 0) wrongTiles.push(`${tile.column}, ${tile.row}`);
    if (!clear && shownColored > 0 && shownFaded > 0) mixedNearSeam++;
  }
  expect(foreign, 'every pixel must be a pixel of the faded or the colored picture').toBe(0);
  expect(checked.red, 'clear red tiles must hold pixels that tell the pictures apart').toBeGreaterThan(0);
  expect(checked.blue, 'clear blue tiles must hold pixels that tell the pictures apart').toBeGreaterThan(0);
  expect(wrongTiles, 'tiles two or more tiles clear of the other area must show only their own picture').toEqual([]);
  expect(mixedNearSeam, 'a tile within the band must show both pictures').toBeGreaterThan(0);
});

const waveOrigin = TilePosition.at(9, 6);
const waveFrames = [0, 9, 21, 40, restorationLength(LevelSize.of(12, 12), waveOrigin)];

function halfMapWave() {
  const { level, painter, scene, paint } = overviewPaints();
  return {
    camera: cameraPosition(level, overview.width, overview.height),
    before: paint([leftHalf]),
    after: paint([leftHalf, rightHalf]),
    frame(framesSinceStart: number): Picture {
      const picture = new Picture(overview.width, overview.height);
      painter.paintRestoring(picture, scene, waveOrigin, framesSinceStart, [leftHalf], [leftHalf, rightHalf]);
      return picture;
    },
  };
}

test.each(waveFrames)(
  'frame %i of a wave over the right half of the map keeps every unchanged pixel',
  (framesSinceStart) => {
    const { before, after, frame } = halfMapWave();
    const wave = frame(framesSinceStart);
    let unchanged = 0;
    let altered = 0;
    for (let index = 0; index < wave.packedPixels.length; index++) {
      if (before.packedPixels[index] !== after.packedPixels[index]) continue;
      unchanged++;
      if (wave.packedPixels[index] !== after.packedPixels[index]) altered++;
    }
    expect(unchanged).toBeGreaterThan(0);
    expect(altered).toBe(0);
  },
);

test.each(waveFrames)(
  'every changed pixel of frame %i of a wave over the right half of the map shows its before, lightened after or after color',
  (framesSinceStart) => {
    const { before, after, frame } = halfMapWave();
    const wave = frame(framesSinceStart);
    let changed = 0;
    let unexpected = 0;
    for (let index = 0; index < wave.packedPixels.length; index++) {
      const earlier = before.packedPixels[index]!;
      const later = after.packedPixels[index]!;
      if (earlier === later) continue;
      changed++;
      const shown = wave.packedPixels[index]!;
      if (shown !== earlier && shown !== lighten(later) && shown !== later) unexpected++;
    }
    expect(changed).toBeGreaterThan(0);
    expect(unexpected).toBe(0);
    const outsidePalette = (picture: Picture): number =>
      picture.packedPixels.filter((pixel) => !codeOfPacked.has(pixel)).length;
    expect(outsidePalette(before) + outsidePalette(after) + outsidePalette(wave)).toBe(0);
  },
);

test('a wave over the right half of the map starts as the before picture wherever it has not arrived', () => {
  const { before, camera, frame } = halfMapWave();
  const wave = frame(0);
  let waiting = 0;
  let altered = 0;
  for (let y = 0; y < wave.height; y++) {
    for (let x = 0; x < wave.width; x++) {
      if (restorationAge(x + camera.x, y + camera.y, waveOrigin, 0) >= 0) continue;
      waiting++;
      const index = y * wave.width + x;
      if (wave.packedPixels[index] !== before.packedPixels[index]) altered++;
    }
  }
  expect(waiting).toBeGreaterThan(0);
  expect(altered).toBe(0);
});

test('a wave over the right half of the map ends as exactly the after picture', () => {
  const { after, frame } = halfMapWave();
  expect(pixelDifference(frame(restorationLength(LevelSize.of(12, 12), waveOrigin)), after)).toBeUndefined();
});

test('a changed pixel is its before color until the wave arrives, then crests lightened and settles on its after color', () => {
  const { before, after, camera, frame } = halfMapWave();
  const candidates: number[] = [];
  for (let index = 0; index < before.packedPixels.length; index++) {
    const earlier = before.packedPixels[index]!;
    const later = after.packedPixels[index]!;
    if (earlier !== later && lighten(later) !== later && lighten(later) !== earlier) candidates.push(index);
  }
  const arrivals = candidates
    .filter((_, position) => position % 251 === 0)
    .map((index) => {
      const x = index % before.width;
      const y = Math.floor(index / before.width);
      return { index, x, y, arrival: firstArrival(x + camera.x, y + camera.y, waveOrigin) };
    })
    .filter(({ arrival }) => arrival >= 1)
    .sort((left, right) => left.arrival - right.arrival);
  const samples = Array.from({ length: 6 }, (_, sample) => arrivals[Math.floor((sample * (arrivals.length - 1)) / 5)]!);
  expect(new Set(samples.map(({ arrival }) => arrival)).size, 'the samples must arrive at different frames').toBe(6);
  const frames = new Map<number, Picture>();
  const shownAt = (index: number, framesSinceStart: number): number => {
    if (!frames.has(framesSinceStart)) frames.set(framesSinceStart, frame(framesSinceStart));
    return frames.get(framesSinceStart)!.packedPixels[index]!;
  };
  for (const { index, x, y, arrival } of samples) {
    const earlier = before.packedPixels[index]!;
    const later = after.packedPixels[index]!;
    const at = (framesSinceStart: number): string => `pixel ${x}, ${y} at frame ${framesSinceStart}`;
    expect(shownAt(index, arrival - 1), at(arrival - 1)).toBe(earlier);
    expect(shownAt(index, arrival), at(arrival)).toBe(lighten(later));
    expect(shownAt(index, arrival + crestLength - 1), at(arrival + crestLength - 1)).toBe(lighten(later));
    expect(shownAt(index, arrival + crestLength), at(arrival + crestLength)).toBe(later);
  }
});

describe('collecting an orb', () => {
  const level = renderingLevel();
  const orb = level.orbs[0]!;
  const hue = library.orbHues[0];
  const scene = { level, frame: 200, hero: sprites.heroArt.down.stand };
  const restore = (painter: WorldPainter, framesSinceStart: number): Picture => {
    const picture = new Picture(overview.width, overview.height);
    painter.paintRestoring(
      picture,
      { ...scene, frame: scene.frame + framesSinceStart },
      orb.position,
      framesSinceStart,
      [],
      [everywhere],
    );
    return picture;
  };

  test('plays the burst once in the orb hue where the orb was last drawn, then stops on its empty frame', () => {
    const painter = new WorldPainter(level);
    const burst = library.orbBurstFrames[hue];
    const float = orbFloat(scene.frame);
    const camera = cameraPosition(level, overview.width, overview.height);
    for (
      let framesSinceStart = 0;
      framesSinceStart < burst.length * library.orbBurstFrameLength + 8;
      framesSinceStart++
    ) {
      const picture = new Picture(overview.width, overview.height);
      const draw = vi.spyOn(picture, 'draw');
      painter.paintRestoring(
        picture,
        { ...scene, frame: scene.frame + framesSinceStart },
        orb.position,
        framesSinceStart,
        [],
        [everywhere],
      );
      const drawn = draw.mock.calls.filter(([art]) => Object.values(library.orbBurstFrames).flat().includes(art));
      const index = Math.floor(framesSinceStart / library.orbBurstFrameLength);
      if (index >= burst.length) {
        expect(drawn, `frame ${framesSinceStart}`).toEqual([]);
        continue;
      }
      expect(
        drawn.map(([art, x, y]) => [art, x, y]),
        `frame ${framesSinceStart}`,
      ).toEqual([
        [
          burst[index],
          orb.position.column * tileSize + float.x - camera.x,
          orb.position.row * tileSize + float.y - camera.y,
        ],
      ]);
    }
    expect(sprite(burst.at(-1)!).colored.some((byte, offset) => offset % 4 === 3 && byte !== 0)).toBe(false);
  });

  test('the wave shows only earlier, later or lightened colors on changing pixels and leaves unchanged pixels alone', () => {
    const painter = new WorldPainter(level);
    const plain = new WorldPainter(renderingLevel());
    const before = new Picture(overview.width, overview.height);
    const after = new Picture(overview.width, overview.height);
    const camera = cameraPosition(level, overview.width, overview.height);
    for (const framesSinceStart of [44, 52]) {
      const frameScene = { ...scene, frame: scene.frame + framesSinceStart };
      plain.paint(before, frameScene, []);
      plain.paint(after, frameScene, [everywhere]);
      const wave = restore(painter, framesSinceStart);
      const states = new Set<string>();
      const unexpected: string[] = [];
      for (let index = 0; index < wave.packedPixels.length; index++) {
        const earlier = before.packedPixels[index]!;
        const later = after.packedPixels[index]!;
        const pixel = wave.packedPixels[index]!;
        const worldX = (index % wave.width) + camera.x;
        const worldY = Math.floor(index / wave.width) + camera.y;
        if (worldX < 2 * tileSize && worldY < 2 * tileSize) continue;
        if (earlier === later) {
          if (pixel !== later) unexpected.push(`unchanged pixel ${index}`);
          continue;
        }
        if (pixel === earlier) states.add('earlier');
        else if (pixel === lighten(later)) states.add('lightened');
        else if (pixel === later) states.add('later');
        else unexpected.push(`changed pixel ${index}`);
      }
      expect(unexpected.slice(0, 5), `frame ${framesSinceStart}`).toEqual([]);
      expect([...states].sort(), `frame ${framesSinceStart}`).toEqual(['earlier', 'later', 'lightened']);
    }
  });
});

describe('the pop when an orb is collected', () => {
  const orbTile = TilePosition.at(6, 6);
  const level = Level.create({
    id: LevelId.of('pop'),
    scenery: Scenery.of(
      LevelSize.of(12, 12),
      Array.from({ length: 12 }, () => Array.from({ length: 12 }, () => Ground.Grass)),
      [],
      [],
    ),
    stones: [],
    orbs: [Orb.at(orbTile, 4, LevelSize.of(12, 12))],
    door: Door.closedAt(TilePosition.at(9, 0)),
    hero: { position: TilePosition.at(2, 2), facing: Direction.Down },
    obstacles: check2dObstacles,
  });
  const painter = new WorldPainter(level);
  const camera = cameraPosition(level, overview.width, overview.height);
  const paper = packedOf('Paper');
  const baseFrame = 200;
  const half = 20;

  // Pixels that differ from the plain wave outside the burst box, as {x, y} relative to the orb center.
  function extras(origin: TilePosition, framesSinceStart: number): { x: number; y: number; color: number }[] {
    const frameScene = { level, frame: baseFrame + framesSinceStart, hero: sprites.heroArt.down.stand };
    const before = new Picture(overview.width, overview.height);
    const after = new Picture(overview.width, overview.height);
    const wave = new Picture(overview.width, overview.height);
    painter.paint(before, frameScene, []);
    painter.paint(after, frameScene, [everywhere]);
    painter.paintRestoring(wave, frameScene, origin, framesSinceStart, [], [everywhere]);
    const float = orbFloat(baseFrame);
    const centerX = (orbTile.column + 0.5) * tileSize + float.x - camera.x;
    const centerY = (orbTile.row + 0.5) * tileSize + float.y - camera.y;
    const found: { x: number; y: number; color: number }[] = [];
    for (let index = 0; index < wave.packedPixels.length; index++) {
      const x = (index % wave.width) - centerX;
      const y = Math.floor(index / wave.width) - centerY;
      if (Math.abs(x) <= half && Math.abs(y) <= half) continue;
      const pixel = wave.packedPixels[index]!;
      const earlier = before.packedPixels[index]!;
      const later = after.packedPixels[index]!;
      if (pixel !== earlier && pixel !== later && pixel !== lighten(later)) found.push({ x, y, color: pixel });
    }
    return found;
  }

  function specks(pixels: readonly { x: number; y: number }[]): { x: number; y: number }[][] {
    const remaining = [...pixels];
    const groups: { x: number; y: number }[][] = [];
    while (remaining.length > 0) {
      const group = [remaining.pop()!];
      for (let next = 0; next < group.length; next++)
        for (let at = remaining.length - 1; at >= 0; at--)
          if (Math.abs(remaining[at]!.x - group[next]!.x) <= 1 && Math.abs(remaining[at]!.y - group[next]!.y) <= 1)
            group.push(...remaining.splice(at, 1));
      groups.push(group);
    }
    return groups;
  }

  test('adds only Paper specks, each within 2 by 2 pixels, and at most eight', () => {
    const problems: string[] = [];
    let most = 0;
    for (let framesSinceStart = 8; framesSinceStart < 40; framesSinceStart++) {
      const found = extras(orbTile, framesSinceStart);
      if (found.some(({ color }) => color !== paper)) problems.push(`frame ${framesSinceStart} has a non-Paper pixel`);
      const groups = specks(found);
      most = Math.max(most, groups.length);
      for (const group of groups) {
        const xs = group.map(({ x }) => x);
        const ys = group.map(({ y }) => y);
        if (Math.max(...xs) - Math.min(...xs) > 1 || Math.max(...ys) - Math.min(...ys) > 1)
          problems.push(`frame ${framesSinceStart} has a speck larger than 2 by 2`);
      }
    }
    expect(problems).toEqual([]);
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(8);
  });

  test('moves the specks outward over time', () => {
    const farthest = (framesSinceStart: number): number =>
      Math.max(...extras(orbTile, framesSinceStart).map(({ x, y }) => Math.hypot(x, y)));
    const reach = [8, 16, 24].map(farthest);
    expect(reach[0]).toBeGreaterThan(half);
    expect(reach[1]).toBeGreaterThan(reach[0]!);
    expect(reach[2]).toBeGreaterThan(reach[1]!);
  });

  test('leaves none from frame 40 on', () => {
    expect(extras(orbTile, 30).length).toBeGreaterThan(0);
    for (const framesSinceStart of [40, 41, 80])
      expect(extras(orbTile, framesSinceStart), `frame ${framesSinceStart}`).toEqual([]);
  });

  test('draws nothing when the restoration starts on a tile without an orb', () => {
    for (const framesSinceStart of [0, 8, 16, 24]) {
      const frameScene = { level, frame: baseFrame + framesSinceStart, hero: sprites.heroArt.down.stand };
      const before = new Picture(overview.width, overview.height);
      const after = new Picture(overview.width, overview.height);
      const wave = new Picture(overview.width, overview.height);
      painter.paint(before, frameScene, []);
      painter.paint(after, frameScene, [everywhere]);
      painter.paintRestoring(wave, frameScene, TilePosition.at(3, 3), framesSinceStart, [], [everywhere]);
      const strays: number[] = [];
      for (let index = 0; index < wave.packedPixels.length; index++) {
        const pixel = wave.packedPixels[index]!;
        const later = after.packedPixels[index]!;
        if (pixel !== before.packedPixels[index] && pixel !== later && pixel !== lighten(later)) strays.push(index);
      }
      expect(strays.slice(0, 5), `frame ${framesSinceStart}`).toEqual([]);
    }
  });
});

function treeArtDrawn(trees: readonly Tree[]): (tree: Tree) => Art | undefined {
  const level = renderingLevel(Ground.Grass, TilePosition.at(2, 2), [], trees);
  const picture = new Picture(384, 384);
  const draw = vi.spyOn(picture, 'draw');
  new WorldPainter(level).paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand }, [everywhere]);
  const frames = [...scenery.treeArt.flat(2), ...Object.values(scenery.fruitTreeArt).flat()];
  return (tree) => draw.mock.calls.find(([art, x]) => frames.includes(art) && x === tree.base.column * tileSize)?.[0];
}

test('each fruit tree is drawn with its own fruit art', () => {
  const trees = [
    [Tree.at(TilePosition.at(3, 5), TreeVariant.Oranges), scenery.fruitTreeArt.orange],
    [Tree.at(TilePosition.at(6, 5), TreeVariant.Apples), scenery.fruitTreeArt.apple],
    [Tree.at(TilePosition.at(9, 5), TreeVariant.Lemons), scenery.fruitTreeArt.lemon],
  ] as const;
  const drawn = treeArtDrawn(trees.map(([tree]) => tree));
  for (const [tree, frames] of trees) expect(frames).toContain(drawn(tree));
});

test('touching no-fruit trees use different leafy shapes', () => {
  const trees = [
    Tree.at(TilePosition.at(4, 5), TreeVariant.NoFruit),
    Tree.at(TilePosition.at(6, 5), TreeVariant.NoFruit),
  ];
  const drawn = treeArtDrawn(trees);
  const [first, second] = trees.map((tree) =>
    scenery.treeArt.findIndex((versions) => versions.flat().includes(drawn(tree)!)),
  );
  expect(first).not.toBe(-1);
  expect(second).not.toBe(-1);
  expect(first).not.toBe(second);
});

test('touching trees of one fruit are both drawn with that fruit art', () => {
  const trees = [
    Tree.at(TilePosition.at(4, 5), TreeVariant.Apples),
    Tree.at(TilePosition.at(6, 5), TreeVariant.Apples),
  ];
  const drawn = treeArtDrawn(trees);
  for (const tree of trees) expect(scenery.fruitTreeArt.apple).toContain(drawn(tree));
});

test('the door is drawn open only in the colored world once the orb is collected', () => {
  const level = renderingLevel(Ground.Grass, TilePosition.at(1, 0));
  const painter = new WorldPainter(level);
  const drawn = (version: 'colored' | 'faded'): Art[] => {
    const picture = new Picture(384, 384);
    const draw = vi.spyOn(picture, 'draw');
    painter.paint(
      picture,
      { level, frame: 0, hero: sprites.heroArt.down.stand },
      version === 'colored' ? [everywhere] : [],
    );
    return draw.mock.calls
      .map(([art]) => art)
      .filter((art) => art === scenery.doorArt.closed || art === scenery.doorArt.open);
  };
  expect(drawn('colored')).toEqual([scenery.doorArt.closed]);
  expect(drawn('faded')).toEqual([scenery.doorArt.closed]);
  for (let frame = 0; frame < 30; frame++) level.tick(Heading.of(Direction.Left));
  expect(level.orbs).toEqual([]);
  expect(level.door.isOpen).toBe(false);
  expect(drawn('colored')).toEqual([scenery.doorArt.open]);
  expect(drawn('faded')).toEqual([scenery.doorArt.closed]);
});

test('keeps the top-edge door art inside the game view when the hero approaches it', () => {
  const level = renderingLevel(Ground.Grass, TilePosition.at(10, 1));
  const picture = new Picture(224, 224);
  const draw = vi.spyOn(picture, 'draw');
  new WorldPainter(level).paint(picture, { level, frame: 0, hero: sprites.heroArt.up.stand }, [everywhere]);
  const door = draw.mock.calls.find(([art]) => art === scenery.doorArt.closed);
  expect(door).toBeDefined();
  expect(door![2]).toBeGreaterThanOrEqual(0);
});

test('closing darkens the colored world to Ink through the ordered dither', () => {
  const level = renderingLevel();
  const painter = new WorldPainter(level);
  const scene = { level, frame: 0, hero: sprites.heroArt.down.stand };
  const colored = new Picture(224, 224);
  const closing = new Picture(224, 224);
  painter.paint(colored, scene, [everywhere]);
  painter.paintClosing(closing, scene, 0);
  expect(pixelDifference(closing, colored)).toBeUndefined();
  painter.paintClosing(closing, scene, closingLength);
  const violations: string[] = [];
  scan: for (let row = 0; row < closing.height; row++) {
    for (let column = 0; column < closing.width; column++) {
      const color = colorAt(closing, column, row);
      if (color !== palette.Ink) {
        violations.push(`pixel ${column}, ${row}: ${color}`);
        break scan;
      }
    }
  }
  expect(violations).toEqual([]);
});

test('every palette step fades to a neutral while neutrals preserve their values', () => {
  const neutrals = ['Ink', 'N1', 'N2', 'N3', 'N4', 'Paper'];
  for (const code of Object.keys(palette) as (keyof typeof palette)[]) {
    expect(neutrals).toContain(faded(code));
    if (neutrals.includes(code)) expect(faded(code)).toBe(code);
  }
});

const ramps = [
  ['neutral', ['N1', 'N2', 'N3', 'N4', 'Paper']],
  ['green', ['G0', 'G1', 'G2', 'G3', 'G4']],
  ['earth', ['E0', 'E1', 'E2', 'E3', 'E4']],
  ['water', ['W0', 'W1', 'W2', 'W3', 'W4']],
  ['gold', ['Y0', 'Y1', 'Y2', 'Y3']],
  ['red', ['R0', 'R1', 'R2', 'R3']],
  ['violet', ['V0', 'V0a', 'V1', 'V2', 'V3']],
  ['teal', ['T0', 'T1', 'T2', 'T3']],
  ['pink', ['P0', 'P1', 'P2', 'P3']],
  ['skin', ['S0', 'S1', 'S2', 'S3']],
  ['orange', ['O0', 'O1', 'O2', 'O3']],
  ['moss', ['M0', 'M1', 'M2', 'M3']],
  ['fir', ['F0', 'F1', 'F2', 'F3']],
] as const satisfies readonly (readonly [string, readonly PaletteCode[]])[];

test('the ramps hold every palette step but Ink exactly once', () => {
  expect(ramps.flatMap(([, ramp]) => [...ramp]).toSorted()).toEqual(
    paletteCodes.filter((code) => code !== 'Ink').toSorted(),
  );
});

test.each(ramps)('lighter steps up the %s ramp one step at a time and stays on its top step', (_, ramp) => {
  ramp.slice(0, -1).forEach((code, index) => expect(lighter(code)).toBe(ramp[index + 1]));
  expect(lighter(ramp.at(-1)!)).toBe(ramp.at(-1));
});

test('lighter leaves Ink unchanged', () => {
  expect(lighter('Ink')).toBe('Ink');
});

test.each(paletteCodes)('lightening a packed %s pixel gives its lighter step', (code) => {
  expect(lighten(packedOf(code))).toBe(packedOf(lighter(code)));
});

test.each([0, 0xff123456])('lightening the packed value %s, which is no palette color, changes nothing', (packed) => {
  expect(lighten(packed)).toBe(packed);
});

test.each(Object.keys(palette) as PaletteCode[])('repeated fills preserve the exact RGBA bytes of %s', (code) => {
  const picture = new Picture(3, 2);
  const bytes = [1, 3, 5].map((start) => Number.parseInt(palette[code].slice(start, start + 2), 16));
  for (let repeat = 0; repeat < 2; repeat++) {
    picture.pixels.fill(7);
    picture.fill(code);
    expect([...picture.pixels]).toEqual(Array.from({ length: 6 }, () => [...bytes, 255]).flat());
  }
});

test.each(['colored', 'faded'] as const)('drawing every palette code preserves its exact %s RGBA bytes', (version) => {
  const codes = Object.keys(palette) as PaletteCode[];
  const symbols = codes.map((_, index) => String.fromCharCode(65 + index));
  const art: Art = {
    legend: Object.fromEntries(symbols.map((symbol, index) => [symbol, codes[index]!])),
    rows: [symbols.join('')],
  };
  const picture = new Picture(codes.length, 1);
  picture.draw(art, 0, 0, version);
  expect([...picture.pixels]).toEqual(
    codes.flatMap((code) => [
      ...[1, 3, 5].map((start) =>
        Number.parseInt(palette[version === 'faded' ? faded(code) : code].slice(start, start + 2), 16),
      ),
      255,
    ]),
  );
});

test('byte edits and shading survive transparent and hidden sprite pixels across repeated draws', () => {
  const picture = new Picture(3, 1);
  const art: Art = { legend: { g: 'G3' }, rows: ['.gg'] };
  picture.fill('G2');
  picture.pixels.set([155, 211, 90, 73]);
  picture.shade(0, 0, 3, 1);
  picture.draw(art, 0, 0, 'colored', (x) => x !== 1);
  expect([...picture.pixels]).toEqual([90, 168, 69, 73, 47, 122, 74, 255, 155, 211, 90, 255]);
  picture.shade(0, 0, 3, 1);
  picture.draw(art, 0, 0, 'faded', (x) => x !== 1);
  expect([...picture.pixels]).toEqual([47, 122, 74, 73, 31, 74, 63, 255, 196, 198, 214, 255]);
  picture.fill('Paper');
  picture.draw(art, 0, 0, 'colored');
  expect([...picture.pixels]).toEqual([245, 242, 233, 255, 155, 211, 90, 255, 155, 211, 90, 255]);
});

test.each(['colored', 'faded'] as const)('drawing observes public byte edits to a cached %s sprite', (version) => {
  const art: Art = { legend: { g: 'G2' }, rows: ['gg.'], faded: { legend: { n: 'N4' }, rows: ['nn.'] } };
  const picture = new Picture(3, 1);
  picture.fill('Ink');
  picture.draw(art, 0, 0, version);
  const original = version === 'colored' ? [90, 168, 69, 255] : [196, 198, 214, 255];
  expect([...picture.pixels]).toEqual([...original, ...original, 28, 26, 46, 255]);
  const bytes = sprite(art)[version];
  bytes.set([240, 96, 79, 255]);
  bytes[7] = 0;
  bytes.set([60, 200, 180, 255], 8);
  picture.fill('Paper');
  picture.draw(art, 0, 0, version);
  expect([...picture.pixels]).toEqual([240, 96, 79, 255, 245, 242, 233, 255, 60, 200, 180, 255]);
});

test('a reused painter matches fresh compositing and restoration after target size changes', () => {
  const level = renderingLevel();
  const painter = new WorldPainter(level);
  const scene = { level, frame: 0, hero: sprites.heroArt.down.stand };
  const origin = TilePosition.at(2, 2);
  for (const [width, height] of [
    [224, 225],
    [225, 224],
    [257, 263],
    [224, 225],
  ]) {
    const actual = new Picture(width!, height!);
    const expected = new Picture(width!, height!);
    const fresh = new WorldPainter(level);
    painter.paint(actual, scene, [leftHalf]);
    fresh.paint(expected, scene, [leftHalf]);
    expect(pixelDifference(actual, expected)).toBeUndefined();
    painter.paintRestoring(actual, scene, origin, 16, [leftHalf], [everywhere]);
    fresh.paintRestoring(expected, scene, origin, 16, [leftHalf], [everywhere]);
    expect(pixelDifference(actual, expected)).toBeUndefined();
  }
});

test('corrected faded art preserves dimensions, silhouette, and neutral colors', () => {
  const art: Art = { legend: { g: 'G2' }, rows: ['gg.'], faded: { legend: { n: 'N4' }, rows: ['nn.'] } };
  expect([...sprite(art).faded.slice(0, 4)]).toEqual([196, 198, 214, 255]);
  expect(() => sprite({ ...art, faded: { legend: { n: 'N4' }, rows: ['n.'] } })).toThrow(/dimensions/);
  expect(() => sprite({ ...art, faded: { legend: { n: 'N4' }, rows: ['n..'] } })).toThrow(/silhouette/);
  expect(() => sprite({ ...art, faded: { legend: { n: 'G3' }, rows: ['nn.'] } })).toThrow(/neutral/);
});

test('sprites reject fractional placement instead of corrupting adjacent pixels', () => {
  const picture = new Picture(32, 32);
  expect(() => picture.draw({ legend: { g: 'G2' }, rows: ['gg'] }, 0.5, 0, 'colored')).toThrow(/whole pixel/);
});

test.each([
  Direction.Up,
  Direction.Down,
  Direction.Left,
  Direction.Right,
  Direction.UpLeft,
  Direction.UpRight,
  Direction.DownLeft,
  Direction.DownRight,
])('renders steady %s walking on whole pixels without snapping backward', (direction) => {
  const start = TilePosition.at(5, 5);
  const ground = Array.from({ length: 12 }, () => Array.from({ length: 12 }, () => Ground.Grass));
  const level = Level.create({
    id: LevelId.of('movement'),
    scenery: Scenery.of(LevelSize.of(12, 12), ground, [], []),
    stones: [],
    orbs: [Orb.at(TilePosition.at(0, 0), 4, LevelSize.of(12, 12))],
    door: Door.closedAt(TilePosition.at(9, 0)),
    hero: { position: start, facing: direction.facing },
    obstacles: check2dObstacles,
  });
  expect(heroPixels(level)).toEqual({ x: start.column * tileSize, y: start.row * tileSize });
  let previous = heroPixels(level);
  for (let frame = 0; frame < 40; frame++) {
    level.tick(Heading.of(direction));
    const pixels = heroPixels(level);
    expect(Number.isInteger(pixels.x) && Number.isInteger(pixels.y)).toBe(true);
    expect((pixels.x - previous.x) * direction.columnStep).toBeGreaterThanOrEqual(0);
    expect((pixels.y - previous.y) * direction.rowStep).toBeGreaterThanOrEqual(0);
    expect(Math.abs(pixels.x - previous.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(pixels.y - previous.y)).toBeLessThanOrEqual(2);
    previous = pixels;
  }
});

// Only tiles with woodland beside and below are checked, because canopies round off where woodland meets open grass.
test.each([
  [0, 0],
  [799, 0],
  [0, 799],
  [799, 799],
])('woodland trees leave no grass inside woodland at the minimum view, with the hero at %i, %i', (x, y) => {
  const base = firstLevel(
    (positions) => positions,
    check2dObstacles,
    () => 0,
  );
  const level = { ...levelView(base), hero: HeroState.of(WorldPosition.at(x, y), Direction.Down, false) };
  const picture = new Picture(224, 224);
  const camera = cameraPosition(level, picture.width, picture.height);
  const draw = vi.spyOn(picture, 'draw');
  new WorldPainter(level).paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand }, []);
  const covered = new Uint8Array(picture.width * picture.height);
  const trees = scenery.treeArt.flat(2);
  for (const [art, left, top] of draw.mock.calls) {
    if (!trees.includes(art)) continue;
    const { width, height, colored } = sprite(art);
    for (let row = 0; row < height; row++) {
      for (let column = 0; column < width; column++) {
        const px = left + column;
        const py = top + row;
        if (
          px < 0 ||
          py < 0 ||
          px >= picture.width ||
          py >= picture.height ||
          colored[(row * width + column) * 4 + 3] === 0
        )
          continue;
        covered[py * picture.width + px] = 1;
      }
    }
  }
  const { columns, rows } = level.scenery.size;
  const wooded = (column: number, row: number): boolean =>
    column < 0 ||
    row < 0 ||
    column >= columns ||
    row >= rows ||
    level.scenery.woodland.covers(TilePosition.at(column, row));
  let checked = 0;
  let gaps = 0;
  for (let py = 0; py < picture.height; py++) {
    for (let px = 0; px < picture.width; px++) {
      const column = Math.floor((px + camera.x) / tileSize);
      const row = Math.floor((py + camera.y) / tileSize);
      if ([-1, 0, 1].some((beside) => !wooded(column + beside, row) || !wooded(column + beside, row + 1))) continue;
      checked++;
      if (!covered[py * picture.width + px]) gaps++;
    }
  }
  expect(checked).toBeGreaterThan(picture.width * tileSize);
  expect(gaps).toBe(0);
});

test('levels without woodland draw only their authored trees', () => {
  const level = renderingLevel(Ground.Grass, undefined, [], [Tree.at(TilePosition.at(4, 5), TreeVariant.NoFruit)]);
  const picture = new Picture(224, 320);
  const draw = vi.spyOn(picture, 'draw');
  new WorldPainter(level).paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand }, []);
  const trees = [...scenery.treeArt.flat(2), ...Object.values(scenery.fruitTreeArt).flat()];
  expect(draw.mock.calls.filter(([art]) => trees.includes(art))).toHaveLength(level.scenery.trees.length);
  expect(dressWorld(level).undergrowth).toEqual([]);
});

test('undergrowth grows only on free clearing grass beside woodland, away from the hero start', () => {
  const level = levelView(
    sixthLevel(
      (positions) => positions,
      check2dObstacles,
      () => 0,
    ),
  );
  const { scenery } = level;
  const start = level.hero.position;
  const taken = [...scenery.flowers, ...level.stones, ...level.orbs].map(({ position }) => position);
  const { undergrowth } = dressWorld(level);
  expect(undergrowth.length).toBeGreaterThan(0);
  for (const { position } of undergrowth) {
    expect(scenery.groundAt(position)).toBe(Ground.Grass);
    expect(scenery.isWalkable(position)).toBe(true);
    expect(taken.some((other) => other.equals(position))).toBe(false);
    expect(Math.max(Math.abs(position.column - start.column), Math.abs(position.row - start.row))).toBeGreaterThan(1);
    expect(
      [-1, 0, 1].some((dy) =>
        [-1, 0, 1].some((dx) => {
          const neighbor = TilePosition.at(position.column + dx, position.row + dy);
          return !scenery.size.contains(neighbor) || scenery.woodland.covers(neighbor);
        }),
      ),
    ).toBe(true);
  }
});

function arrivalDraws(age: number) {
  const level = renderingLevel();
  const picture = new Picture(384, 384);
  const camera = cameraPosition(level, picture.width, picture.height);
  const hero = heroPixels(level);
  const draw = vi.spyOn(picture, 'draw');
  new WorldPainter(level).paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand, arrival: age }, [
    everywhere,
  ]);
  const heroCall = draw.mock.calls.find(([art]) => art === sprites.heroArt.down.stand)!;
  const { width, height, colored } = sprite(sprites.heroArt.down.stand);
  const rowsShown = Array.from({ length: height }, (_, row) => {
    let shown = 0;
    for (let column = 0; column < width; column++) {
      if (colored[(row * width + column) * 4 + 3] !== 0 && heroCall[4]!(heroCall[1] + column, heroCall[2] + row))
        shown++;
    }
    return shown;
  });
  const opaque = Array.from(
    { length: height },
    (_, row) =>
      Array.from({ length: width }, (_, column) => colored[(row * width + column) * 4 + 3]).filter(
        (alpha) => alpha !== 0,
      ).length,
  );
  const moteDraws = draw.mock.calls
    .filter(([art]) => art === sprites.lightMote)
    .map(([, x, y]) => ({ x: x - (hero.x - camera.x), y: y - (hero.y - camera.y) }));
  const edgeCount = risingEdge(age) === undefined ? 0 : opaque[risingEdge(age)!]!;
  const shadowDrawn = draw.mock.calls.some(
    ([art, x, y]) => art.rows.length === 5 && x === hero.x + 9 - camera.x && y === hero.y + tileSize - camera.y,
  );
  return { rowsShown, opaque, edge: moteDraws.slice(0, edgeCount), motes: moteDraws.slice(edgeCount), shadowDrawn };
}

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

test.each([0, 15])('an arriving hero shows no pixels and no shadow at age %i', (age) => {
  const { rowsShown, shadowDrawn } = arrivalDraws(age);
  expect(sum(rowsShown)).toBe(0);
  expect(shadowDrawn).toBe(false);
});

test('an arriving hero is revealed from the feet upward with her shadow from age 16 and in full from age 38', () => {
  let previous = { shown: 0, highest: 32 };
  for (let age = 16; age <= 37; age++) {
    const { rowsShown, opaque, shadowDrawn } = arrivalDraws(age);
    const shown = sum(rowsShown);
    const highest = rowsShown.findIndex((count) => count > 0);
    expect(shadowDrawn).toBe(true);
    expect(shown).toBeGreaterThan(previous.shown);
    expect(shown).toBeLessThan(sum(opaque));
    expect(highest).toBeLessThanOrEqual(previous.highest);
    previous = { shown, highest };
  }
  for (const age of [38, 39, 40, 47]) expect(arrivalDraws(age).rowsShown).toEqual(arrivalDraws(age).opaque);
});

test.each([16, 24, 32, 37])('the rising edge at age %i is a Paper line over her opaque pixels only', (age) => {
  const { edge, opaque } = arrivalDraws(age);
  const row = risingEdge(age)!;
  expect(edge.length).toBe(opaque[row]);
  for (const point of edge) {
    expect(point.y).toBe(row);
    expect(sprite(sprites.heroArt.down.stand).colored[(row * 32 + point.x) * 4 + 3]).not.toBe(0);
  }
});

test.each([0, 15, 16, 39, 40, 47, 48])('arrival motes at age %i are drawn at their offsets from the hero', (age) => {
  expect(arrivalDraws(age).motes).toEqual(arrivalMotes(age));
});

test('a hero without an arrival is drawn without a mask or motes', () => {
  const level = renderingLevel();
  const picture = new Picture(384, 384);
  const draw = vi.spyOn(picture, 'draw');
  new WorldPainter(level).paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand }, [everywhere]);
  expect(draw.mock.calls.find(([art]) => art === sprites.heroArt.down.stand)?.[4]).toBeUndefined();
  expect(draw.mock.calls.some(([art]) => art === sprites.lightMote)).toBe(false);
});

describe('a swing gate', () => {
  const gated = () =>
    levelFromLayout(
      LevelId.of('gated'),
      ['.DDD.', '..Q..', '.....', 'WFGFW', '..H..', '.....'],
      (spots) => spots,
      check2dObstacles,
      () => 0,
    );
  const drawn = (level: Level, restored: readonly Area[] = []) => {
    const picture = new Picture(160, 192);
    const draw = vi.spyOn(picture, 'draw');
    const view = levelView(level);
    new WorldPainter(view).paint(picture, { level: view, frame: 0, hero: library.heroArt.up.stand }, restored);
    return draw.mock.calls.map(([art]) => art);
  };
  const gateFrames = [...library.gateArt.opening, library.gateArt.open];

  test('shows the closed leaf', () => {
    expect(drawn(gated()).filter((art) => gateFrames.includes(art))).toEqual([library.gateArt.opening[0]]);
  });

  test.each([
    [0, 0],
    [1, 0],
    [2, 1],
    [4, 2],
    [6, 3],
    [8, 4],
    [10, 5],
    [12, 6],
    [14, 7],
    [15, 7],
  ])('at age %i draws swing frame %i', (age, index) => {
    const level = gated();
    level.operateGate();
    for (let tick = 0; tick < age; tick++) level.tick(null);
    const shown = drawn(level);
    expect(shown.filter((art) => gateFrames.includes(art))).toEqual([library.gateArt.opening[index]]);
  });

  test('keeps the parked leaf once open, also after color returns', () => {
    const level = gated();
    level.operateGate();
    settleGate(level);
    for (const restored of [[], [Area.of([TilePosition.at(0, 0)])], [everywhere]])
      expect(
        drawn(level, restored)
          .filter((art) => gateFrames.includes(art))
          .every((art) => art === library.gateArt.open),
      ).toBe(true);
    expect(drawn(level).filter((art) => art === library.gateArt.open).length).toBeGreaterThan(0);
  });

  test('joins the fences on both sides to the gate', () => {
    const shown = drawn(gated());
    expect(shown).toContain(library.fenceArt[0b0001]);
    expect(shown).toContain(library.fenceArt[0b0010]);
  });
});

test('a boulder hides the orb it rolls onto, while sliding and once it rests', () => {
  const layout = ['.DDD.', '.....', '..Q..', '..O..', '..H..', '.....'];
  const level = levelFromLayout(
    LevelId.of('rolled'),
    layout,
    (spots) => spots,
    check2dObstacles,
    () => 0,
  );
  const item = library.orbFrames.red[0]!;
  level.grip();
  level.tick(Heading.of(Direction.Up));
  for (const ticks of [8, 8]) {
    for (let tick = 0; tick < ticks; tick++) level.tick(null);
    const view = levelView(level);
    const picture = new Picture(224, 224);
    const draw = vi.spyOn(picture, 'draw');
    new WorldPainter(view).paint(picture, { level: view, frame: 0, hero: library.heroArt.up.stand }, []);
    const drawn = draw.mock.calls.map(([art]) => art);
    expect(drawn.indexOf(library.boulderArt)).toBeGreaterThan(drawn.indexOf(item));
  }
});

describe('frogs', () => {
  const seeded = (seed: number) => (): number => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pond = levelView(
    Level.create({
      id: LevelId.of('pond'),
      scenery: Scenery.of(
        LevelSize.of(12, 12),
        Array.from({ length: 12 }, (_, row) =>
          Array.from({ length: 12 }, () => (row < 4 ? Ground.Grass : Ground.Water)),
        ),
        [],
        [],
        [],
        FlowerVariant.All,
      ),
      stones: [],
      orbs: [Orb.at(TilePosition.at(0, 0), 4, LevelSize.of(12, 12))],
      door: Door.closedAt(TilePosition.at(9, 0)),
      hero: { position: TilePosition.at(2, 2), facing: Direction.Down },
      obstacles: check2dObstacles,
    }),
  );
  const ponds = Array.from({ length: 40 }, (_, seed) => dressWorld(pond, seeded(seed + 1)));

  test('frogs are drawn in color and never in the faded world', () => {
    const seed = ponds.findIndex(({ frogs }) => frogs.length > 0) + 1;
    const frog = dressWorld(pond, seeded(seed)).frogs[0]!;
    const frame = frog.cycle - frog.phase;
    const frogArts = new Set<Art>(
      Object.values(library.frogArt).flatMap(({ sit, croak, leap }) => [...sit, ...croak, ...leap]),
    );
    const drawnFrogs = (restored: readonly Area[]): number => {
      const picture = new Picture(12 * tileSize, 12 * tileSize);
      const draw = vi.spyOn(picture, 'draw');
      new WorldPainter(pond, seeded(seed)).paint(
        picture,
        { level: pond, frame, hero: sprites.heroArt.down.stand },
        restored,
      );
      return draw.mock.calls.filter(([art]) => frogArts.has(art)).length;
    };
    expect(drawnFrogs([everywhere])).toBeGreaterThan(0);
    expect(drawnFrogs([])).toBe(0);
  });
});
