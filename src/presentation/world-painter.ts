import type { LevelView } from '../application/level-view';
import type { Area } from '../domain/level/collectibles';
import { Direction, TilePosition } from '../domain/level/position';
import { Ground } from '../domain/level/scenery';
import { arrivalMotes, revealed, risingEdge, shadowShown } from './arrival';
import type { Art } from './art/art';
import { ditherSteps, ditherThreshold } from './ordered-dither';
import { lighten, Picture, sprite, type Version } from './picture';
import {
  butterflyFrameLength,
  doorArt,
  flowerFrameLength,
  gateArt,
  plateArt,
  plateFrameLength,
  sideGateArt,
  groundShadow,
  lightMote,
  keyArt,
  starArt,
  boulderArt,
  treeFrameLength,
  waterFrameLength,
} from './sprite-library';
import { type Butterfly, dressWorld, type WorldDressing } from './world-dressing';
import { cameraPosition, clamp, heroPixels, tileSize } from './world-geometry';
import { crestLength, isDarkened, restorationAge } from './world-transition';

const starBob = [0, -1, 0, 1];
const keyFloatFrames = 150;
const keySwayFrames = 60;

// Rounding a sine holds each pixel longest near the turning points, so the key eases in and out instead of jerking.
export function keyOffset(frame: number): { readonly x: number; readonly y: number } {
  return {
    x: Math.round(Math.sin((2 * Math.PI * frame) / keySwayFrames)),
    y: Math.round(2 * Math.sin((2 * Math.PI * frame) / keyFloatFrames)),
  };
}
const butterflyArc = 6;
const butterflyFlutter = 2;
const butterflyFlutterBeats = 3;
// A resting butterfly still opens and closes its wings, only more slowly, so it never looks frozen.
const butterflyRestingBeat = 5;

// Smoothstep eases each flight off and onto a stop, and the arc and flutter are whole pixels like every other motion.
export function butterflyPlace(
  butterfly: Butterfly,
  frame: number,
): { readonly x: number; readonly y: number; readonly flying: boolean } {
  let time = (frame + butterfly.phase) % butterfly.cycle;
  for (const leg of butterfly.legs) {
    if (time < leg.rest) return { x: leg.from.x, y: leg.from.y, flying: false };
    time -= leg.rest;
    if (time < leg.flight) {
      const progress = time / leg.flight;
      const eased = progress * progress * (3 - 2 * progress);
      const lift =
        Math.sin(Math.PI * progress) * butterflyArc +
        Math.sin(2 * Math.PI * butterflyFlutterBeats * progress) * butterflyFlutter;
      return {
        x: Math.round(leg.from.x + (leg.to.x - leg.from.x) * eased),
        y: Math.round(leg.from.y + (leg.to.y - leg.from.y) * eased - lift),
        flying: true,
      };
    }
    time -= leg.flight;
  }
  const first = butterfly.legs[0]!.from;
  return { x: first.x, y: first.y, flying: false };
}

const motes = [
  [22, 0],
  [34, 37],
  [47, 14],
  [58, 51],
  [71, 26],
] as const;
const framesPerMoteRise = 4;
const framesPerGateFrame = 2;

export const plateSinkLength = (plateArt.length - 1) * plateFrameLength;

export interface Scene {
  readonly level: LevelView;
  readonly frame: number;
  readonly hero: Art;
  readonly arrival?: number;
  readonly plateDepth?: number;
}

const sized = (picture: Picture, target: Picture): Picture =>
  picture.width === target.width && picture.height === target.height
    ? picture
    : new Picture(target.width, target.height);

// A 3 x 3 box average makes the ramp interpolated between tile centers exactly three tiles wide across a straight area edge.
function seamCoverage(colored: Uint8Array, columns: number, rows: number): Float32Array {
  const at = (column: number, row: number): number =>
    colored[clamp(row, 0, rows - 1) * columns + clamp(column, 0, columns - 1)]!;
  return Float32Array.from({ length: columns * rows }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    let colorShare = 0;
    for (let above = -1; above <= 1; above++) {
      for (let beside = -1; beside <= 1; beside++) colorShare += at(column + beside, row + above);
    }
    return colorShare / 9;
  });
}

export class WorldPainter {
  private readonly dressing: WorldDressing;
  private colored = new Picture(0, 0);
  private before = new Picture(0, 0);
  private after = new Picture(0, 0);
  private readonly shadows = new Map<string, Art>();

  constructor(level: LevelView, random?: () => number) {
    this.dressing = dressWorld(level, random);
  }

  paint(target: Picture, scene: Scene, restored: readonly Area[]): void {
    this.compose(target, scene, restored);
  }

