import type { Art } from './art/art';
import { sprite } from './picture';

export function artUrl(root: Document, art: Art): string {
  const { width, height, colored } = sprite(art);
  const canvas = root.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const image = new ImageData(width, height);
  image.data.set(colored);
  canvas.getContext('2d')?.putImageData(image, 0, 0);
  return canvas.toDataURL();
}
