import { tileSize } from './world-geometry';

export const minimumGamePixels = 7 * tileSize;

interface CanvasFit {
  readonly width: number;
  readonly height: number;
  readonly scale: number;
}

export function fitCanvas(deviceWidth: number, deviceHeight: number): CanvasFit {
  if (!Number.isFinite(deviceWidth) || !Number.isFinite(deviceHeight) || deviceWidth <= 0 || deviceHeight <= 0) {
    throw new RangeError('The game view needs positive finite device dimensions');
  }
  // Only a whole number of device pixels per game pixel keeps every game pixel the same size.
  const scale = Math.max(1, Math.floor(Math.min(deviceWidth, deviceHeight) / minimumGamePixels));
  return { width: Math.ceil(deviceWidth / scale), height: Math.ceil(deviceHeight / scale), scale };
}

export function pixelAlignment(unalignedLeft: number, ratio: number): number {
  return Math.round(unalignedLeft * ratio) / ratio - unalignedLeft;
}
