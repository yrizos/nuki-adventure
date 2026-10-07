import { expect, test } from 'vitest';
import { sprite } from './picture';
import { flowerArt, fruitTreeArt, readSprite, sprites, terrainArt, treeArt, waterFrameLength } from './sprite-library';

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
  const data = folders(import.meta.glob('./sprites/*/data.js'), 'data.js');
  expect(folders(import.meta.glob('./sprites/*/preview.html', { query: '?raw' }), 'preview.html')).toEqual(data);
  expect(data.map((path) => path.replace('./sprites/', ''))).toEqual(Object.keys(sprites).sort());
});

test('every frame of every sprite rasterizes', () => {
  for (const { frames } of Object.values(sprites)) {
    for (const art of Object.values(frames)) expect(() => sprite(art)).not.toThrow();
  }
});

test('stones retain exactly the first five distinct variants in index order', () => {
  expect(Object.keys(sprites.stone!.frames)).toEqual(['variant-0', 'variant-1', 'variant-2', 'variant-3', 'variant-4']);
  const frames = Object.values(sprites.stone!.frames);
  expect(new Set(frames.map((art) => art.rows.join('\n'))).size).toBe(5);
});

test.each(Object.entries(sprites.stone!.frames))('stone %s rasterizes as a valid 32 by 32 sprite', (name, art) => {
  expect(art.rows, name).toHaveLength(32);
  art.rows.forEach((row, index) => expect(row.length, `${name} row ${index + 1}`).toBe(32));
  expect(() => sprite(art), name).not.toThrow();
  expect([sprite(art).width, sprite(art).height]).toEqual([32, 32]);
});

test('terrain transitions animate on the water clock', () => {
  expect(Object.keys(terrainArt)).toHaveLength(81);
  expect(new Set(Object.values(sprites['terrain-transitions']!.animations).map(({ length }) => length))).toEqual(
    new Set([waterFrameLength]),
  );
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
  for (const frame of Object.values(fruitTreeArt).flat()) expect(treeArt.flat()).not.toContain(frame);
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
