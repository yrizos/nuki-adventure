import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, test } from 'vitest';
import { sprite } from './picture';
import {
  flowerArt,
  fruitTreeArt,
  orbArt,
  orbFrameLength,
  orbFrames,
  orbHues,
  readSprite,
  smallPadlockArt,
  sprites,
  terrainArt,
  treeArt,
  waterFrameLength,
} from './sprite-library';

const valid = {
  legend: { k: 'Ink', g: 'G2' },
  frames: { a: ['kg', 'gk'], b: ['gg', 'kk'] },
  faded: {},
  animations: { sway: { frames: ['a', 'b'], length: 10 } },
};

test('every sprite folder holds both its data and its preview page', () => {
  const folders = (pattern: Record<string, unknown>, file: string): string[] =>
    Object.keys(pattern)
      .map((path) => path.replace(`/${file}`, ''))
      .sort();
  const data = folders(import.meta.glob('/assets/sprites/*/data.js'), 'data.js');
  expect(folders(import.meta.glob('/assets/sprites/*/preview.html', { query: '?raw' }), 'preview.html')).toEqual(data);
  expect(data.map((path) => path.replace('/assets/sprites/', ''))).toEqual(Object.keys(sprites).sort());
});

test('stones retain exactly the first five distinct variants in index order', () => {
  expect(Object.keys(sprites.stone!.frames)).toEqual(['variant-0', 'variant-1', 'variant-2', 'variant-3', 'variant-4']);
  const frames = Object.values(sprites.stone!.frames);
  expect(new Set(frames.map((art) => art.rows.join('\n'))).size).toBe(5);
});

test('boulder loads a single 32 by 48 frame', () => {
  const art = sprites.boulder!.frames['variant-0']!;
  expect(Object.keys(sprites.boulder!.frames)).toEqual(['variant-0']);
  expect([sprite(art).width, sprite(art).height]).toEqual([32, 48]);
});

test('terrain source, parsed and registered sprites preserve the exact original ordered content', () => {
  const source = readFileSync(new URL('../../../assets/sprites/terrain-transitions/data.js', import.meta.url), 'utf8');
  const data: unknown = runInNewContext(`${source}\nglobalThis.sprites['terrain-transitions'];`, {});
  const baseline = 'c4fc4a6a9f518d8b399be790afdf00bb64aeafa5ad62f691caff308056880063';
  const hash = (content: unknown): string => createHash('sha256').update(JSON.stringify(content)).digest('hex');
  const normalize = ({ frames, animations }: ReturnType<typeof readSprite>): unknown => {
    const names = new Map(Object.entries(frames).map(([name, art]) => [art, name]));
    return {
      legend: Object.values(frames)[0]!.legend,
      frames: Object.fromEntries(Object.entries(frames).map(([name, art]) => [name, art.rows])),
      faded: Object.fromEntries(
        Object.entries(frames).flatMap(([name, art]) => (art.faded ? [[name, art.faded]] : [])),
      ),
      animations: Object.fromEntries(
        Object.entries(animations).map(([name, animation]) => [
          name,
          { frames: animation.frames.map((art) => names.get(art)), length: animation.length },
        ]),
      ),
    };
  };
  expect(hash(data), 'standalone source').toBe(baseline);
  expect(hash(normalize(readSprite(data))), 'parsed source').toBe(baseline);
  expect(hash(normalize(sprites['terrain-transitions']!)), 'registered sprite').toBe(baseline);
});

test('registered terrain exposes four shared 32 by 32 frames per animation on the water clock', () => {
  const terrain = sprites['terrain-transitions']!;
  expect(Object.keys(terrain.frames)).toHaveLength(243);
  expect(Object.keys(terrain.animations)).toHaveLength(81);
  expect(Object.keys(terrainArt)).toEqual(Object.keys(terrain.animations));
  expect(waterFrameLength).toBe(15);
  for (const [name, animation] of Object.entries(terrain.animations)) {
    expect(animation.length, name).toBe(waterFrameLength);
    expect(animation.frames, name).toHaveLength(4);
    expect(terrainArt[name], name).toBe(animation.frames);
    for (const art of animation.frames) expect(Object.values(terrain.frames), name).toContain(art);
  }
  for (const [name, art] of Object.entries(terrain.frames)) {
    const rendered = sprite(art);
    expect([rendered.width, rendered.height], name).toEqual([32, 32]);
    expect(rendered.colored, name).toHaveLength(32 * 32 * 4);
    expect(rendered.faded, name).toHaveLength(32 * 32 * 4);
  }
});

test('flowers provide exactly ten variants in index order with two distinct sway frames each', () => {
  expect(flowerArt).toHaveLength(10);
  expect(Object.keys(sprites.flowers!.frames)).toHaveLength(20);
  flowerArt.forEach((frames, index) => {
    expect(frames).toHaveLength(2);
    frames.forEach((art, sway) => expect(art).toBe(sprites.flowers!.frames[`variant-${index}-${sway}`]));
    expect(new Set(frames.map((art) => art.rows.join('\n'))).size).toBe(2);
  });
  expect(new Set(flowerArt.map((frames) => frames[0]!.rows.join('\n'))).size).toBe(10);
});

