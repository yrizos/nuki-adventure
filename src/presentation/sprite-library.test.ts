import { expect, test } from 'vitest';
import { sprite } from './picture';
import { readSprite, sprites, terrainArt, waterFrameLength } from './sprite-library';

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

test('terrain transitions animate on the water clock', () => {
  expect(Object.keys(terrainArt)).toHaveLength(81);
  expect(new Set(Object.values(sprites['terrain-transitions']!.animations).map(({ length }) => length))).toEqual(
    new Set([waterFrameLength]),
  );
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
