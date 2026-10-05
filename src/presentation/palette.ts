export const palette = {
  Ink: '#1C1A2E',
  N1: '#34344F',
  N2: '#565875',
  N3: '#8A8CA6',
  N4: '#C4C6D6',
  Paper: '#F5F2E9',
  G0: '#1F4A3F',
  G1: '#2F7A4A',
  G2: '#5AA845',
  G3: '#9BD35A',
  G4: '#D8EE8C',
  E0: '#3A2622',
  E1: '#6E4430',
  E2: '#A8703F',
  E3: '#D9B072',
  E4: '#F0DDA6',
  W0: '#1E3A6E',
  W1: '#2F67B8',
  W2: '#4FA0E3',
  W3: '#9AD7F5',
  W4: '#E6F7FF',
  Y0: '#9A5A12',
  Y1: '#E3961C',
  Y2: '#FFC93A',
  Y3: '#FFF0A0',
  R0: '#6E1C33',
  R1: '#C2303E',
  R2: '#F0604F',
  R3: '#FFB3A3',
  V0: '#3F2466',
  V1: '#7A45BF',
  V2: '#B47EF0',
  V3: '#E8C9FF',
  T0: '#134A52',
  T1: '#1F8A8A',
  T2: '#3CC8B4',
  T3: '#A6F0DE',
  P0: '#6B1F4F',
  P1: '#C23A7E',
  P2: '#F27AB0',
  P3: '#FFC2DD',
  S0: '#7A4A38',
  S1: '#C08262',
  S2: '#E8B896',
  S3: '#FFE0C7',
} as const;

export type PaletteCode = keyof typeof palette;

const fadedSteps: Readonly<Record<'N1' | 'N2' | 'N3' | 'N4' | 'Paper', readonly PaletteCode[]>> = {
  N1: ['G0', 'E0', 'W0', 'R0', 'V0', 'T0', 'P0'],
  N2: ['G1', 'E1', 'W1', 'Y0', 'R1', 'V1', 'P1', 'S0'],
  N3: ['G2', 'E2', 'W2', 'Y1', 'R2', 'V2', 'T1', 'P2', 'S1'],
  N4: ['G3', 'E3', 'W3', 'Y2', 'R3', 'V3', 'T2', 'P3', 'S2'],
  Paper: ['G4', 'E4', 'W4', 'Y3', 'T3', 'S3'],
};

export function faded(code: PaletteCode): PaletteCode {
  for (const [neutral, steps] of Object.entries(fadedSteps)) {
    if (steps.includes(code)) return neutral as PaletteCode;
  }
  return code;
}
