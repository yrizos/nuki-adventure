import { type Art, PixelGrid } from './art';

export const lightMote: Art = { legend: { p: 'Paper' }, rows: ['p'] };

export function groundShadow(width: number, code: 'G1' | 'E2' | 'N2'): Art {
  const grid = new PixelGrid(width, 5);
  grid.rectangle(0, 0, width, 1, 'd');
  grid.rectangle(2, 1, width - 4, 3, 'd');
  grid.rectangle(4, 4, width - 8, 1, 'd');
  return grid.build({ d: code });
}
