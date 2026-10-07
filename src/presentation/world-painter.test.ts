import { describe, expect, test, vi } from 'vitest';
import { levelView } from '../application/level-view';
import { Area, Orb, OrbColor } from '../domain/level/collectibles';
import { Door } from '../domain/level/door';
import { HeroState } from '../domain/level/hero';
import { Level, Stone } from '../domain/level/level';
import { LevelId } from '../domain/shared/level-id';
import { Direction, Heading, TilePosition, WorldPosition } from '../domain/level/position';
import { Flower, FlowerVariant, Ground, LevelSize, Scenery, Tree, TreeVariant } from '../domain/level/scenery';
import type { Signpost } from '../domain/level/signpost';
import { check2dObstacles } from '../infrastructure/check2d-obstacles';
import { firstLevel } from '../infrastructure/first-level';
import { randomShuffle } from '../infrastructure/random-shuffle';
import { secondLevel } from '../infrastructure/second-level';
import type { Art } from './art/art';
import * as library from './sprite-library';
import { faded, palette, type PaletteCode } from './palette';
import { Picture, sprite, type Version } from './picture';
import { cameraPosition, heroPixels, tileSize } from './world-geometry';
import { propVariants, WorldPainter } from './world-painter';
import { closingLength, restorationLength } from './world-transition';

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
};
const sprites = {
  heroArt: library.heroArt,
  orbArt: library.orbArt,
  starArt: library.starArt,
  stoneVariants: library.stoneVariants,
  signpostArt: library.signpostArt,
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
  color = OrbColor.Violet,
  hero = TilePosition.at(2, 2),
  stones: readonly Stone[] = [],
  trees: readonly Tree[] = [],
  flowers: readonly Flower[] = [],
  flowerVariants: readonly FlowerVariant[] = FlowerVariant.All,
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
    orbs: [Orb.at(TilePosition.at(0, 0), color, everywhere)],
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

async function checksum(picture: Picture): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', picture.pixels.slice());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

const exitSignCases = [
  { name: 'first, right-side', create: firstLevel, version: 'faded' },
  { name: 'first, right-side', create: firstLevel, version: 'colored' },
  { name: 'second, left-side', create: secondLevel, version: 'faded' },
  { name: 'second, left-side', create: secondLevel, version: 'colored' },
] as const;

function isolatedSign(level: Level, signpost: Signpost, version: Version) {
  const view = levelView(level);
  const width = view.scenery.size.columns * tileSize;
  const height = view.scenery.size.rows * tileSize;
  const actual = new Picture(width, height);
  const expected = new Picture(width, height);
  const scene = { level: view, frame: 0, hero: sprites.heroArt.down.stand, heldOrb: null };
  const restored = version === 'colored' ? [level.orbs[0]!.restores] : [];
  const withoutSigns = { ...view, signposts: [] };
  new WorldPainter(withoutSigns).paint(expected, { ...scene, level: withoutSigns }, restored);
  const withSign = { ...view, signposts: [signpost] };
  new WorldPainter(withSign).paint(actual, { ...scene, level: withSign }, restored);
  const camera = cameraPosition(view, width, height);
  return {
    actual,
    expected,
    x: signpost.position.column * tileSize - camera.x,
    y: signpost.position.row * tileSize - camera.y,
  };
}

function expectSignPixels(actual: Picture, expected: Picture, x: number, top: number, bottom: number): void {
  const mismatches: string[] = [];
  for (let row = top; row < bottom; row++) {
    for (let column = x; column < x + tileSize; column++) {
      const offset = (row * actual.width + column) * 4;
      if (
        actual.pixels.subarray(offset, offset + 4).some((channel, index) => channel !== expected.pixels[offset + index])
      )
        mismatches.push(`${column},${row}`);
    }
  }
  expect(mismatches, 'rendered sign, contact shadow and surrounding ground must match').toEqual([]);
}

test.each(exitSignCases)(
  'the $name exit sign touches the fence with its shadow attached when $version',
  ({ create, version }) => {
    const level = create((positions) => positions);
    const signpost = level.signposts.find((sign) => /ΠΥΛ/.test(sign.text.value))!;
    const { actual, expected, x, y } = isolatedSign(level, signpost, version);
    const fencePosition = signpost.position.neighbor(Direction.Up);
    const fence = level.scenery.fences.find((piece) => piece.position.equals(fencePosition))!;
    expect(fence).toBeDefined();
    const draw = vi.spyOn(expected, 'draw');
    const view = { ...levelView(level), signposts: [] };
    new WorldPainter(view).paint(
      expected,
      { level: view, frame: 0, hero: sprites.heroArt.down.stand, heldOrb: null },
      version === 'colored' ? [level.orbs[0]!.restores] : [],
    );
    const fenceDrawing = draw.mock.calls.find(
      ([art, column, row]) => scenery.fenceArt.includes(art) && column === x && row === y - tileSize,
    )!;
    expect(fenceDrawing).toBeDefined();
    const fenceSprite = sprite(fenceDrawing[0]);
    const fenceRows = Array.from({ length: fenceSprite.height }, (_, row) => row).filter(
      (row) => fenceSprite[version][(row * fenceSprite.width + tileSize / 2) * 4 + 3] !== 0,
    );
    const fenceBottom = y - tileSize + Math.max(...fenceRows);
    const signRows = sprites.signpostArt.rows
      .map((row, index) => (row.includes('k') ? index : -1))
      .filter((row) => row >= 0);
    const top = fenceBottom - Math.min(...signRows);
    expect(
      colorAt(actual, x + tileSize / 2, fenceBottom),
      'the top outline must meet the lowest opaque fence row without padding leaving a gap',
    ).toBe(palette.Ink);
    const surface = level.scenery.groundAt(signpost.position).equals(Ground.Path) ? 'E2' : 'G1';
    const shadow = sprites.groundShadow(10, surface);
    expected.draw(shadow, x + (tileSize - shadow.rows[0]!.length) / 2, top + Math.max(...signRows) + 1, version);
    expected.draw(sprites.signpostArt, x, top, version);
    expectSignPixels(actual, expected, x, y - tileSize, y + tileSize);
  },
);

test.each(exitSignCases)(
  'the $name ordinary orb hint keeps its grid position and contact shadow when $version',
  ({ create, version }) => {
    const level = create((positions) => positions);
    const signpost = level.signposts.find((sign) => /ΜΩΒ|ΤΥΡΚΟΥΑΖ/.test(sign.text.value))!;
    expect(level.scenery.fences.some((fence) => fence.position.equals(signpost.position.neighbor(Direction.Up)))).toBe(
      false,
    );
    const { actual, expected, x, y } = isolatedSign(level, signpost, version);
    const lastOpaqueRow = sprites.signpostArt.rows.findLastIndex((row) => row.includes('k'));
    const surface = level.scenery.groundAt(signpost.position).equals(Ground.Path) ? 'E2' : 'G1';
    const shadow = sprites.groundShadow(10, surface);
    expected.draw(shadow, x + (tileSize - shadow.rows[0]!.length) / 2, y + lastOpaqueRow + 1, version);
    expected.draw(sprites.signpostArt, x, y, version);
    expectSignPixels(actual, expected, x, y - tileSize, y + tileSize);
  },
);

test.each(exitSignCases)(
  'the $name fence-backed sign stays behind a hero in front of its visible base when $version',
  ({ create, version }) => {
    const level = create((positions) => positions);
    const signpost = level.signposts.find((sign) => /ΠΥΛ/.test(sign.text.value))!;
    const signView = { ...levelView(level), signposts: [signpost] };
    const picture = new Picture(level.scenery.size.columns * tileSize, (level.scenery.size.rows + 2) * tileSize);
    const restored = version === 'colored' ? [level.orbs[0]!.restores] : [];
    new WorldPainter(signView).paint(
      picture,
      { level: signView, frame: 0, hero: sprites.heroArt.down.stand, heldOrb: null },
      restored,
    );
    const camera = cameraPosition(signView, picture.width, picture.height);
    const x = signpost.position.column * tileSize - camera.x;
    const y = signpost.position.row * tileSize - camera.y;
    const visibleRows = Array.from({ length: tileSize * 2 }, (_, row) => y - tileSize + row).filter(
      (row) => colorAt(picture, x + tileSize / 2, row) === palette.Ink,
    );
    expect(visibleRows.length).toBeGreaterThan(0);
    const visibleBottom = Math.max(...visibleRows);
    const nominalBase = y + tileSize;
    const heroBase = Math.floor((visibleBottom + 1 + nominalBase) / 2);
    const view = {
      ...signView,
      hero: HeroState.of(
        WorldPosition.at(x + camera.x + tileSize / 2 + 8, heroBase + camera.y - 4),
        Direction.Down,
        false,
      ),
    };
    const actual = new Picture(picture.width, picture.height);
    new WorldPainter(view).paint(
      actual,
      { level: view, frame: 0, hero: sprites.heroArt.down.stand, heldOrb: null },
      restored,
    );
    const hero = heroPixels(view);
    const art = sprite(sprites.heroArt.down.stand);
    let overlaps = 0;
    for (let row = 0; row < art.height; row++) {
      for (let column = 0; column < art.width; column++) {
        const targetX = hero.x - camera.x + column;
        const targetY = hero.y - camera.y + row;
        if (targetX < x || targetX >= x + tileSize || targetY < Math.min(...visibleRows) || targetY > visibleBottom)
          continue;
        const source = (row * art.width + column) * 4;
        if (art.colored[source + 3] === 0) continue;
        const target = (targetY * actual.width + targetX) * 4;
        if (
          picture.pixels.subarray(target, target + 4).every((channel, index) => channel === art.colored[source + index])
        )
          continue;
        overlaps++;
        expect(
          [...actual.pixels.subarray(target, target + 4)],
          `hero pixel at ${targetX},${targetY} must be in front`,
        ).toEqual([...art.colored.subarray(source, source + 4)]);
      }
    }
    expect(overlaps, 'the fixture must include overlapping, visibly different hero and sign pixels').toBeGreaterThan(0);
  },
);

describe('whole frames of the first level', () => {
  const level = firstLevel((positions) => positions);
  const orb = level.orbs[0]!;
  const scene = { level, frame: 0, hero: sprites.heroArt.down.stand, heldOrb: null };
  const painter = new WorldPainter(level);
  const picture = new Picture(224, 320);

  test('renders the current fully faded fixture unchanged', async () => {
    painter.paint(picture, scene, []);
    expect(await checksum(picture)).toBe('d8589c3bf9973da56403203173343ecdc36e265b44195511494ac5965997bc84');
  });

  test('renders the current partially restored fixture unchanged', async () => {
    painter.paintRestoring(picture, scene, orb.position, 40, [], [orb.restores]);
    expect(await checksum(picture)).toBe('0b4d93e9aff64081b33cdcb2607d5c12ddb77d38f8087c7a6f0394f73fb3b986');
  });

  test('renders the current fully colored fixture unchanged', async () => {
    painter.paint(picture, scene, [orb.restores]);
    expect(await checksum(picture)).toBe('ed9d419c8166f3361daad5e04e704f7432196dd4b65770dc451b2515c0a7d2b9');
  });
});

test('every piece of art uses only its legend and keeps a rectangular shape', () => {
  const art = allArt({ ...scenery, ...sprites });
  expect(art.length).toBeGreaterThan(100);
  for (const piece of art) expect(() => sprite(piece)).not.toThrow();
});

test('the first level has ground art for every place where terrains meet', () => {
  expect(() => new WorldPainter(firstLevel(randomShuffle))).not.toThrow();
});

test('native terrain grids cover all 81 three-terrain corner combinations', () => {
  expect(Object.keys(scenery.terrainArt)).toHaveLength(81);
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
            orbs: [Orb.at(TilePosition.at(3, 3), OrbColor.Violet, everywhere)],
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

test('native interactive sprites use their documented dimensions and distinct orb symbols', () => {
  for (const art of allArt(sprites.heroArt)) {
    expect(sprite(art).width).toBe(32);
    expect(sprite(art).height).toBe(32);
  }
  for (const art of sprites.stoneVariants) expect([sprite(art).width, sprite(art).height]).toEqual([32, 32]);
  for (const art of Object.values(sprites.orbArt)) expect([sprite(art).width, sprite(art).height]).toEqual([24, 24]);
  expect(new Set(Object.values(sprites.orbArt).map((art) => art.rows.join('\n'))).size).toBe(4);
});

test('interactive sprites keep a closed one-pixel Ink silhouette', () => {
  const art: readonly Art[] = [
    ...[sprites.heroArt.down, sprites.heroArt.up, sprites.heroArt.left, sprites.heroArt.right].flatMap((direction) => [
      direction.stand,
      direction.breathe,
      ...direction.walk,
      direction.holding!,
    ]),
    ...sprites.stoneVariants,
    ...Object.values(sprites.orbArt),
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
  new WorldPainter(level).paint(picture, { level, frame, hero: sprites.heroArt.down.stand, heldOrb: null }, [
    level.orbs[0]!.restores,
  ]);
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
  expect(level.scenery.flowers).toHaveLength(25);
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
  const level = renderingLevel(Ground.Grass, OrbColor.Violet, TilePosition.at(2, 2), [], [], flowers, [
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
  new WorldPainter(level).paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand, heldOrb: null }, [
    level.orbs[0]!.restores,
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
  expect(touchingPairs).toBe(3);
});

test.each([
  [Ground.Grass, 'G1', 'N2'],
  [Ground.Path, 'E2', 'N3'],
] as const)('contact shadows on %s use the surface shade in both world versions', (ground, colored, neutral) => {
  const level = renderingLevel(ground, OrbColor.Violet, TilePosition.at(2, 2), [Stone.at(TilePosition.at(4, 4))]);
  const painter = new WorldPainter(level);
  for (const [restored, code] of [
    [[everywhere], colored],
    [[], neutral],
  ] as const) {
    const picture = new Picture(384, 384);
    painter.paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand, heldOrb: null }, restored);
    expect(colorAt(picture, 73, 160)).toBe(palette[code]);
    expect(colorAt(picture, 137, 219)).toBe(palette[code]);
  }
  const shadow = sprites.groundShadow(14, colored);
  expect(shadow.rows.map((row) => row.replaceAll('.', '').length)).toEqual([14, 10, 10, 10, 6]);
});

test.each([
  [OrbColor.Red, 'R2'],
  [OrbColor.Blue, 'W2'],
  [OrbColor.Violet, 'V2'],
  [OrbColor.Teal, 'T2'],
] as const)('%s orbs keep their actual color both on the ground and above the hero', (color, code) => {
  const level = renderingLevel(Ground.Grass, color);
  const painter = new WorldPainter(level);
  const picture = new Picture(384, 384);
  painter.paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand, heldOrb: null }, []);
  expect(colorAt(picture, 20, 74)).toBe(palette[code]);
  painter.paint(picture, { level, frame: 0, hero: sprites.heroArt.down.holding!, heldOrb: color }, []);
  expect(colorAt(picture, 84, 116)).toBe(palette[code]);
});

test('oversized views extend edge terrain without leaving empty map margins', () => {
  const level = renderingLevel();
  const picture = new Picture(801, 901);
  new WorldPainter(level).paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand, heldOrb: null }, [
    everywhere,
  ]);
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
    const level = renderingLevel(Ground.Grass, OrbColor.Violet, position);
    const picture = new Picture(225, 263);
    const draw = vi.spyOn(picture, 'draw');
    new WorldPainter(level).paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand, heldOrb: null }, [
      everywhere,
    ]);
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
    const level = renderingLevel(Ground.Grass, OrbColor.Violet, hero, [], [tree]);
    const picture = new Picture(384, 384);
    const draw = vi.spyOn(picture, 'draw');
    new WorldPainter(level).paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand, heldOrb: null }, [
      everywhere,
    ]);
    const heroIndex = draw.mock.calls.findIndex(([art]) => art === sprites.heroArt.down.stand);
    const treeIndex = draw.mock.calls.findIndex(([art]) => art.legend.t === 'E1');
    expect(treeIndex > heroIndex).toBe(treeLast);
  }
});