test('added flower variants preserve opaque pixel area across both sway frames', () => {
  flowerArt.slice(3).forEach((frames, index) => {
    const areas = frames.map(
      (art) => sprite(art).colored.filter((alpha, offset) => offset % 4 === 3 && alpha === 255).length,
    );
    expect(areas[1], `flower variant ${index + 3}`).toBe(areas[0]);
  });
});

test('flower sprite indices use the petal colors of the matching domain variants', () => {
  const colors = [
    ['Paper', 'R3'],
    ['W3', 'V3'],
    ['Paper', 'V3'],
    ['R3', 'W3'],
    ['R3', 'V3'],
    ['Paper', 'W3'],
    ['Paper'],
    ['R3'],
    ['W3'],
    ['V3'],
  ];
  flowerArt.forEach((frames, index) => {
    for (const art of frames) {
      const petals = [...new Set(art.rows.join(''))]
        .filter((symbol) => 'prwv'.includes(symbol))
        .map((symbol) => art.legend[symbol]);
      expect(new Set(petals)).toEqual(new Set(colors[index]));
    }
  });
});

test.each(Object.entries(sprites.flowers!.frames))(
  'flower %s has rectangular palette-safe 32 by 32 rows',
  (name, art) => {
    expect(art.rows, name).toHaveLength(32);
    art.rows.forEach((row, index) => expect(row.length, `${name} row ${index + 1}`).toBe(32));
    expect(() => sprite(art), name).not.toThrow();
    expect([sprite(art).width, sprite(art).height]).toEqual([32, 32]);
  },
);

test.each(Object.entries(sprites.flowers!.frames))('flower %s has four isolated three-pixel contacts', (_, art) => {
  const contacts = art.rows.flatMap((row, vertical) =>
    [...row.matchAll(/d+/g)]
      .filter((match) => match[0] === 'ddd')
      .map((match) => ({ column: match.index, row: vertical })),
  );
  expect(contacts).toHaveLength(4);
  expect(art.legend.d).toBe('G1');
  for (const { column, row } of contacts) {
    expect(art.rows[row]![column - 1]).toBe('.');
    expect(art.rows[row]![column + 3]).toBe('.');
    expect(art.rows[row + 1]!.slice(column - 1, column + 4)).not.toContain('d');
  }
});

test('no-fruit trees choose among eight leafy shapes that leave out every fruit tree', () => {
  expect(treeArt).toHaveLength(8);
  for (const frame of Object.values(fruitTreeArt).flat()) expect(treeArt.flat(2)).not.toContain(frame);
});

test('each leafy shape has four versions that sway like the original', () => {
  for (const [original, ...versions] of treeArt) {
    expect(versions).toHaveLength(3);
    for (const version of versions) {
      expect(version).toHaveLength(original!.length);
      for (const [index, art] of version.entries()) {
        expect(art.rows.map((row) => row.length)).toEqual(original![index]!.rows.map((row) => row.length));
        expect(art).not.toBe(original![index]);
      }
    }
  }
});

test('animations share frames by identity', () => {
  const loaded = readSprite({ ...valid, animations: { sway: { frames: ['a', 'b', 'a'], length: 10 } } });
  expect(loaded.animations.sway!.frames[0]).toBe(loaded.frames.a);
  expect(loaded.animations.sway!.frames[2]).toBe(loaded.frames.a);
});

test.each([
  ['an unknown palette code', { ...valid, legend: { k: 'Ink', g: 'G9' } }],
  ['a legend key longer than one symbol', { ...valid, legend: { k: 'Ink', gg: 'G2' } }],
  ['an animation frame that does not exist', { ...valid, animations: { sway: { frames: ['a', 'c'], length: 10 } } }],
  ['animation frames of different sizes', { ...valid, frames: { a: ['kg', 'gk'], b: ['g', 'k'] } }],
  [
    'a frame length that is not a positive whole number',
    { ...valid, animations: { sway: { frames: ['a'], length: 0 } } },
  ],
  ['a faded correction without a colored frame', { ...valid, faded: { c: { legend: { n: 'N2' }, rows: ['nn'] } } }],
  ['a faded correction in color', { ...valid, faded: { a: { legend: { n: 'G2' }, rows: ['nn', 'nn'] } } }],
])('rejects %s', (_, data) => {
  expect(() => readSprite(data)).toThrow();
});

test('the level picker padlock is 16 by 16', () => {
  expect([sprite(smallPadlockArt).width, sprite(smallPadlockArt).height]).toEqual([16, 16]);
});

