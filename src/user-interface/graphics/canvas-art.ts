import type { Art } from './art';
import { sprite, type Picture, type Version } from './picture';

function pixelsUrl(root: Document, width: number, height: number, pixels: Uint8ClampedArray): string {
  const canvas = root.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const image = new ImageData(width, height);
  image.data.set(pixels);
  canvas.getContext('2d')?.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

export function artUrl(root: Document, art: Art, version: Version = 'colored'): string {
  const { width, height, [version]: pixels } = sprite(art);
  return pixelsUrl(root, width, height, pixels);
}

export function pictureUrl(root: Document, picture: Picture): string {
  return pixelsUrl(root, picture.width, picture.height, picture.pixels);
}
