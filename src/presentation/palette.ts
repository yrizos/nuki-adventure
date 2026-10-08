import { z } from 'zod';

// The colors live in sprites/palette.js so the sprite previews can read them from disk, while the codes stay here as a literal type the game is checked against.
const paletteCodes = [
  'Ink',
  'N1',
  'N2',
  'N3',
  'N4',
  'Paper',
  'G0',
  'G1',
  'G2',
  'G3',
  'G4',
  'E0',
  'E1',
  'E2',
  'E3',
  'E4',
  'W0',
  'W1',
  'W2',
  'W3',
  'W4',
  'Y0',
  'Y1',
  'Y2',
  'Y3',
  'R0',
  'R1',
  'R2',
  'R3',
  'V0',
  'V0a',
  'V1',
  'V2',
  'V3',
  'T0',
  'T1',
  'T2',
  'T3',
  'P0',
  'P1',
  'P2',
  'P3',
  'S0',
  'S1',
  'S2',
  'S3',
] as const;

export type PaletteCode = (typeof paletteCodes)[number];

export const paletteCode = z.enum(paletteCodes);
export const neutralCode = z.enum(['Ink', 'N1', 'N2', 'N3', 'N4', 'Paper']);

import.meta.glob('./sprites/palette.js', { eager: true });

const loaded = z
  .object({
    colors: z.record(paletteCode, z.string().regex(/^#[0-9A-F]{6}$/)),
    faded: z.partialRecord(paletteCode, neutralCode),
  })
  .parse((globalThis as { palette?: unknown }).palette);

export const palette: Readonly<Record<PaletteCode, string>> = loaded.colors;

export function faded(code: PaletteCode): PaletteCode {
  return loaded.faded[code] ?? code;
}

// Ink is an outline color rather than a neutral step, so it has no lighter step.
const ramps: readonly (readonly PaletteCode[])[] = [
  ['N1', 'N2', 'N3', 'N4', 'Paper'],
  ['G0', 'G1', 'G2', 'G3', 'G4'],
  ['E0', 'E1', 'E2', 'E3', 'E4'],
  ['W0', 'W1', 'W2', 'W3', 'W4'],
  ['Y0', 'Y1', 'Y2', 'Y3'],
  ['R0', 'R1', 'R2', 'R3'],
  ['V0', 'V0a', 'V1', 'V2', 'V3'],
  ['T0', 'T1', 'T2', 'T3'],
  ['P0', 'P1', 'P2', 'P3'],
  ['S0', 'S1', 'S2', 'S3'],
];

const lighterSteps = new Map(ramps.flatMap((ramp) => ramp.slice(0, -1).map((code, index) => [code, ramp[index + 1]!])));

export function lighter(code: PaletteCode): PaletteCode {
  return lighterSteps.get(code) ?? code;
}
