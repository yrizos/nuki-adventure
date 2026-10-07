import { z } from 'zod';
import type { Art, HeroArt, HeroDirectionArt } from './art/art';
import { neutralCode, paletteCode } from './palette';

export interface Animation {
  readonly frames: readonly Art[];
  readonly length: number;
}

export interface Sprite {
  readonly frames: Readonly<Record<string, Art>>;
  readonly animations: Readonly<Record<string, Animation>>;
}

const symbol = z.string().length(1);
const rows = z.array(z.string()).min(1);

const spriteData = z
  .object({
    legend: z.record(symbol, paletteCode),
    frames: z.record(z.string(), rows),
    faded: z.record(z.string(), z.object({ legend: z.record(symbol, neutralCode), rows })),
    animations: z.record(z.string(), z.object({ frames: z.array(z.string()).min(1), length: z.int().positive() })),
  })
  .superRefine((data, context) => {
    for (const name of Object.keys(data.faded)) {
      if (!data.frames[name]) context.addIssue({ code: 'custom', message: `Faded frame ${name} has no colored frame` });
    }
    for (const [name, animation] of Object.entries(data.animations)) {
      const sizes = new Set(
        animation.frames.map((frame) => {
          const frameRows = data.frames[frame];
          if (!frameRows)
            context.addIssue({ code: 'custom', message: `Animation ${name} uses missing frame ${frame}` });
          return `${frameRows?.[0]?.length ?? 0}x${frameRows?.length ?? 0}`;
        }),
      );
      if (sizes.size > 1) context.addIssue({ code: 'custom', message: `Animation ${name} mixes frame sizes` });
    }
  });

// Symbol widths, legend coverage, neutral faded colors and the faded silhouette are checked when picture.ts rasterizes a frame, so they are not repeated here.
export function readSprite(data: unknown): Sprite {
  const { legend, frames, faded, animations } = spriteData.parse(data);
  const art: Record<string, Art> = Object.fromEntries(
    Object.entries(frames).map(([name, frameRows]) => {
      const correction = faded[name];
      return [name, correction ? { legend, rows: frameRows, faded: correction } : { legend, rows: frameRows }];
    }),
  );
  return {
    frames: art,
    animations: Object.fromEntries(
      Object.entries(animations).map(([name, animation]) => [
        name,
        { frames: animation.frames.map((frame) => art[frame]!), length: animation.length },
      ]),
    ),
  };
}

import.meta.glob('./sprites/*/data.js', { eager: true });

export const sprites: Readonly<Record<string, Sprite>> = Object.fromEntries(
  Object.entries(z.record(z.string(), z.unknown()).parse((globalThis as { sprites?: unknown }).sprites)).map(
    ([name, data]) => [name, readSprite(data)],
  ),
);

function sprite(name: string): Sprite {
  const found = sprites[name];
  if (!found) throw new RangeError(`No sprite is named ${name}`);
  return found;
}

function frame(spriteName: string, frameName: string): Art {
  const found = sprite(spriteName).frames[frameName];
  if (!found) throw new RangeError(`Sprite ${spriteName} has no frame ${frameName}`);
  return found;
}

function animation(spriteName: string, animationName: string): Animation {
  const found = sprite(spriteName).animations[animationName];
  if (!found) throw new RangeError(`Sprite ${spriteName} has no animation ${animationName}`);
  return found;
}

const variants = (spriteName: string): readonly Art[] => Object.values(sprite(spriteName).frames);

const animatedVariants = (spriteName: string): readonly (readonly Art[])[] =>
  Object.values(sprite(spriteName).animations).map(({ frames }) => frames);

// The game advances every animation of one sprite on a single clock, so they must agree on a frame length.
function frameLength(spriteName: string): number {
  const lengths = new Set(Object.values(sprite(spriteName).animations).map(({ length }) => length));
  if (lengths.size !== 1) throw new RangeError(`Animations of ${spriteName} need one shared frame length`);
  return [...lengths][0]!;
}

function heroDirection(facing: keyof HeroArt): HeroDirectionArt {
  const { frames } = sprite('hero');
  return {
    stand: frame('hero', `${facing}-stand`),
    settle: frame('hero', `${facing}-settle`),
    breathe: frame('hero', `${facing}-breathe`),
    blink: frames[`${facing}-blink`] ?? null,
    inhaleBlink: frames[`${facing}-inhale-blink`] ?? null,
    walk: animation('hero', `${facing}-walk`).frames,
    holding: frame('hero', `${facing}-holding`),
  };
}

export const heroArt: HeroArt = {
  down: heroDirection('down'),
  up: heroDirection('up'),
  left: heroDirection('left'),
  right: heroDirection('right'),
};
export const heroWalkFrameLength = frameLength('hero');

export const grassArt = variants('grass');
export const pathArt = variants('path');
export const waterArt = animatedVariants('water');
export const waterFrameLength = frameLength('water');
export const terrainArt: Readonly<Record<string, readonly Art[]>> = Object.fromEntries(
  Object.entries(sprite('terrain-transitions').animations).map(([corners, { frames }]) => [corners, frames]),
);

export const treeArt = Object.entries(sprite('tree').animations)
  .filter(([name]) => name.startsWith('variant-'))
  .map(([, { frames }]) => frames);
export const fruitTreeArt = {
  orange: animation('tree', 'fruit-orange').frames,
  apple: animation('tree', 'fruit-apple').frames,
  lemon: animation('tree', 'fruit-lemon').frames,
} as const;
export const treeFrameLength = frameLength('tree');
export const flowerArt = animatedVariants('flowers');
export const flowerFrameLength = frameLength('flowers');

export const stoneVariants = variants('stone');
export const signpostArt = frame('signpost', 'signpost');
// A fence piece is chosen by a four bit mask of its joined neighbors, so the pieces are looked up by number rather than by file order.
export const fenceArt = Array.from({ length: 16 }, (_, piece) => frame('fence', `piece-${piece}`));
export const doorArt = { closed: frame('door', 'closed'), open: frame('door', 'open') } as const;

export const orbArt = {
  red: frame('orb', 'red'),
  blue: frame('orb', 'blue'),
  violet: frame('orb', 'violet'),
  teal: frame('orb', 'teal'),
} as const;
export const starArt = frame('star', 'star');

export const lightMote = frame('light-mote', 'light-mote');

export function groundShadow(width: number, code: 'G1' | 'E2'): Art {
  return frame('ground-shadow', `${width}-${code}`);
}