test('restoration advances outward with palette-only pixels and matches both endpoint worlds', () => {
  const level = renderingLevel();
  const painter = new WorldPainter(level);
  const scene = { level, frame: 0, hero: sprites.heroArt.down.stand, heldOrb: null };
  const origin = TilePosition.at(2, 2);
  const colored = new Picture(224, 224);
  const neutral = new Picture(224, 224);
  const dissolve = new Picture(224, 224);
  painter.paint(colored, scene, [everywhere]);
  painter.paint(neutral, scene, []);
  painter.paintRestoring(dissolve, scene, origin, -1, [], [everywhere]);
  expect(dissolve.pixels).toEqual(neutral.pixels);
  painter.paintRestoring(
    dissolve,
    scene,
    origin,
    restorationLength(scene.level.scenery.size, origin),
    [],
    [everywhere],
  );
  expect(dissolve.pixels).toEqual(colored.pixels);
  const colors = new Set(Object.values(palette));
  for (const frame of [0, 3, 4, 15, 16, 31]) {
    painter.paintRestoring(dissolve, scene, origin, frame, [], [everywhere]);
    for (let row = 0; row < dissolve.height; row++) {
      for (let column = 0; column < dissolve.width; column++) {
        expect(colors.has(colorAt(dissolve, column, row))).toBe(true);
        expect(dissolve.pixels[(row * dissolve.width + column) * 4 + 3]).toBe(255);
      }
    }
  }
  painter.paintRestoring(dissolve, scene, origin, 0, [], [everywhere]);
  expect(colorAt(dissolve, 64, 96)).toBe(colorAt(colored, 64, 96));
  expect(colorAt(dissolve, 32, 64)).toBe(colorAt(neutral, 32, 64));
});