  paintRestoring(
    target: Picture,
    scene: Scene,
    origin: TilePosition,
    framesSinceStart: number,
    before: readonly Area[],
    after: readonly Area[],
  ): void {
    this.before = sized(this.before, target);
    this.after = sized(this.after, target);
    this.compose(this.before, scene, before);
    this.compose(this.after, scene, after);
    const view = cameraPosition(scene.level, target.width, target.height);
    for (let y = 0; y < target.height; y++) {
      for (let x = 0; x < target.width; x++) {
        const offset = y * target.width + x;
        const earlier = this.before.packedPixels[offset]!;
        const later = this.after.packedPixels[offset]!;
        if (earlier === later) {
          target.packedPixels[offset] = later;
          continue;
        }
        const age = restorationAge(x + view.x, y + view.y, origin, framesSinceStart);
        // Changing pixels first show their final color one ramp step lighter, so the wave ends by stepping down its ramp.
        target.packedPixels[offset] = age < 0 ? earlier : age < crestLength ? lighten(later) : later;
      }
    }
  }

  paintClosing(target: Picture, scene: Scene, framesSinceStart: number): void {
    this.paintVersion(target, scene, 'colored', scene.level.door.isOpen);
    const ink = new Picture(1, 1);
    ink.fill('Ink');
    for (let y = 0; y < target.height; y++) {
      for (let x = 0; x < target.width; x++) {
        if (isDarkened(x, y, framesSinceStart)) target.packedPixels[y * target.width + x] = ink.packedPixels[0]!;
      }
    }
  }

  // Color is split by tile rather than per prop, because a tree or the door can straddle two areas and only one of them may be restored.
  private compose(target: Picture, scene: Scene, restored: readonly Area[]): void {
    const { columns, rows } = scene.level.scenery.size;
    const colored = Uint8Array.from({ length: columns * rows }, (_, index) =>
      restored.some((area) => area.covers(TilePosition.at(index % columns, Math.floor(index / columns)))) ? 1 : 0,
    );
    const coloredTiles = colored.reduce((sum, tile) => sum + tile, 0);
    if (coloredTiles === colored.length) {
      this.paintVersion(target, scene, 'colored', scene.level.keys.length === 0);
      return;
    }
    this.paintVersion(target, scene, 'faded', false);
    if (coloredTiles === 0) return;
    this.colored = sized(this.colored, target);
    this.paintVersion(this.colored, scene, 'colored', false);
    const camera = cameraPosition(scene.level, target.width, target.height);
    const coverage = seamCoverage(colored, columns, rows);
    for (let y = 0; y < target.height; y++) {
      const worldY = y + camera.y;
      const along = (worldY + 0.5) / tileSize - 0.5;
      const row = Math.floor(along);
      const down = along - row;
      const upper = clamp(row, 0, rows - 1) * columns;
      const lower = clamp(row + 1, 0, rows - 1) * columns;
      for (let x = 0; x < target.width; x++) {
        const worldX = x + camera.x;
        const across = (worldX + 0.5) / tileSize - 0.5;
        const column = Math.floor(across);
        const right = across - column;
        const near = clamp(column, 0, columns - 1);
        const far = clamp(column + 1, 0, columns - 1);
        const top = coverage[upper + near]! * (1 - right) + coverage[upper + far]! * right;
        const bottom = coverage[lower + near]! * (1 - right) + coverage[lower + far]! * right;
        const blend = top * (1 - down) + bottom * down;
        // Smoothstep easing keeps the dither sparse at both ends, so color feathers in instead of starting at a visible edge.
        if (ditherThreshold(worldX, worldY) >= blend * blend * (3 - 2 * blend) * ditherSteps) continue;
        const offset = y * target.width + x;
        target.packedPixels[offset] = this.colored.packedPixels[offset]!;
      }
    }
  }

