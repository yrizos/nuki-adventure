import { expect, test } from 'vitest';
import { Door } from '../domain/level/door';
import { TilePosition } from '../domain/level/position';
import { LevelSize } from '../domain/level/scenery';
import { ditherSteps } from './ordered-dither';
import {
  closingLength,
  crestLength,
  doorOpeningLength,
  isDarkened,
  isRestored,
  restorationAge,
  restorationCovers,
  restorationLength,
} from './world-transition';

const at = TilePosition.at;
const tileSize = 32;

function arrival(x: number, y: number, origin: TilePosition): number {
  let frame = 0;
  while (!isRestored(x, y, origin, frame)) frame++;
  return frame;
}

function settling(x: number, y: number, origin: TilePosition): number {
  let frame = 0;
  while (restorationAge(x, y, origin, frame) < crestLength) frame++;
  return frame;
}

function lastToSettle(left: number, top: number, width: number, height: number, origin: TilePosition): number {
  let latest = 0;
  for (let y = top; y < top + height; y++) {
    for (let x = left; x < left + width; x++) latest = Math.max(latest, settling(x, y, origin));
  }
  return latest;
}

test('spreads restoration in a circle of one tile every four frames until the crest settles at the farthest corner', () => {
  const origin = TilePosition.at(15, 9);
  expect(restorationLength(LevelSize.of(18, 20), origin)).toBe(81 + 16 + 8);
  // These pixels have dither threshold 0, so only their distance from the orb tile center sets when they arrive.
  const [centerX, centerY] = [15 * 32 + 16, 9 * 32 + 16];
  expect(isRestored(centerX, centerY, origin, 0)).toBe(false);
  expect(isRestored(centerX, centerY, origin, 1)).toBe(true);
  expect(isRestored(centerX + 28, centerY, origin, 3)).toBe(false);
  expect(isRestored(centerX + 28, centerY, origin, 4)).toBe(true);
  expect(isRestored(centerX, centerY + 28, origin, 3)).toBe(false);
  expect(isRestored(centerX, centerY + 28, origin, 4)).toBe(true);
  expect(isRestored(centerX + 28, centerY + 28, origin, 5)).toBe(false);
  expect(isRestored(centerX + 28, centerY + 28, origin, 6)).toBe(true);
});

// Threshold 0 pixels pin the travel time alone, and the others pin the extra delay from their dither threshold.
const waveOrigin = at(15, 9);
const wavePixels = [
  { x: 496, y: 304, threshold: 0, arrives: 1 },
  { x: 524, y: 304, threshold: 0, arrives: 4 },
  { x: 496, y: 332, threshold: 0, arrives: 4 },
  { x: 524, y: 332, threshold: 0, arrives: 6 },
  { x: 696, y: 304, threshold: 0, arrives: 26 },
  { x: 525, y: 305, threshold: 4, arrives: 8 },
  { x: 467, y: 304, threshold: 10, arrives: 14 },
  { x: 524, y: 307, threshold: 15, arrives: 19 },
];

test.each(wavePixels)(
  'the wave reaches pixel $x, $y (dither threshold $threshold) at frame $arrives, not a frame before',
  ({ x, y, arrives }) => {
    expect(restorationAge(x, y, waveOrigin, arrives - 1)).toBeLessThan(0);
    expect(isRestored(x, y, waveOrigin, arrives - 1)).toBe(false);
    expect(restorationAge(x, y, waveOrigin, arrives)).toBeGreaterThanOrEqual(0);
    expect(isRestored(x, y, waveOrigin, arrives)).toBe(true);
    expect(isRestored(x, y, waveOrigin, arrives + 1)).toBe(true);
  },
);

test.each(wavePixels)(
  'the age of pixel $x, $y counts the frames since its arrival at frame $arrives, so its crest ends after crestLength frames',
  ({ x, y, arrives }) => {
    expect(crestLength).toBe(8);
    expect(restorationAge(x, y, waveOrigin, arrives)).toBeLessThan(1);
    for (const frames of [1, 2, crestLength - 1, crestLength, crestLength + 1]) {
      expect(
        restorationAge(x, y, waveOrigin, arrives + frames) - restorationAge(x, y, waveOrigin, arrives),
      ).toBeCloseTo(frames);
    }
    expect(restorationAge(x, y, waveOrigin, arrives + crestLength - 1)).toBeLessThan(crestLength);
    expect(restorationAge(x, y, waveOrigin, arrives + crestLength)).toBeGreaterThanOrEqual(crestLength);
  },
);