test('restoring one area leaves the rest of the map faded', () => {
  const level = Level.create({
    id: LevelId.of('areas'),
    scenery: Scenery.of(
      LevelSize.of(12, 12),
      Array.from({ length: 12 }, () => Array<Ground>(12).fill(Ground.Grass)),
      [],
      [],
    ),
    stones: [],
    orbs: [
      Orb.at(TilePosition.at(0, 0), OrbColor.Red, leftHalf),
      Orb.at(TilePosition.at(11, 1), OrbColor.Blue, rightHalf),
    ],
    door: Door.closedAt(TilePosition.at(9, 0)),
    hero: { position: TilePosition.at(2, 2), facing: Direction.Down },
    obstacles: check2dObstacles,
  });
  const painter = new WorldPainter(level);
  const painted = (restored: readonly Area[]): Picture => {
    const picture = new Picture(384, 384);
    painter.paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand, heldOrb: null }, restored);
    return picture;
  };
  const grass = (['G1', 'G2', 'G3'] as const).map((code) => palette[code]);
  const neutrals = (['N1', 'N2', 'N3', 'N4', 'Paper'] as const).map((code) => palette[code]);
  const left = painted([leftHalf]);
  expect(grass).toContain(colorAt(left, 120, 200));
  expect(neutrals).toContain(colorAt(left, 300, 200));
  const right = painted([rightHalf]);
  expect(neutrals).toContain(colorAt(right, 120, 200));
  expect(grass).toContain(colorAt(right, 300, 200));
  expect(painted([leftHalf, rightHalf]).pixels).toEqual(painted([everywhere]).pixels);
});

