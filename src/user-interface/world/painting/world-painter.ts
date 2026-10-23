import { type Area, Direction, Ground, type LevelSize, type LevelView, TilePosition } from '../../../level';
import { arrivalMotes, revealed, risingEdge, shadowShown } from '../transition/arrival';
import type { Art } from '../../graphics/art';
import { ditherSteps, ditherThreshold } from '../../graphics/ordered-dither';
import { lighten, Picture, sprite, type Version } from '../../graphics/picture';
import {
  butterflyFrameLength,
  doorArt,
  flowerFrameLength,
  gateArt,
  plateArt,
  plateFrameLength,
  sideGateArt,
  groundShadow,
  hintSparkleArt,
  lightMote,
  orbBurstFrameLength,
  orbBurstFrames,
  orbFrameLength,
  orbFrames,
  orbHues,
  boulderArt,
  treeFrameLength,
  waterFrameLength,
} from '../../graphics/sprite-library';
import { dressWorld, type WorldDressing } from '../dressing/world-dressing';
import { cameraPosition, clamp, heroPixels, tileSize } from '../world-geometry';
import { crestLength, isDarkened, restorationAge } from '../transition/world-transition';
import { type Bird, type BirdVisit, birdPlace } from '../creatures/bird-motion';
import { placeBirds } from '../creatures/bird-placement';
import { butterflyPlace, butterflyRestingBeat } from '../creatures/butterfly-motion';
import { frogPlace } from '../creatures/frog-motion';
import type { Point } from '../point';
import {
  orbFloat,
  orbInset,
  type OrbLook,
  orbPhaseSpacing,
  popColor,
  popSize,
  popSpeck,
  popSpecks,
} from '../creatures/orb-motion';

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
  readonly hint?: { readonly at: TilePosition; readonly step: number };
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
  private readonly size: LevelSize;
  private readonly grounds = new Map<string, Picture>();
  private colored = new Picture(0, 0);
  private before = new Picture(0, 0);
  private after = new Picture(0, 0);
  private readonly shadows = new Map<string, Art>();
  private readonly birds: readonly { readonly bird: Bird; readonly visit: BirdVisit }[];
  // Looks are kept by tile from the start, because collected orbs leave the level and must not shift the others' hues or phases.
  private readonly orbLooks = new Map<string, OrbLook>();

  constructor(level: LevelView, random?: () => number) {
    this.size = level.scenery.size;
    this.dressing = dressWorld(level, random);
    this.birds = placeBirds(level, this.dressing).map((bird) => ({ bird, visit: {} }));
    // Each orb takes a different hue until the rainbow runs out, so orbs in view never all look alike.
    const hues = [...orbHues];
    if (random) {
      for (let index = hues.length - 1; index > 0; index--) {
        const other = Math.min(Math.floor(random() * (index + 1)), index);
        [hues[index], hues[other]] = [hues[other]!, hues[index]!];
      }
    }
    level.orbs.forEach(({ position }, index) =>
      this.orbLooks.set(`${position.column},${position.row}`, {
        hue: hues[index % hues.length]!,
        phase: index * orbPhaseSpacing,
      }),
    );
  }

  // The ground never moves, so each version and water frame of it is drawn once and every paint copies from that.
  private groundPicture(version: Version, waterFrame: number): Picture {
    const animated = this.dressing.ground.some((tile) => tile.frames.length > 1);
    const key = `${version}:${animated ? waterFrame : 0}`;
    let picture = this.grounds.get(key);
    if (!picture) {
      const { columns, rows } = this.size;
      picture = new Picture((columns + 1) * tileSize, (rows + 1) * tileSize);
      picture.fill('Ink');
      for (const tile of this.dressing.ground) {
        picture.draw(
          tile.frames[waterFrame % tile.frames.length]!,
          tile.x + tileSize / 2,
          tile.y + tileSize / 2,
          version,
        );
      }
      this.grounds.set(key, picture);
    }
    return picture;
  }

  private orbLook({ column, row }: TilePosition): OrbLook | undefined {
    return this.orbLooks.get(`${column},${row}`);
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
    const look = this.orbLook(origin);
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
    if (!look) return;
    // The orb was last drawn on the frame it was collected, so the burst opens where the float had carried it.
    const float = orbFloat(scene.frame - framesSinceStart + look.phase);
    const centerX = (origin.column + 0.5) * tileSize + float.x - view.x;
    const centerY = (origin.row + 0.5) * tileSize + float.y - view.y;
    for (let index = 0; index < popSpecks; index++) {
      const speck = popSpeck(index, framesSinceStart);
      if (!speck) continue;
      for (let down = 0; down < popSize; down++) {
        for (let across = 0; across < popSize; across++) {
          const x = centerX + speck.x + across;
          const y = centerY + speck.y + down;
          if (x >= 0 && y >= 0 && x < target.width && y < target.height)
            target.packedPixels[y * target.width + x] = popColor;
        }
      }
    }
    const burst = orbBurstFrames[look.hue][Math.floor(framesSinceStart / orbBurstFrameLength)];
    if (!burst) return;
    const margin = (sprite(burst).width - sprite(orbFrames[look.hue][0]!).width) / 2;
    target.draw(
      burst,
      origin.column * tileSize + orbInset - margin + float.x - view.x,
      origin.row * tileSize + orbInset - margin + float.y - view.y,
      'colored',
    );
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
      this.paintVersion(target, scene, 'colored', scene.level.orbs.length === 0);
      return;
    }
    this.paintVersion(target, scene, 'faded', false);
    if (coloredTiles === 0) return;
    this.colored = sized(this.colored, target);
    this.paintVersion(this.colored, scene, 'colored', false);
    const camera = cameraPosition(scene.level, target.width, target.height);
    this.blendSeam(target, camera, seamCoverage(colored, columns, rows), columns, rows);
  }

  // Coverage is sampled at tile centers, so every pixel lies in the cell between four samples. A cell whose samples are all
  // uncolored or all colored blends to a constant, so only the cells that mix need the per-pixel dither.
  private blendSeam(target: Picture, camera: Point, coverage: Float32Array, columns: number, rows: number): void {
    const at = (column: number, row: number): number =>
      coverage[clamp(row, 0, rows - 1) * columns + clamp(column, 0, columns - 1)]!;
    const firstColumn = Math.floor((camera.x - tileSize / 2) / tileSize);
    const lastColumn = Math.floor((camera.x + target.width - 1 - tileSize / 2) / tileSize);
    for (let y = 0; y < target.height; y++) {
      const worldY = y + camera.y;
      const along = (worldY + 0.5) / tileSize - 0.5;
      const row = Math.floor(along);
      const down = along - row;
      for (let column = firstColumn; column <= lastColumn; column++) {
        const from = Math.max(0, column * tileSize + tileSize / 2 - camera.x);
        const to = Math.min(target.width, (column + 1) * tileSize + tileSize / 2 - camera.x);
        const upperNear = at(column, row);
        const upperFar = at(column + 1, row);
        const lowerNear = at(column, row + 1);
        const lowerFar = at(column + 1, row + 1);
        if (upperNear === 0 && upperFar === 0 && lowerNear === 0 && lowerFar === 0) continue;
        if (upperNear === 1 && upperFar === 1 && lowerNear === 1 && lowerFar === 1) {
          target.copy(this.colored, from, y, to - from, 1, from, y);
          continue;
        }
        for (let x = from; x < to; x++) {
          const worldX = x + camera.x;
          const right = (worldX + 0.5) / tileSize - 0.5 - column;
          const top = upperNear * (1 - right) + upperFar * right;
          const bottom = lowerNear * (1 - right) + lowerFar * right;
          const blend = top * (1 - down) + bottom * down;
          // Smoothstep easing keeps the dither sparse at both ends, so color feathers in instead of starting at a visible edge.
          if (ditherThreshold(worldX, worldY) >= blend * blend * (3 - 2 * blend) * ditherSteps) continue;
          const offset = y * target.width + x;
          target.packedPixels[offset] = this.colored.packedPixels[offset]!;
        }
      }
    }
  }

  // The door is drawn open once every orb is picked up, so during the last restoration it opens exactly where color reaches it.
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
    const firstRow = Math.floor((camera.y + tileSize / 2) / tileSize);
    const lastRow = Math.floor((camera.y + picture.height - 1 + tileSize / 2) / tileSize);
    const firstColumn = Math.floor((camera.x + tileSize / 2) / tileSize);
    const lastColumn = Math.floor((camera.x + picture.width - 1 + tileSize / 2) / tileSize);
    const ground = this.groundPicture(version, waterFrame);
    // Tiles beyond the map repeat the edge tile, so only the tiles inside the map come from the cached ground.
    for (let row = firstRow; row <= lastRow; row++) {
      for (let column = firstColumn; column <= lastColumn; column++) {
        if (row >= 0 && row <= rows && column >= 0 && column <= columns) continue;
        const tile = this.dressing.ground[clamp(row, 0, rows) * (columns + 1) + clamp(column, 0, columns)]!;
        draw(
          tile.frames[waterFrame % tile.frames.length]!,
          column * tileSize - tileSize / 2,
          row * tileSize - tileSize / 2,
        );
      }
    }
    const insideRow = Math.max(firstRow, 0);
    const insideColumn = Math.max(firstColumn, 0);
    if (insideRow <= Math.min(lastRow, rows) && insideColumn <= Math.min(lastColumn, columns)) {
      picture.copy(
        ground,
        insideColumn * tileSize,
        insideRow * tileSize,
        (Math.min(lastColumn, columns) - insideColumn + 1) * tileSize,
        (Math.min(lastRow, rows) - insideRow + 1) * tileSize,
        insideColumn * tileSize - tileSize / 2 - camera.x,
        insideRow * tileSize - tileSize / 2 - camera.y,
      );
    }
    for (const lily of this.dressing.lilies) draw(lily.art, lily.x, lily.y);
    // Frogs only exist in color, so like butterflies and birds the seam dither limits them to restored areas.
    if (version === 'colored')
      for (const frog of this.dressing.frogs) {
        const place = frogPlace(frog, frame);
        if (place)
          draw(
            place.art,
            place.x - Math.floor(sprite(place.art).width / 2),
            place.y - Math.floor(place.art.rows.length / 2),
          );
      }
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
    // The sparkle floats above the first drawn row of what it points at, since props reach above their tile.
    let hintTop = scene.hint ? scene.hint.at.row * tileSize : 0;
    const marks = (position: TilePosition, art: Art, top: number): void => {
      if (scene.hint?.at.equals(position)) hintTop = top + art.rows.findIndex((line) => /[^.]/.test(line));
    };
    level.boulders.forEach((boulder) => {
      const { x, y } = boulder.place;
      const top = y + tileSize - boulderArt.rows.length;
      marks(boulder.position, boulderArt, top);
      objects.push({
        base: y + tileSize,
        shadow: shadow(14, boulder.position, x + 9, y + 27),
        paint: () => draw(boulderArt, x, top),
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
      marks(gate.position, art, base - art.rows.length);
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
    // A boulder rolls over orbs, so one under a boulder is drawn before everything else and stays hidden.
    const underBoulder = (tile: TilePosition): boolean => level.boulders.some((boulder) => boulder.covers(tile));
    for (const orb of level.orbs) {
      const { column, row } = orb.position;
      const { hue, phase } = this.orbLook(orb.position) ?? { hue: orbHues[0], phase: 0 };
      const swirl = orbFrames[hue];
      const art = swirl[Math.floor((frame + phase) / orbFrameLength) % swirl.length]!;
      const float = orbFloat(frame + phase);
      objects.push({
        base: underBoulder(orb.position) ? -Infinity : (row + 1) * tileSize,
        shadow: shadow(12, orb.position, column * tileSize + 10, row * tileSize + 27),
        paint: () => draw(art, column * tileSize + orbInset + float.x, row * tileSize + orbInset + float.y, 'colored'),
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
    const sparkle = scene.hint && hintSparkleArt[scene.hint.step];
    if (scene.hint && sparkle) {
      const { column } = scene.hint.at;
      const { width, height } = sprite(sparkle);
      draw(sparkle, column * tileSize + Math.floor((tileSize - width) / 2), hintTop - height, 'colored');
    }
    // Butterflies and birds fly above every prop and the hero. They only exist in color, so the seam dither of a
    // partly restored world limits them to restored areas.
    if (version !== 'colored') return;
    const drawAbove = (art: Art, feet: Point): void => {
      const { width } = sprite(art);
      const x = feet.x - Math.floor(width / 2);
      const y = feet.y - art.rows.length;
      if (x + width < camera.x || x > camera.x + picture.width || feet.y < camera.y || y > camera.y + picture.height)
        return;
      draw(art, x, y);
    };
    for (const butterfly of this.dressing.butterflies) {
      const place = butterflyPlace(butterfly, frame);
      const beat = place.flying ? butterflyFrameLength : butterflyFrameLength * butterflyRestingBeat;
      drawAbove(butterfly.frames[Math.floor((frame + butterfly.phase) / beat) % butterfly.frames.length]!, place);
    }
    for (const { bird, visit } of this.birds) {
      const place = birdPlace(bird, frame, level.hero.feet, visit);
      if (place) drawAbove(place.art, place);
    }
  }
}