test('the orb sparkles through eight 24 by 24 frames on one clock', () => {
  const orb = sprites.orb!;
  const names = Array.from({ length: 8 }, (_, step) => `orb-${step}`);
  expect(Object.keys(orb.frames)).toEqual(names);
  expect(Object.keys(orb.animations)).toEqual(['sparkle']);
  expect(orb.animations.sparkle!.frames).toEqual(names.map((name) => orb.frames[name]));
  expect(orbFrameLength).toBe(orb.animations.sparkle!.length);
  for (const art of orb.animations.sparkle!.frames) expect([sprite(art).width, sprite(art).height]).toEqual([24, 24]);
});

test('every orb frame keeps the same outline and opaque area so only the glint and sparkles move', () => {
  const frames = sprites.orb!.animations.sparkle!.frames;
  const outline = (rows: readonly string[]): string => rows.map((row) => row.replace(/[^k]/g, '.')).join('\n');
  const area = (rows: readonly string[]): number => rows.join('').replace(/\./g, '').length;
  for (const art of frames) {
    expect(outline(art.rows)).toBe(outline(frames[0]!.rows));
    expect(area(art.rows)).toBe(area(frames[0]!.rows));
  }
});

test('every orb hue shares the pink pixel grid in every frame and changes only its four ramp steps', () => {
  const pink = sprites.orb!.animations.sparkle!.frames;
  expect(Object.keys(orbFrames)).toEqual([...orbHues]);
  expect(Object.keys(orbArt)).toEqual([...orbHues]);
  expect(orbFrames.pink).toBe(pink);
  for (const hue of orbHues) {
    expect(orbFrames[hue]).toHaveLength(pink.length);
    expect(orbArt[hue]).toBe(orbFrames[hue][0]);
    orbFrames[hue].forEach((art, step) => {
      expect(art.rows).toBe(pink[step]!.rows);
      expect(art.legend).toMatchObject({ k: 'Ink', h: 'Paper' });
      expect(Object.keys(art.legend).sort()).toEqual(Object.keys(pink[step]!.legend).sort());
    });
  }
  expect(new Set(orbHues.map((hue) => orbArt[hue].legend.a)).size).toBe(orbHues.length);
});

test('the fence gate frames share one 32 by 64 size and park open apart from the last swing frame', () => {
  const gate = Object.entries(sprites.fence!.frames).filter(([name]) => name.startsWith('gate-'));
  expect(gate.map(([name]) => name)).toEqual([...Array.from({ length: 8 }, (_, step) => `gate-${step}`), 'gate-open']);
  for (const [, art] of gate) expect([sprite(art).width, sprite(art).height]).toEqual([32, 64]);
  expect(sprites.fence!.frames['gate-open']!.rows).not.toEqual(sprites.fence!.frames['gate-7']!.rows);
});

test('the side gate frames cover the gate tile, the tile east of it and the two tiles north', () => {
  const gate = Object.entries(sprites.fence!.frames).filter(([name]) => name.startsWith('side-gate-'));
  expect(gate.map(([name]) => name)).toEqual([
    ...Array.from({ length: 8 }, (_, step) => `side-gate-${step}`),
    'side-gate-open',
  ]);
  for (const [, art] of gate) expect([sprite(art).width, sprite(art).height]).toEqual([64, 64]);
  expect(sprites.fence!.animations['side-opening']!.frames).toEqual(gate.slice(0, 8).map(([, art]) => art));
});

test('the pressure plate presses through three 32 by 32 frames', () => {
  const frames = ['plate', 'plate-1', 'plate-2'];
  expect(Object.keys(sprites.plate!.frames)).toEqual(frames);
  for (const name of frames) {
    const art = sprites.plate!.frames[name]!;
    expect([sprite(art).width, sprite(art).height]).toEqual([32, 32]);
  }
  expect(sprites.plate!.animations.press!.frames).toEqual(frames.map((name) => sprites.plate!.frames[name]));
});

test('bird animations face both ways, sit on an 11 by 9 frame, fly on an 11 by 7 frame and never fade', () => {
  const bird = sprites.bird!;
  expect(Object.keys(bird.animations).sort()).toEqual(
    ['perch', 'hop', 'peck', 'fly'].flatMap((habit) => [`left-${habit}`, `right-${habit}`]).sort(),
  );
  for (const [name, { frames }] of Object.entries(bird.animations)) {
    for (const art of frames) {
      expect([sprite(art).width, sprite(art).height]).toEqual(name.endsWith('-fly') ? [11, 7] : [11, 9]);
      expect(art.faded).toBeUndefined();
    }
  }
});

test('frog animations face both ways, share a 15 by 11 frame with the ripple and never fade', () => {
  const frog = sprites.frog!;
  expect(Object.keys(frog.animations).sort()).toEqual(
    ['ripple', ...['sit', 'croak', 'leap'].flatMap((habit) => [`left-${habit}`, `right-${habit}`])].sort(),
  );
  for (const { frames } of Object.values(frog.animations)) {
    for (const art of frames) {
      expect([sprite(art).width, sprite(art).height]).toEqual([15, 11]);
      expect(art.faded).toBeUndefined();
    }
  }
});