function treeArtDrawn(trees: readonly Tree[]): (tree: Tree) => Art | undefined {
  const level = renderingLevel(Ground.Grass, OrbColor.Violet, TilePosition.at(2, 2), [], trees);
  const picture = new Picture(384, 384);
  const draw = vi.spyOn(picture, 'draw');
  new WorldPainter(level).paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand, heldOrb: null }, [
    everywhere,
  ]);
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
    orbs: [Orb.at(TilePosition.at(0, 0), OrbColor.Violet, everywhere)],
    door: Door.closedAt(TilePosition.at(9, 0)),
    hero: { position: TilePosition.at(2, 2), facing: Direction.Down },
    obstacles: check2dObstacles,
  });
  const picture = new Picture(384, 384);
  const draw = vi.spyOn(picture, 'draw');
  new WorldPainter(level).paint(picture, { level, frame: 0, hero: sprites.heroArt.down.stand, heldOrb: null }, [
    everywhere,
  ]);
  const flowerFrames = scenery.flowerArt.flat();
  const drawn = draw.mock.calls.map(([art]) => art).filter((art) => flowerFrames.includes(art));
  expect(drawn).toHaveLength(3);
  expect(drawn[0]).not.toBe(drawn[1]);
  expect(drawn[1]).not.toBe(drawn[2]);
  for (const art of flowerFrames) expect(art.rows.join('\n').match(/(?<!d)ddd(?!d)/g)).toHaveLength(4);
});

