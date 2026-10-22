import { arrivalLength } from '../../session/game-phase';
import { ditherThreshold } from '../../graphics/ordered-dither';

export const gatherLength = 16;
const revealEnd = 40;
const moteCount = 8;
const centerX = 16;
const centerY = 17;
// A full turn takes 32 frames, so the trail points stay a few pixels apart instead of scattering.
const turnPerFrame = (2 * Math.PI) / 32;
const orbitRadius = 11;

// Six steps per frame against four per row moves the edge one and a half rows each frame.
const revealSteps = (age: number): number => 6 * (age - gatherLength + 1);

export function revealed(age: number, spriteX: number, spriteY: number): boolean {
  return 4 * (31 - spriteY) + ditherThreshold(spriteX, spriteY) < revealSteps(age);
}

// The line sits where about half of the dithered row is shown, so solid pixels are below it and scattered ones above.
export function risingEdge(age: number): number | undefined {
  if (age < gatherLength || age >= revealEnd) return undefined;
  const row = Math.min(31, 31 - Math.floor((revealSteps(age) - 8) / 4));
  return row >= 0 ? row : undefined;
}

export function shadowShown(age: number): boolean {
  return age >= gatherLength;
}

function motePosition(index: number, age: number): { x: number; y: number } {
  // The motes stop turning once the reveal ends, so they rise straight up from where they last circled.
  const angle = (index * 2 * Math.PI) / moteCount + turnPerFrame * Math.min(age, revealEnd - 1);
  const radius = age < gatherLength ? 20 - ((20 - orbitRadius) * age) / (gatherLength - 1) : orbitRadius;
  let dx = Math.cos(angle) * radius;
  let dy = Math.sin(angle) * radius;
  if (age >= revealEnd) {
    const risen = age - revealEnd + 1;
    dx *= 1 + risen / 4;
    dy -= 3 * risen;
  }
  return { x: centerX + Math.round(dx), y: centerY + Math.round(dy) };
}

// Each mote also shows where it was one and two frames ago, which reads as a short trail.
export function arrivalMotes(age: number): readonly { readonly x: number; readonly y: number }[] {
  if (age >= arrivalLength) return [];
  return Array.from({ length: moteCount }, (_, index) =>
    [age, age - 1, age - 2].filter((at) => at >= 0).map((at) => motePosition(index, at)),
  ).flat();
}