test('delays pixels at the same distance by their dither threshold, so the leading edge is dithered', () => {
  expect(arrival(467, 304, waveOrigin) - arrival(524, 304, waveOrigin)).toBe(10);
  expect(arrival(524, 307, waveOrigin) - arrival(524, 304, waveOrigin)).toBe(15);
});

test('darkens every pixel to Ink over forty-eight frames', () => {
  expect(closingLength).toBe(48);
  expect(isDarkened(0, 0, 2)).toBe(false);
  expect(isDarkened(0, 0, 3)).toBe(true);
  expect(isDarkened(0, 3, 47)).toBe(false);
  expect(isDarkened(0, 3, 48)).toBe(true);
});

test('opens the door once color covers its art and never later than the whole level', () => {
  expect(doorOpeningLength(Door.closedAt(TilePosition.at(2, 0)), LevelSize.of(18, 20), TilePosition.at(15, 9))).toBe(
    71 + 16 + 8,
  );
  expect(doorOpeningLength(Door.closedAt(TilePosition.at(15, 0)), LevelSize.of(18, 5), TilePosition.at(0, 2))).toBe(
    73 + 16 + 8,
  );
});

// The ground reaches half a tile past the map, so the margin is a whole tile on three edges, and two tiles above for the door art.
test.each([
  { side: 'left', margin: 'one tile', size: LevelSize.of(20, 1), origin: at(19, 0), travel: 83 },
  { side: 'right', margin: 'one tile', size: LevelSize.of(20, 1), origin: at(0, 0), travel: 83 },
  { side: 'bottom', margin: 'one tile', size: LevelSize.of(1, 20), origin: at(0, 0), travel: 83 },
  { side: 'top', margin: 'two tiles', size: LevelSize.of(1, 20), origin: at(0, 19), travel: 87 },
])(
  'the restoration phase runs until the crest has settled $margin past the $side edge of the map',
  ({ size, origin, travel }) => {
    expect(restorationLength(size, origin)).toBe(travel + 16 + 8);
  },
);

test.each([
  { name: 'the corner nearest the origin', door: at(1, 2) },
  { name: 'the corner farthest from the origin', door: at(3, 2) },
])('the door opens only after the crest has settled across its art at $name', ({ door }) => {
  const size = LevelSize.of(6, 5);
  const origin = at(0, 4);
  const closed = Door.closedAt(door);
  const settled = lastToSettle(door.column * tileSize, (door.row - 2) * tileSize, 3 * tileSize, 3 * tileSize, origin);
  expect(doorOpeningLength(closed, size, origin)).toBeGreaterThanOrEqual(settled);
  expect(
    doorOpeningLength(closed, size, origin),
    'the door must not wait a dither cycle past its last pixel',
  ).toBeLessThan(settled + ditherSteps);
  expect(doorOpeningLength(closed, size, origin)).toBeLessThanOrEqual(restorationLength(size, origin));
});

test('opens a door nearer the orb before a door farther from it', () => {
  const size = LevelSize.of(12, 6);
  const origin = at(0, 5);
  expect(doorOpeningLength(Door.closedAt(at(1, 2)), size, origin)).toBeLessThan(
    doorOpeningLength(Door.closedAt(at(9, 2)), size, origin),
  );
});

test('covers a set of tiles once the last of them has settled', () => {
  const origin = at(2, 3);
  const near = at(3, 3);
  const far = at(9, 0);
  const covers = (...tiles: TilePosition[]) => restorationCovers(tiles, origin);
  expect(covers(near, far)).toBe(Math.max(covers(near), covers(far)));
  expect(covers(near)).toBeLessThan(covers(far));
  for (const tile of [near, far]) {
    const settled = lastToSettle(tile.column * tileSize, tile.row * tileSize, tileSize, tileSize, origin);
    expect(covers(tile)).toBeGreaterThanOrEqual(settled);
    expect(covers(tile)).toBeLessThan(settled + ditherSteps);
  }
});