test('the door is drawn open only in the colored world once the orb is collected', () => {
  const level = renderingLevel(Ground.Grass, OrbColor.Violet, TilePosition.at(1, 0));
  const painter = new WorldPainter(level);
  const drawn = (version: 'colored' | 'faded'): Art[] => {
    const picture = new Picture(384, 384);
    const draw = vi.spyOn(picture, 'draw');
    painter.paint(
      picture,
      { level, frame: 0, hero: sprites.heroArt.down.stand, heldOrb: null },
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
  const level = renderingLevel(Ground.Grass, OrbColor.Violet, TilePosition.at(10, 1));
  const picture = new Picture(224, 224);
  const draw = vi.spyOn(picture, 'draw');
  new WorldPainter(level).paint(picture, { level, frame: 0, hero: sprites.heroArt.up.stand, heldOrb: null }, [
    everywhere,
  ]);
  const door = draw.mock.calls.find(([art]) => art === scenery.doorArt.closed);
  expect(door).toBeDefined();
  expect(door![2]).toBeGreaterThanOrEqual(0);
});

test('closing darkens the colored world to Ink through the ordered dither', () => {
  const level = renderingLevel();
  const painter = new WorldPainter(level);
  const scene = { level, frame: 0, hero: sprites.heroArt.down.stand, heldOrb: null };
  const colored = new Picture(224, 224);
  const closing = new Picture(224, 224);
  painter.paint(colored, scene, [everywhere]);
  painter.paintClosing(closing, scene, 0);
  expect(closing.pixels).toEqual(colored.pixels);
  painter.paintClosing(closing, scene, closingLength);
  for (let row = 0; row < closing.height; row++) {
    for (let column = 0; column < closing.width; column++) expect(colorAt(closing, column, row)).toBe(palette.Ink);
  }
});

test('every palette step fades to a neutral while neutrals preserve their values', () => {
  const neutrals = ['Ink', 'N1', 'N2', 'N3', 'N4', 'Paper'];
  for (const code of Object.keys(palette) as (keyof typeof palette)[]) {
    expect(neutrals).toContain(faded(code));
    if (neutrals.includes(code)) expect(faded(code)).toBe(code);
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
    orbs: [Orb.at(TilePosition.at(0, 0), OrbColor.Violet, everywhere)],
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
