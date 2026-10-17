import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { runInNewContext } from 'node:vm';

/**
 * @typedef {{legend: Record<string, string>, rows: string[]}} FadedFrame
 * @typedef {{legend: Record<string, string>, frames: Record<string, string[]>, faded: Record<string, FadedFrame>, animations: Record<string, {length: number, frames: string[]}>}} Sprite
 */

const root = fileURLToPath(new URL('../assets/sprites/', import.meta.url));
const names = ['mode', 'sprite', 'frame', 'animation', 'filter', 'limit', 'offset', 'faded'];

/** @param {string | undefined} value @param {number} fallback @param {number} maximum @param {string} name */
function integer(value, fallback, maximum, name) {
  if (value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > maximum)
    throw new Error(`Invalid ${name}`);
  return Number(value);
}

/** @param {string} name */
function sourceExists(name) {
  try {
    return lstatSync(join(root, name, 'data.js')).isFile();
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false;
    throw error;
  }
}

/** @param {string[]} rows */
function dimensions(rows) {
  return { width: rows[0]?.length ?? 0, height: rows.length };
}

/** @param {string[]} rows @param {Record<string, string>} legend */
function usage(rows, legend) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const row of rows) for (const symbol of row) counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
  return [...counts.keys()].sort().map((symbol) => ({
    symbol,
    code: symbol === '.' ? 'transparent' : legend[symbol],
    pixels: counts.get(symbol),
  }));
}

function inspect() {
  /** @type {Record<string, {type: 'string'}>} */
  const argumentsConfig = Object.fromEntries(names.map((name) => [name, { type: 'string' }]));
  const { values } = parseArgs({ options: argumentsConfig });
  const options = Object.fromEntries(names.map((name) => [name, values[name] ?? process.env[name.toUpperCase()]]));
  const { mode, sprite, frame, animation, filter = '', faded = '' } = options;
  if (!mode) throw new Error('MODE is required');
  if (!['list', 'summary', 'frames', 'frame', 'animations', 'animation', 'palette'].includes(mode))
    throw new Error(`Unknown mode: ${mode}`);
  const limit = integer(options.limit, 20, 50, 'LIMIT (1–50)');
  if (limit === 0) throw new Error('Invalid LIMIT (1–50)');
  const offset = integer(options.offset, 0, Number.MAX_SAFE_INTEGER, 'OFFSET');
  if (!['', '0', '1'].includes(faded)) throw new Error('FADED must be 0 or 1');
  const directories = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  if (mode === 'list')
    return directories
      .map((entry) => entry.name)
      .filter(sourceExists)
      .sort()
      .join('\n');
  if (!sprite) throw new Error('SPRITE is required');
  if (sprite === '.' || sprite.includes('..') || /[/\\]/.test(sprite) || /^[A-Za-z]:/.test(sprite))
    throw new Error('SPRITE must be an immediate sprite directory name');
  if (!directories.some((entry) => entry.name === sprite)) throw new Error(`Unknown sprite: ${sprite}`);
  if (!sourceExists(sprite)) throw new Error(`Missing data.js for sprite: ${sprite}`);
  /** @type {{sprites?: Record<string, Sprite>}} */
  const context = {};
  // Evaluate trusted repository definitions only, including their generated frame tables.
  runInNewContext(readFileSync(join(root, sprite, 'data.js'), 'utf8'), context, { timeout: 1000 });
  const data = Object.hasOwn(context.sprites ?? {}, sprite) ? context.sprites[sprite] : undefined;
  if (!data?.frames || !data.legend || !data.animations || !data.faded)
    throw new Error(`Invalid sprite registration: ${sprite}`);
  const frameNames = Object.keys(data.frames).sort();
  const animationNames = Object.keys(data.animations).sort();
  /** @param {string[]} items */
  const page = (items) => ({
    total: items.length,
    offset,
    limit,
    ...(offset + limit < items.length ? { nextOffset: offset + limit } : {}),
    items: items.slice(offset, offset + limit),
  });
  switch (mode) {
    case 'summary': {
      /** @type {Map<string, number>} */
      const sizes = new Map();
      for (const rows of Object.values(data.frames)) {
        const { width, height } = dimensions(rows);
        const key = `${width}x${height}`;
        sizes.set(key, (sizes.get(key) ?? 0) + 1);
      }
      const entries = [...sizes.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      return {
        sprite,
        frames: frameNames.length,
        animations: animationNames.length,
        fadedOverrides: Object.keys(data.faded).length,
        legendEntries: Object.keys(data.legend).length,
        distinctDimensions: sizes.size,
        dimensions: Object.fromEntries(entries.slice(0, 50)),
        ...(sizes.size > 50 ? { omittedDimensions: sizes.size - 50 } : {}),
      };
    }
    case 'frames': {
      const result = page(frameNames.filter((name) => name.includes(filter)));
      return { sprite, ...result, items: result.items.map((name) => ({ name, ...dimensions(data.frames[name]) })) };
    }
    case 'animations':
      return { sprite, ...page(animationNames) };
    case 'animation':
      if (!animation) throw new Error('ANIMATION is required');
      if (!Object.hasOwn(data.animations, animation)) throw new Error(`Unknown animation: ${animation}`);
      return {
        sprite,
        animation,
        length: data.animations[animation].length,
        frames: data.animations[animation].frames,
      };
    case 'frame':
    case 'palette': {
      if (mode === 'palette' && !frame)
        return Object.keys(data.legend)
          .sort()
          .map((symbol) => `${symbol} -> ${data.legend[symbol]}`)
          .join('\n');
      if (!frame) throw new Error('FRAME is required');
      if (!Object.hasOwn(data.frames, frame)) throw new Error(`Unknown frame: ${frame}`);
      let rows = data.frames[frame];
      let legend = data.legend;
      if (faded === '1') {
        if (!Object.hasOwn(data.faded, frame)) return `${sprite}/${frame}: no explicit faded override`;
        ({ rows, legend } = data.faded[frame]);
      }
      const palette = usage(rows, legend);
      if (mode === 'palette')
        return palette.map(({ symbol, code, pixels }) => `${symbol} -> ${code} (${pixels} pixels)`).join('\n');
      return {
        sprite,
        frame,
        faded: faded === '1',
        ...dimensions(rows),
        rows,
        legend: Object.fromEntries(palette.map(({ symbol, code }) => [symbol, code])),
      };
    }
    default:
      throw new Error(`Unknown mode: ${mode}`);
  }
}

try {
  const result = inspect();
  console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
} catch (error) {
  console.error(`sprite-inspect: ${error.message}`);
  process.exitCode = 1;
}
