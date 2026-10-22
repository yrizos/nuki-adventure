import { ditherSteps } from '../graphics/ordered-dither';
import { closingLength } from '../world/transition/world-transition';

export const panelCount = 5;
const boomPanel = 2;
// Each panel stays alone for about a second and a half after it appears, long enough to look before the next one.
export const beatLength = 120;
const framesPerRevealThreshold = 2;
export const revealLength = ditherSteps * framesPerRevealThreshold;
// The boom waits until its panel is whole, so the page trembles with the whole picture in view.
export const boomFrame = boomPanel * beatLength + revealLength;
export const sinkStart = panelCount * beatLength;
export const introLength = sinkStart + closingLength;
// A held press skips after a second and a half, so a passing tap never cuts the story short.
export const skipLength = 90;

// The tremble dies down in whole pixels, so the boom jolts the page once and lets it settle again.
const tremble = [
  { x: 3, y: 0 },
  { x: -3, y: 2 },
  { x: 2, y: -2 },
  { x: -3, y: 1 },
  { x: 3, y: -1 },
  { x: -2, y: 2 },
  { x: 2, y: -1 },
  { x: -1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];
const framesPerTrembleStep = 2;

export function trembleOffset(frame: number): { readonly x: number; readonly y: number } {
  return tremble[Math.floor((frame - boomFrame) / framesPerTrembleStep)] ?? { x: 0, y: 0 };
}

export function beatStart(panel: number): number {
  return panel * beatLength;
}

export function revealedThresholds(panel: number, frame: number): number {
  const since = frame - beatStart(panel);
  return Math.max(0, Math.min(ditherSteps, Math.floor(since / framesPerRevealThreshold)));
}

export function sinkFrames(frame: number): number {
  return frame - sinkStart;
}
