import { expect, test } from 'vitest';
import { fitCanvas } from './game';

test.each([1, 1.25, 1.5, 2, 3])('fits whole, equally sized device pixels at pixel ratio %s', (ratio) => {
  for (const [width, height] of [[320, 405], [360, 316], [375, 475], [430, 712], [529, 529]]) {
    const deviceWidth = Math.ceil(width! * ratio);
    const deviceHeight = Math.ceil(height! * ratio);
    const fit = fitCanvas(deviceWidth, deviceHeight);
    expect(fit.scale).toBe(Math.floor(Math.min(deviceWidth, deviceHeight) / 224));
    expect(fit.width).toBeGreaterThanOrEqual(224);
    expect(fit.height).toBeGreaterThanOrEqual(224);
    expect(fit.width * fit.scale).toBeGreaterThanOrEqual(deviceWidth);
    expect(fit.height * fit.scale).toBeGreaterThanOrEqual(deviceHeight);
    expect(fit.width * fit.scale - deviceWidth).toBeLessThan(fit.scale);
    expect(fit.height * fit.scale - deviceHeight).toBeLessThan(fit.scale);
  }
});

test('uses the largest permitted scale at the 224-pixel boundaries', () => {
  expect(fitCanvas(447, 600)).toEqual({ width: 447, height: 600, scale: 1 });
  expect(fitCanvas(448, 600)).toEqual({ width: 224, height: 300, scale: 2 });
  expect(fitCanvas(673, 900)).toEqual({ width: 225, height: 300, scale: 3 });
});

test.each([0, -1, NaN, Infinity])('rejects invalid view dimensions %s', (dimension) => {
  expect(() => fitCanvas(dimension, 224)).toThrow(RangeError);
  expect(() => fitCanvas(224, dimension)).toThrow(RangeError);
});
