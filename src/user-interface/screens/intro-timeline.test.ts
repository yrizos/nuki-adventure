import { expect, test } from 'vitest';
import { ditherSteps } from '../graphics/ordered-dither';
import {
  beatLength,
  beatStart,
  boomFrame,
  introLength,
  panelCount,
  revealedThresholds,
  revealLength,
  sinkFrames,
  sinkStart,
  trembleOffset,
} from './intro-timeline';

test.each([0, 1, 2, 3, 4])('panel %i starts on its beat and is whole once its reveal ends', (panel) => {
  const start = beatStart(panel);
  expect(start).toBe(panel * beatLength);
  expect(revealedThresholds(panel, start - 1)).toBe(0);
  expect(revealedThresholds(panel, start + 2)).toBe(1);
  expect(revealedThresholds(panel, start + revealLength - 1)).toBe(ditherSteps - 1);
  expect(revealedThresholds(panel, start + revealLength)).toBe(ditherSteps);
  expect(revealedThresholds(panel, introLength)).toBe(ditherSteps);
});

test('the boom lands once the boom panel is whole and the page sinks once the last beat ends', () => {
  expect(boomFrame).toBe(beatStart(2) + revealLength);
  expect(sinkFrames(sinkStart - 1)).toBe(-1);
  expect(sinkFrames(panelCount * beatLength)).toBe(0);
});

test('the whole page trembles in whole pixels of at most 3, starting on the boom and only during the boom panel', () => {
  const trembling: number[] = [];
  for (let frame = 0; frame < introLength; frame++) {
    const { x, y } = trembleOffset(frame);
    expect([Number.isInteger(x), Number.isInteger(y)]).toEqual([true, true]);
    expect(Math.max(Math.abs(x), Math.abs(y))).toBeLessThanOrEqual(3);
    if (x !== 0 || y !== 0) trembling.push(frame);
  }
  expect(trembling[0]).toBe(boomFrame);
  expect(trembling.every((frame) => frame < beatStart(3))).toBe(true);
});
