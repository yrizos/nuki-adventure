import { type Art, type Legend, PixelGrid } from './art';

const woodColors = { l: 'E2', w: 'E1', d: 'E0' } as const satisfies Legend;

function rail(grid: PixelGrid, left: number, right: number, top: number): void {
  grid.rectangle(left, top, right - left, 1, 'l');
  grid.rectangle(left, top + 1, right - left, 1, 'w');
  grid.rectangle(left, top + 2, right - left, 1, 'd');
}

// A piece is chosen by its connected neighbors as bits for up, down, left and right, so runs and corners join without seams.
function fence(piece: number): Art {
  const grid = new PixelGrid(32, 32);
  for (const top of [9, 17]) {
    if (piece & 2) rail(grid, 0, 12, top);
    if (piece & 1) rail(grid, 20, 32, top);
  }
  for (const [connected, top, bottom] of [
    [piece & 8, 0, 4],
    [piece & 4, 27, 32],
  ] as const) {
    if (!connected) continue;
    grid.rectangle(14, top, 3, bottom - top, 'w');
    grid.rectangle(17, top, 1, bottom - top, 'd');
  }
  grid.rectangle(12, 4, 8, 3, 'l');
  grid.rectangle(12, 7, 8, 19, 'w');
  grid.rectangle(19, 4, 1, 22, 'd');
  grid.rectangle(12, 26, 8, 1, 'd');
  grid.rectangle(14, 10, 1, 8, 'd');
  grid.put(12, 4, '.');
  grid.put(19, 4, '.');
  return grid.build(woodColors);
}

export const fenceArt = Array.from({ length: 16 }, (_, piece) => fence(piece));

function post(grid: PixelGrid, left: number): void {
  grid.rectangle(left, 20, 10, 71, 'w');
  grid.rectangle(left, 20, 2, 70, 'l');
  grid.rectangle(left + 9, 20, 1, 71, 'd');
  grid.rectangle(left, 90, 10, 1, 'd');
  grid.rectangle(left + 4, 26, 1, 14, 'd');
  grid.rectangle(left + 6, 52, 1, 18, 'd');
}

function door(open: boolean): Art {
  const grid = new PixelGrid(96, 96);
  grid.rectangle(0, 4, 96, 3, 'l');
  grid.rectangle(0, 7, 96, 12, 'w');
  grid.rectangle(0, 19, 96, 1, 'd');
  grid.rectangle(95, 4, 1, 16, 'd');
  for (const [column, row, length] of [
    [8, 10, 20],
    [40, 14, 24],
    [70, 11, 16],
  ] as const)
    grid.rectangle(column, row, length, 1, 'd');
  for (const [column, row] of [
    [0, 4],
    [1, 4],
    [0, 5],
    [95, 4],
  ] as const)
    grid.put(column, row, '.');
  post(grid, 0);
  post(grid, 86);
  if (open) {
    // Doorways use the darkest step of their ramp, and the leaves swung inward show only their edges.
    grid.rectangle(15, 20, 66, 71, 'd');
    grid.rectangle(10, 20, 1, 71, 'l');
    grid.rectangle(11, 20, 4, 71, 'w');
    grid.rectangle(81, 20, 1, 71, 'l');
    grid.rectangle(82, 20, 4, 71, 'w');
    return grid.build(woodColors);
  }
  grid.rectangle(10, 20, 76, 71, 'l');
  for (let column = 16; column < 86; column += 6) grid.rectangle(column === 46 ? 47 : column, 20, 1, 71, 'd');
  grid.rectangle(10, 90, 76, 1, 'd');
  for (const top of [32, 70]) {
    rail(grid, 11, 47, top);
    rail(grid, 48, 85, top);
  }
  grid.rectangle(43, 52, 2, 4, 'd');
  grid.rectangle(50, 52, 2, 4, 'd');
  return grid.build(woodColors);
}

export const doorArt = { closed: door(false), open: door(true) } as const;
