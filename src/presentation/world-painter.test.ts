/// <reference types="node" />
import { mkdirSync, writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';
import { describe, expect, test, vi } from 'vitest';
import { levelView } from '../application/level-view';
import { Area, Key, KeyMaterial } from '../domain/level/collectibles';
import { Door } from '../domain/level/door';
import { Level, Stone } from '../domain/level/level';
import { LevelId } from '../domain/shared/level-id';
import { HeroState } from '../domain/level/hero';
import { Direction, Heading, TilePosition, WorldPosition } from '../domain/level/position';
import { Flower, FlowerVariant, Ground, LevelSize, Scenery, Tree, TreeVariant } from '../domain/level/scenery';
import { check2dObstacles } from '../infrastructure/check2d-obstacles';
import { firstLevel } from '../infrastructure/first-level';
import { levelFromLayout } from '../infrastructure/level-layout';
import { randomShuffle } from '../infrastructure/random-shuffle';
import { secondLevel } from '../infrastructure/second-level';
import { thirdLevel } from '../infrastructure/third-level';
import { fourthLevel } from '../infrastructure/fourth-level';
import { fifthLevel } from '../infrastructure/fifth-level';
import { pixelDifference } from '../test-support/pictures';
import type { Art } from './art/art';
import * as library from './sprite-library';
import { faded, lighter, palette, type PaletteCode } from './palette';
import { lighten, Picture, sprite } from './picture';
import { cameraPosition, heroPixels, tileSize } from './world-geometry';
import { arrivalMotes, risingEdge } from './arrival';
import { keyOffset, propVariants, WorldPainter } from './world-painter';
import { closingLength, crestLength, restorationAge, restorationLength } from './world-transition';

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
  keyArt: library.keyArt,
  starArt: library.starArt,
  stoneVariants: library.stoneVariants,
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

function renderingLevel(
  ground = Ground.Grass,
  hero = TilePosition.at(2, 2),
  stones: readonly Stone[] = [],
  trees: readonly Tree[] = [],
  flowers: readonly Flower[] = [],
  flowerVariants: readonly FlowerVariant[] = FlowerVariant.All,
  keyMaterial: KeyMaterial = KeyMaterial.Gold,
): Level {
  return Level.create({
    id: LevelId.of('render'),
    scenery: Scenery.of(
      LevelSize.of(12, 12),
      Array.from({ length: 12 }, () => Array.from({ length: 12 }, () => ground)),
      trees,
      flowers,
      [],
      flowerVariants,
    ),
    stones,
    keys: [Key.at(TilePosition.at(0, 0), everywhere, keyMaterial)],
    door: Door.closedAt(TilePosition.at(9, 0)),
    hero: { position: hero, facing: Direction.Down },
    obstacles: check2dObstacles,
  });
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

function png(picture: Picture): Buffer {
  const chunk = (type: string, data: Buffer): Buffer => {
    const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const framed = Buffer.alloc(typed.length + 8);
    framed.writeUInt32BE(data.length, 0);
    typed.copy(framed, 4);
    framed.writeUInt32BE(crc32(typed), typed.length + 4);
    return framed;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(picture.width, 0);
  header.writeUInt32BE(picture.height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const stride = picture.width * 4;
  const rows = Buffer.alloc((stride + 1) * picture.height);
  for (let row = 0; row < picture.height; row++)
    rows.set(picture.pixels.subarray(row * stride, (row + 1) * stride), row * (stride + 1) + 1);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// A hash alone cannot show what changed, so a mismatch leaves the actual frame behind for inspection.
async function expectChecksum(picture: Picture, expected: string): Promise<void> {
  const actual = await checksum(picture);
  if (actual === expected) return;
  const directory = new URL('../../test-output/', import.meta.url);
  const name = `${(expect.getState().currentTestName ?? 'frame').replace(/[^a-z0-9]+/gi, '-')}.png`;
  mkdirSync(directory, { recursive: true });
  const file = new URL(name, directory);
  writeFileSync(file, png(picture));
  expect(actual, `actual frame written to ${decodeURIComponent(file.pathname)}`).toBe(expected);
}

describe('whole frames of the first level', () => {
  // The frame shows only the lower right of the level, so the stars must come from spots inside it to be drawn at all.
  const inFrame = (tile: TilePosition): boolean => tile.column >= 10 && tile.row >= 7;
  const level = firstLevel((positions) => [
    ...positions.filter(inFrame),
    ...positions.filter((tile) => !inFrame(tile)),
  ]);
  const key = level.keys[0]!;
  const scene = { level, frame: 0, hero: sprites.heroArt.down.stand };
  const painter = new WorldPainter(level);
  const picture = new Picture(224, 320);

  test('renders the current fully faded fixture unchanged', async () => {
    painter.paint(picture, scene, []);
    await expectChecksum(picture, '29af94bf954bd5099f15e95d6b0253598a8ac1742fc6cdbad974a0e823a925eb');
  });

  test('renders the current partially restored fixture unchanged', async () => {
    // The key lies outside the frame, so the wave starts from her start to stop partway across the frame.
    painter.paintRestoring(picture, scene, level.hero.position, 20, [], [key.restores]);
    await expectChecksum(picture, 'eba04be42a1b55c13e7965ba9287b3b4400b162ace7096451616ab912be9704d');
  });

  test('renders the current fully colored fixture unchanged', async () => {
    painter.paint(picture, scene, [key.restores]);
    await expectChecksum(picture, '6042ef581603be3c4931bd965a61747d7749a26d5c8d2277fab728c83c079d16');
  });
});

test('every piece of art uses only its legend and keeps a rectangular shape', () => {
  const art = allArt({ ...scenery, ...sprites });
  expect(art.length).toBeGreaterThan(100);
  for (const piece of art) expect(() => sprite(piece)).not.toThrow();
});

test.each([
  { name: 'first', create: firstLevel },
  { name: 'second', create: secondLevel },
  { name: 'third', create: thirdLevel },
  { name: 'fourth', create: fourthLevel },
  { name: 'fifth', create: fifthLevel },
])('the $name level has ground art for every place where terrains meet and paints', ({ create }) => {
  const level = levelView(create(randomShuffle));
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
            keys: [Key.at(TilePosition.at(3, 3), everywhere)],
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
  for (const art of sprites.stoneVariants) expect([sprite(art).width, sprite(art).height]).toEqual([32, 32]);
  for (const art of Object.values(sprites.keyArt)) expect([sprite(art).width, sprite(art).height]).toEqual([24, 24]);
});

test('interactive sprites keep a closed one-pixel Ink silhouette', () => {
  const art: readonly Art[] = [
    ...[sprites.heroArt.down, sprites.heroArt.up, sprites.heroArt.left, sprites.heroArt.right].flatMap((direction) => [
      direction.stand,
      direction.breathe,
      ...direction.walk,
    ]),
    ...sprites.stoneVariants,
    ...Object.values(sprites.keyArt),
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

test('touching prop variants differ and placement is independent of input order', () => {
  const positions = [TilePosition.at(0, 0), TilePosition.at(1, 0), TilePosition.at(0, 1), TilePosition.at(1, 1)];
  const variants = propVariants(
    positions.map((position) => [position]),
    5,
  );
  for (let first = 0; first < positions.length; first++) {
    for (let second = first + 1; second < positions.length; second++) {
      if (
        Math.abs(positions[first]!.column - positions[second]!.column) +
          Math.abs(positions[first]!.row - positions[second]!.row) ===
        1
      ) {
        expect(variants[first]).not.toBe(variants[second]);
      }
    }
  }
  expect(
    propVariants(
      positions.toReversed().map((position) => [position]),
      5,
    ).toReversed(),
  ).toEqual(variants);
});

function flowerArtDrawn(level: Level, frame: number): Art[] {
  const picture = new Picture(level.scenery.size.columns * tileSize, level.scenery.size.rows * tileSize);
  const camera = cameraPosition(level, picture.width, picture.height);
  const draw = vi.spyOn(picture, 'draw');
  new WorldPainter(level).paint(picture, { level, frame, hero: sprites.heroArt.down.stand }, [level.keys[0]!.restores]);
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
  const level = firstLevel((positions) => positions);
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
  const level = firstLevel((positions) => positions);
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
  const level = firstLevel((positions) => positions);
  const picture = new Picture(level.scenery.size.columns * tileSize, level.scenery.size.rows * tileSize);
  const camera = cameraPosition(level, picture.width, picture.height);
  const draw = vi.spyOn(picture, 'draw');
  new WorldPainter(level).paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand }, [
    level.keys[0]!.restores,
  ]);
  return level.stones.map(({ position }) => {
    const calls = draw.mock.calls.filter(
      ([art, column, row]) =>
        sprites.stoneVariants.includes(art) &&
        column === position.column * tileSize - camera.x &&
        row === position.row * tileSize - camera.y,
    );
    expect(calls).toHaveLength(1);
    return { position, art: calls[0]![0] };
  });
}

test.each([firstLevel, secondLevel, thirdLevel, fourthLevel, fifthLevel])(
  'level %# floats lilies in groups inside its pond, with different art on touching tiles',
  (create) => {
    const level = create((positions) => positions);
    const picture = new Picture(level.scenery.size.columns * tileSize, level.scenery.size.rows * tileSize);
    const camera = cameraPosition(level, picture.width, picture.height);
    const draw = vi.spyOn(picture, 'draw');
    let seed = 7;
    const random = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647;
    new WorldPainter(level, random).paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand }, [
      level.keys[0]!.restores,
    ]);
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

test.each([
  ['gold', KeyMaterial.Gold, ['Y1', 'Y2', 'Y3']],
  ['silver', KeyMaterial.Silver, ['N3', 'N4', 'W4']],
] as const)('a %s key keeps its metal in a faded world', (_, material, codes) => {
  const level = renderingLevel(Ground.Grass, undefined, [], [], [], FlowerVariant.All, material);
  const picture = new Picture(384, 384);
  new WorldPainter(level).paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand }, []);
  const metal = [...sprites.keyArt.gold.rows.join('')].filter((symbol) => symbol !== '.' && symbol !== 'k').length;
  const camera = cameraPosition(level, picture.width, picture.height);
  const art = sprite(sprites.keyArt[material.name]).colored;
  let shown = 0;
  for (let y = 0; y < 24; y++)
    for (let x = 0; x < 24; x++) {
      if (art[(y * 24 + x) * 4 + 3] === 0 || sprites.keyArt.gold.rows[y]![x] === 'k') continue;
      const color = colorAt(picture, 4 + x - camera.x, 4 + y - camera.y);
      if (codes.some((code) => palette[code] === color)) shown++;
    }
  expect(shown).toBe(metal);
});

test('gold and silver keys share one pixel grid and differ only in their metal colors', () => {
  const { gold, silver } = sprites.keyArt;
  expect(silver.rows).toBe(gold.rows);
  expect(silver.legend.k).toBe(gold.legend.k);
  for (const symbol of ['a', 'b', 'c']) expect(silver.legend[symbol]).not.toBe(gold.legend[symbol]);
});

test('a key floats and buzzes within two pixels up and down and one pixel sideways', () => {
  const offsets = Array.from({ length: 400 }, (_, frame) => keyOffset(frame));
  expect(Math.min(...offsets.map(({ y }) => y))).toBe(-2);
  expect(Math.max(...offsets.map(({ y }) => y))).toBe(2);
  expect(Math.min(...offsets.map(({ x }) => x))).toBe(-1);
  expect(Math.max(...offsets.map(({ x }) => x))).toBe(1);
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
    keys: [Key.at(TilePosition.at(0, 0), leftHalf), Key.at(TilePosition.at(11, 1), rightHalf)],
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

test.each([
  { side: 'outside', from: seamEdge + 2 * tileSize, to: overview.width, expected: 'faded' },
  { side: 'inside', from: 0, to: seamEdge - 2 * tileSize, expected: 'colored' },
] as const)('two tiles or more $side a straight restored edge the picture is entirely $expected', (zone) => {
  const { faded, colored, seam } = seamFixture();
  const expected = zone.expected === 'faded' ? faded : colored;
  let differing = 0;
  let wrong = 0;
  for (let y = 0; y < seam.height; y++) {
    for (let x = zone.from; x < zone.to; x++) {
      const index = y * seam.width + x;
      if (faded.packedPixels[index] !== colored.packedPixels[index]) differing++;
      if (seam.packedPixels[index] !== expected.packedPixels[index]) wrong++;
    }
  }
  expect(differing, 'the zone must hold pixels that tell the faded and colored pictures apart').toBeGreaterThan(
    (seam.height * (zone.to - zone.from)) / 2,
  );
  expect(wrong).toBe(0);
});

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
    {
      keys: {
        K: { restores: inRed },
        S: { restores: (position) => !inRed(position), material: KeyMaterial.Silver },
      },
    },
  );
  const [red, blue] = level.keys.map((key) => key.restores) as [Area, Area];
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
  'frame %i of a wave over the right half of the map holds only palette colors',
  (framesSinceStart) => {
    const wave = halfMapWave().frame(framesSinceStart);
    expect(wave.packedPixels.filter((pixel) => !codeOfPacked.has(pixel))).toHaveLength(0);
  },
);

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

function treeArtDrawn(trees: readonly Tree[]): (tree: Tree) => Art | undefined {
  const level = renderingLevel(Ground.Grass, TilePosition.at(2, 2), [], trees);
  const picture = new Picture(384, 384);
  const draw = vi.spyOn(picture, 'draw');
  new WorldPainter(level).paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand }, [everywhere]);
  const frames = [...scenery.treeArt.flat(), ...Object.values(scenery.fruitTreeArt).flat()];
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
  const [first, second] = trees.map((tree) => scenery.treeArt.findIndex((frames) => frames.includes(drawn(tree)!)));
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

test('flowers stacked above each other use different variants, each with a ground shadow under every stem', () => {
  const flowers = [
    Flower.at(TilePosition.at(4, 4)),
    Flower.at(TilePosition.at(4, 5)),
    Flower.at(TilePosition.at(4, 6)),
  ];
  const level = Level.create({
    id: LevelId.of('flowers'),
    scenery: Scenery.of(
      LevelSize.of(12, 12),
      Array.from({ length: 12 }, () => Array.from({ length: 12 }, () => Ground.Grass)),
      [],
      flowers,
    ),
    stones: [],
    keys: [Key.at(TilePosition.at(0, 0), everywhere)],
    door: Door.closedAt(TilePosition.at(9, 0)),
    hero: { position: TilePosition.at(2, 2), facing: Direction.Down },
    obstacles: check2dObstacles,
  });
  const picture = new Picture(384, 384);
  const draw = vi.spyOn(picture, 'draw');
  new WorldPainter(level).paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand }, [everywhere]);
  const flowerFrames = scenery.flowerArt.flat();
  const drawn = draw.mock.calls.map(([art]) => art).filter((art) => flowerFrames.includes(art));
  expect(drawn).toHaveLength(3);
  expect(drawn[0]).not.toBe(drawn[1]);
  expect(drawn[1]).not.toBe(drawn[2]);
});

test('the door is drawn open only in the colored world once the key is collected', () => {
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
  expect(level.keys).toEqual([]);
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
    keys: [Key.at(TilePosition.at(0, 0), everywhere)],
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
  const base = firstLevel((positions) => positions);
  const level = { ...levelView(base), hero: HeroState.of(WorldPosition.at(x, y), Direction.Down, false) };
  const picture = new Picture(224, 224);
  const camera = cameraPosition(level, picture.width, picture.height);
  const draw = vi.spyOn(picture, 'draw');
  new WorldPainter(level).paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand }, []);
  const covered = new Uint8Array(picture.width * picture.height);
  const trees = scenery.treeArt.flat();
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
  const trees = [...scenery.treeArt.flat(), ...Object.values(scenery.fruitTreeArt).flat()];
  expect(draw.mock.calls.filter(([art]) => trees.includes(art))).toHaveLength(level.scenery.trees.length);
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

test.each([0, 8, 15])('an arriving hero shows no pixels and no shadow at age %i', (age) => {
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

test.each([0, 1, 2, 15, 16, 30, 39, 40, 47, 48])(
  'arrival motes at age %i are drawn at their offsets from the hero',
  (age) => {
    expect(arrivalDraws(age).motes).toEqual(arrivalMotes(age));
  },
);

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
    levelFromLayout(LevelId.of('gated'), ['.DDD.', '..K..', '.....', 'WFGFW', '..H..', '.....'], (spots) => spots, {
      keys: { K: { restores: () => true } },
    });
  const drawn = (level: Level, gateAge?: number, restored: readonly Area[] = []) => {
    const picture = new Picture(160, 192);
    const draw = vi.spyOn(picture, 'draw');
    const view = levelView(level);
    new WorldPainter(view).paint(
      picture,
      { level: view, frame: 0, hero: library.heroArt.up.stand, ...(gateAge === undefined ? {} : { gateAge }) },
      restored,
    );
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
    const shown = drawn(level, age);
    expect(shown.filter((art) => gateFrames.includes(art))).toEqual([library.gateArt.opening[index]]);
  });

  test('keeps the parked leaf once open, also after color returns', () => {
    const level = gated();
    level.operateGate();
    level.finishGate();
    for (const restored of [[], [Area.of([TilePosition.at(0, 0)])], [everywhere]])
      expect(
        drawn(level, undefined, restored)
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

test.each([
  ['star', 'K..', '..+'],
  ['key', '...', '..K'],
])('a boulder hides the %s it rolls onto, while sliding and once it rests', (_, keyRow, itemRow) => {
  // A level needs fifteen star spots, so rows of spare spots sit below the ones under test.
  const layout = ['.DDD.', `${keyRow}..`, `${itemRow}..`, '..O..', '..H..', '.....', '+++++', '+++++', '+++++'];
  const level = levelFromLayout(LevelId.of('rolled'), layout, (spots) => spots, {
    keys: { K: { restores: () => true } },
  });
  const item = itemRow.endsWith('+') ? library.starArt : library.keyArt.gold;
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