  // The door is drawn open once every key is picked up, so during the last restoration it opens exactly where color reaches it.
  private paintVersion(picture: Picture, scene: Scene, version: Version, doorLit: boolean): void {
    const { level, frame } = scene;
    const camera = cameraPosition(level, picture.width, picture.height);
    picture.fill('Ink');
    const draw = (
      art: Art,
      x: number,
      y: number,
      artVersion: Version = version,
      visible?: (x: number, y: number) => boolean,
    ): void => picture.draw(art, x - camera.x, y - camera.y, artVersion, visible);

    const waterFrame = Math.floor(frame / waterFrameLength) % 4;
    const { columns, rows } = level.scenery.size;
    for (
      let row = Math.floor((camera.y + tileSize / 2) / tileSize);
      row <= Math.floor((camera.y + picture.height - 1 + tileSize / 2) / tileSize);
      row++
    ) {
      for (
        let column = Math.floor((camera.x + tileSize / 2) / tileSize);
        column <= Math.floor((camera.x + picture.width - 1 + tileSize / 2) / tileSize);
        column++
      ) {
        const tile = this.dressing.ground[clamp(row, 0, rows) * (columns + 1) + clamp(column, 0, columns)]!;
        draw(
          tile.frames[waterFrame % tile.frames.length]!,
          column * tileSize - tileSize / 2,
          row * tileSize - tileSize / 2,
        );
      }
    }
    for (const lily of this.dressing.lilies) draw(lily.art, lily.x, lily.y);
    const woodland = this.dressing.woodland.filter(
      ({ base }) =>
        (base.column + 2) * tileSize > camera.x &&
        base.column * tileSize < camera.x + picture.width &&
        (base.row + 1) * tileSize > camera.y &&
        (base.row - 1) * tileSize < camera.y + picture.height,
    );
    for (const tree of [...level.scenery.trees, ...woodland]) {
      picture.shade(tree.base.column * tileSize - camera.x, tree.base.row * tileSize - 4 - camera.y, 64, 4);
    }

    level.scenery.flowers.forEach((flower, index) => {
      const { column, row } = flower.position;
      // The position offset staggers neighboring flowers, so they never sway in step.
      const sway = Math.floor((frame + (column * 11 + row * 17) * 7) / flowerFrameLength) % 2;
      draw(this.dressing.flowers[index]![sway]!, column * tileSize, row * tileSize);
    });
    if (level.plate) {
      const sunk = plateArt[Math.floor((scene.plateDepth ?? 0) / plateFrameLength)]!;
      draw(sunk, level.plate.column * tileSize, level.plate.row * tileSize);
    }

    const objects: { base: number; paint: () => void; shadow: () => void }[] = [];
    const shadow =
      (width: number, position: TilePosition, x: number, y: number): (() => void) =>
      () => {
        const code = level.scenery.groundAt(position).equals(Ground.Path) ? 'E2' : 'G1';
        const key = `${width}:${code}`;
        let art = this.shadows.get(key);
        if (!art) {
          art = groundShadow(width, code);
          this.shadows.set(key, art);
        }
        draw(art, x, y);
      };
    for (const { position, art } of this.dressing.undergrowth) {
      const x = position.column * tileSize;
      const y = position.row * tileSize;
      // Every undergrowth variant ends at row 26, so its shadow sits on the rows below.
      shadow(12, position, x + 10, y + 27)();
      draw(art, x, y);
    }
    level.scenery.trees.forEach((tree, index) => {
      const leaves = Math.floor((frame + index * 13) / treeFrameLength) % 2;
      const art = this.dressing.trees[index]![leaves]!;
      const x = tree.base.column * tileSize;
      const base = (tree.base.row + 1) * tileSize;
      objects.push({
        base,
        shadow: shadow(12, tree.base, x + 26, base - 4),
        paint: () => draw(art, x, base - art.rows.length),
      });
    });
    woodland.forEach((tree) => {
      const index = this.dressing.woodland.indexOf(tree) + level.scenery.trees.length;
      const leaves = Math.floor((frame + index * 13) / treeFrameLength) % 2;
      const art = tree.frames[leaves]!;
      const x = tree.base.column * tileSize;
      const base = (tree.base.row + 1) * tileSize;
      const ground = TilePosition.at(clamp(tree.base.column, 0, columns - 1), clamp(tree.base.row, 0, rows - 1));
      objects.push({
        base,
        shadow: shadow(12, ground, x + 26, base - 4),
        paint: () => draw(art, x, base - art.rows.length),
      });
    });
    level.stones.forEach((stone, index) => {
      const { column, row } = stone.position;
      objects.push({
        base: (row + 1) * tileSize,
        shadow: shadow(14, stone.position, column * tileSize + 9, row * tileSize + 27),
        paint: () => draw(this.dressing.stones[index]!, column * tileSize, row * tileSize),
      });
    });
    level.boulders.forEach((boulder) => {
      const { x, y } = boulder.place;
      objects.push({
        base: y + tileSize,
        shadow: shadow(14, boulder.position, x + 9, y + 27),
        paint: () => draw(boulderArt, x, y + tileSize - boulderArt.rows.length),
      });
    });
    level.scenery.fences.forEach((fence, index) => {
      const { column, row } = fence.position;
      objects.push({
        base: (row + 1) * tileSize,
        shadow: shadow(8, fence.position, column * tileSize + 12, row * tileSize + 27),
        paint: () => draw(this.dressing.fences[index]!, column * tileSize, row * tileSize),
      });
    });
    for (const gate of level.gates) {
      const { column, row } = gate.position;
      const { opening, open } = gate.swing === Direction.Up ? gateArt : sideGateArt;
      const swung = Math.min(Math.floor(gate.swung / framesPerGateFrame), opening.length - 1);
      const art =
        gate.state === 'open' ? open : opening[gate.state === 'closing' ? opening.length - 1 - swung : swung]!;
      const base = (row + 1) * tileSize;
      objects.push({
        base,
        shadow: () => undefined,
        paint: () => draw(art, column * tileSize, base - art.rows.length),
      });
    }
    const { door } = level;
    const doorBase = (door.left.row + 1) * tileSize;
    const doorFrame = doorLit ? doorArt.open : doorArt.closed;
    const doorTop = doorBase - doorFrame.rows.length;
    const doorLeft = door.left.column * tileSize;
    objects.push({
      base: doorBase,
      shadow: shadow(92, door.footprint[1]!, doorLeft + 2, doorBase - 5),
      paint: () => {
        draw(doorFrame, doorLeft, doorTop);
        if (!doorLit) return;
        for (const [column, offset] of motes) {
          const risen = (Math.floor(frame / framesPerMoteRise) + offset) % 64;
          const sway = Math.floor((frame + offset * 9) / 40) % 2;
          draw(lightMote, doorLeft + column + sway, doorTop + 88 - risen);
        }
      },
    });
    // A boulder rolls over stars and keys, so one under a boulder is drawn before everything else and stays hidden.
    const underBoulder = (tile: TilePosition): boolean => level.boulders.some((boulder) => boulder.covers(tile));
    for (const key of level.keys) {
      const { column, row } = key.position;
      const offset = keyOffset(frame);
      objects.push({
        base: underBoulder(key.position) ? -Infinity : (row + 1) * tileSize,
        shadow: shadow(12, key.position, column * tileSize + 10, row * tileSize + 27),
        paint: () =>
          draw(keyArt[key.material.name], column * tileSize + 4 + offset.x, row * tileSize + 4 + offset.y, 'colored'),
      });
    }
    for (const star of level.stars) {
      const { column, row } = star.position;
      const bob = starBob[Math.floor(frame / 10) % starBob.length]!;
      objects.push({
        base: underBoulder(star.position) ? -Infinity : (row + 1) * tileSize,
        shadow: shadow(12, star.position, column * tileSize + 10, row * tileSize + 27),
        paint: () => draw(starArt, column * tileSize + 4, row * tileSize + 4 + bob, 'colored'),
      });
    }
    const hero = heroPixels(level);
    const standingOn = level.hero.position;
    const heroShadow = shadow(14, standingOn, hero.x + 9, hero.y + tileSize);
    objects.push({
      base: hero.y + tileSize,
      shadow: () => {
        if (scene.arrival === undefined || shadowShown(scene.arrival)) heroShadow();
      },
      paint: () => {
        const age = scene.arrival;
        if (age === undefined) {
          draw(scene.hero, hero.x, hero.y, 'colored');
          return;
        }
        const left = hero.x - camera.x;
        const top = hero.y - camera.y;
        draw(scene.hero, hero.x, hero.y, 'colored', (x, y) => revealed(age, x - left, y - top));
        const edge = risingEdge(age);
        if (edge !== undefined) {
          const { width, colored } = sprite(scene.hero);
          for (let column = 0; column < width; column++) {
            if (colored[(edge * width + column) * 4 + 3] !== 0)
              draw(lightMote, hero.x + column, hero.y + edge, 'colored');
          }
        }
        for (const mote of arrivalMotes(age)) draw(lightMote, hero.x + mote.x, hero.y + mote.y, 'colored');
      },
    });
    objects.forEach((object) => object.shadow());
    objects.sort((a, b) => a.base - b.base).forEach((object) => object.paint());
    // Butterflies fly above every prop and the hero. They only exist in color, so the seam dither of a partly
    // restored world limits them to restored areas.
    if (version !== 'colored') return;
    for (const butterfly of this.dressing.butterflies) {
      const place = butterflyPlace(butterfly, frame);
      const beat = place.flying ? butterflyFrameLength : butterflyFrameLength * butterflyRestingBeat;
      const art = butterfly.frames[Math.floor((frame + butterfly.phase) / beat) % butterfly.frames.length]!;
      const { width } = sprite(art);
      const x = place.x - Math.floor(width / 2);
      const y = place.y - art.rows.length;
      if (x + width < camera.x || x > camera.x + picture.width || place.y < camera.y || y > camera.y + picture.height)
        continue;
      draw(art, x, y);
    }
  }
}
