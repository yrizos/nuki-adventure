import { PixelGrid, type Art, type Legend } from './art';
import type { PaletteCode } from '../palette';

export const controlSize = 28;
export const lipHeight = 2;
const ringSize = 60;

const glyphs = {
  a: ['..xxxx..', '.xxxxxx.', 'xx....xx', 'xx....xx', 'xxxxxxxx', 'xxxxxxxx', 'xx....xx', 'xx....xx', 'xx....xx'],
  b: ['xxxxxx..', 'xxxxxxx.', 'xx....xx', 'xxxxxxx.', 'xxxxxxx.', 'xx....xx', 'xx....xx', 'xxxxxxx.', 'xxxxxx..'],
};
const dimple = ['.xx.', 'xxxx', 'xxxx', '.xx.'];
const arrowUp = ['...xx...', '..xxxx..', '.xxxxxx.', 'xxxxxxxx'];

function inDisc(size: number, column: number, row: number): boolean {
  const radius = size / 2;
  return (column + 0.5 - radius) ** 2 + (row + 0.5 - radius) ** 2 <= radius * radius;
}

interface ControlColors {
  readonly face: PaletteCode;
  readonly highlight: PaletteCode;
  readonly shading: PaletteCode;
  readonly lip: PaletteCode;
  readonly mark: PaletteCode;
}

function control(colors: ControlColors, pressed: boolean, mark: readonly string[]): Art {
  const grid = new PixelGrid(controlSize, controlSize + lipHeight);
  // A pressed control sinks by its lip height, so touch and keyboard presses read as the same physical push.
  const top = pressed ? lipHeight : 0;
  const face = (column: number, row: number): boolean => inDisc(controlSize, column, row - top);
  const lip = (column: number, row: number): boolean => !pressed && !face(column, row) && inDisc(controlSize, column, row - lipHeight);
  const solid = (column: number, row: number): boolean => face(column, row) || lip(column, row);
  for (let row = 0; row < controlSize + lipHeight; row++) {
    for (let column = 0; column < controlSize; column++) {
      if (!solid(column, row)) continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([across, down]) => !solid(column + across!, row + down!));
      if (edge) grid.put(column, row, 'k');
      else if (lip(column, row)) grid.put(column, row, 'l');
      else if (!face(column + 3, row + 3)) grid.put(column, row, 's');
      else if (!face(column - 2, row - 2)) grid.put(column, row, 'h');
      else grid.put(column, row, 'f');
    }
  }
  const width = mark[0]!.length;
  const left = (controlSize - width) / 2;
  const markTop = top + Math.floor((controlSize - mark.length) / 2);
  mark.forEach((line, row) => [...line].forEach((symbol, column) => {
    if (symbol === 'x') grid.put(left + column, markTop + row, 'm');
  }));
  const legend: Legend = { k: 'Ink', f: colors.face, h: colors.highlight, s: colors.shading, l: colors.lip, m: colors.mark };
  return grid.build(legend);
}

function ring(): Art {
  const grid = new PixelGrid(ringSize, ringSize);
  const inside = (column: number, row: number): boolean => inDisc(ringSize, column, row);
  for (let row = 0; row < ringSize; row++) {
    for (let column = 0; column < ringSize; column++) {
      if (!inside(column, row)) continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([across, down]) => !inside(column + across!, row + down!));
      // A recess catches the top left light on its bottom right wall.
      if (edge) grid.put(column, row, 'o');
      else if (!inside(column + 3, row + 3)) grid.put(column, row, 'b');
      else grid.put(column, row, 'w');
    }
  }
  return grid.build({ o: 'V2', b: 'V1', w: 'Ink' });
}

function arrow(rows: readonly string[], lit: boolean): Art {
  return { legend: { x: lit ? 'P3' : 'V2' }, rows };
}

const arrowDown = [...arrowUp].reverse();
const arrowLeft = [...arrowUp[0]!].map((_, column) => arrowUp.map((line) => line[column]).join(''));
const arrowRight = arrowLeft.map((line) => [...line].reverse().join(''));

// The knob wears the hero's t-shirt colors, so the control that moves her looks like hers.
const knob = { face: 'P2', highlight: 'P3', shading: 'P1', lip: 'P0', mark: 'P1' } as const;
const buttonA = { face: 'R2', highlight: 'R3', shading: 'R1', lip: 'R0', mark: 'Ink' } as const;
const buttonAPressed = { face: 'R1', highlight: 'R2', shading: 'R0', lip: 'R0', mark: 'Paper' } as const;
const buttonB = { face: 'W2', highlight: 'W3', shading: 'W1', lip: 'W0', mark: 'Ink' } as const;
const buttonBPressed = { face: 'W1', highlight: 'W2', shading: 'W0', lip: 'W0', mark: 'Paper' } as const;

export const panelArt: Readonly<Record<string, Art>> = {
  ring: ring(),
  knob: control(knob, false, dimple),
  'knob-held': control(knob, true, dimple),
  'button-a': control(buttonA, false, glyphs.a),
  'button-a-pressed': control(buttonAPressed, true, glyphs.a),
  'button-b': control(buttonB, false, glyphs.b),
  'button-b-pressed': control(buttonBPressed, true, glyphs.b),
  'arrow-up': arrow(arrowUp, false),
  'arrow-up-lit': arrow(arrowUp, true),
  'arrow-down': arrow(arrowDown, false),
  'arrow-down-lit': arrow(arrowDown, true),
  'arrow-left': arrow(arrowLeft, false),
  'arrow-left-lit': arrow(arrowLeft, true),
  'arrow-right': arrow(arrowRight, false),
  'arrow-right-lit': arrow(arrowRight, true),
};
