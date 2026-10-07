import type { LevelView } from '../application/level-view';
import type { Area, OrbColor } from '../domain/level/collectibles';
import { Direction, TilePosition } from '../domain/level/position';
import { FlowerVariant, Ground, type Scenery, TreeVariant } from '../domain/level/scenery';
import type { Art } from './art/art';
import { ditherSteps, ditherThreshold } from './ordered-dither';
import { Picture, type Version } from './picture';
import {
  doorArt,
  fenceArt,
  flowerArt,
  flowerFrameLength,
  fruitTreeArt,
  grassArt,
  groundShadow,
  lightMote,
  orbArt,
  pathArt,
  signpostArt,
  starArt,
  stoneVariants,
  terrainArt,
  treeArt,
  treeFrameLength,
  waterArt,
  waterFrameLength,
} from './sprite-library';
import { cameraPosition, clamp, heroPixels, tileSize } from './world-geometry';
import { isDarkened, isRestored } from './world-transition';

const orbBob = [0, -1, 0, 1];
const motes = [
  [22, 0],
  [34, 37],
  [47, 14],
  [58, 51],
  [71, 26],
] as const;
const framesPerMoteRise = 4;

interface GroundTile {
  readonly x: number;
  readonly y: number;
  readonly frames: readonly Art[];
}

export interface Scene {
  readonly level: LevelView;
  readonly frame: number;
  readonly hero: Art;
  readonly heldOrb: OrbColor | null;
}

const sized = (picture: Picture, target: Picture): Picture =>
  picture.width === target.width && picture.height === target.height
    ? picture
    : new Picture(target.width, target.height);

// The ground is drawn half a tile off the level grid so that each drawn tile sees four level tiles at its corners, which keeps every transition inside one 16 tile set.
function groundTiles(scenery: Scenery): GroundTile[] {
  const { columns, rows } = scenery.size;
  const at = (column: number, row: number): Ground =>
    scenery.groundAt(TilePosition.at(clamp(column, 0, columns - 1), clamp(row, 0, rows - 1)));
  const tiles: GroundTile[] = [];
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const corners = [at(column - 1, row - 1), at(column, row - 1), at(column - 1, row), at(column, row)];
      const variant = (column * 5 + row * 3 + ((column * row) % 2)) % 3;
      const mask = (ground: Ground): number =>
        corners.reduce((bits, corner) => (bits << 1) | (corner.equals(ground) ? 1 : 0), 0);
      let frames: readonly Art[] | undefined;
      if (mask(Ground.Grass) === 15) frames = [grassArt[variant]!];
      else if (mask(Ground.Path) === 15) frames = [pathArt[variant]!];
      else if (mask(Ground.Water) === 15) frames = waterArt[variant];
      else
        frames =
          terrainArt[
            corners
              .map((ground) => (ground.equals(Ground.Water) ? 'w' : ground.equals(Ground.Path) ? 'p' : 'g'))
              .join('')
          ];
      if (!frames) throw new RangeError(`No ground art for ${column}, ${row}`);
      tiles.push({ x: column * tileSize - tileSize / 2, y: row * tileSize - tileSize / 2, frames });
    }
  }
  return tiles;
}

export function propVariants(footprints: readonly (readonly TilePosition[])[], count: number): readonly number[] {
  const choices = new Map<number, number>();
  const ordered = footprints
    .map((footprint, index) => ({ footprint, index }))
    .sort(
      (first, second) =>
        first.footprint[0]!.row - second.footprint[0]!.row || first.footprint[0]!.column - second.footprint[0]!.column,
    );
  for (const { footprint, index } of ordered) {
    const excluded = new Set<number>();
    for (const [neighbor, choice] of choices) {
      if (
        footprint.some((position) =>
          footprints[neighbor]!.some(
            (other) => Math.abs(position.column - other.column) + Math.abs(position.row - other.row) <= 1,
          ),
        )
      )
        excluded.add(choice);
    }
    const start = (footprint[0]!.column * 3 + footprint[0]!.row * 5) % count;
    const selected = Array.from({ length: count }, (_, offset) => (start + offset) % count).find(
      (choice) => !excluded.has(choice),
    );
    if (selected === undefined) throw new RangeError('Touching props need another art variant');
    choices.set(index, selected);
  }
  return footprints.map((_, index) => choices.get(index)!);
}

export class WorldPainter {
  private readonly ground: readonly GroundTile[];
  private colored = new Picture(0, 0);
  private before = new Picture(0, 0);
  private after = new Picture(0, 0);
  private readonly treeFrames: readonly (readonly Art[])[];
  private readonly stoneChoices: readonly number[];
  private readonly flowerChoices: readonly number[];
  private readonly fencePieces: readonly number[];
  private readonly shadows = new Map<string, Art>();

  constructor(level: LevelView) {
    this.ground = groundTiles(level.scenery);
    // A tree cluster shares one variant, so no-fruit trees only ever touch each other and are spread over their own art.
    const fruitArt = new Map([
      [TreeVariant.Oranges, fruitTreeArt.orange],
      [TreeVariant.Apples, fruitTreeArt.apple],
      [TreeVariant.Lemons, fruitTreeArt.lemon],
    ]);
    const plainTrees = level.scenery.trees.filter((tree) => tree.variant.equals(TreeVariant.NoFruit));
    const plainChoices = propVariants(
      plainTrees.map((tree) => tree.footprint),
      treeArt.length,
    );
    this.treeFrames = level.scenery.trees.map(
      (tree) => fruitArt.get(tree.variant) ?? treeArt[plainChoices[plainTrees.indexOf(tree)]!]!,
    );
    this.stoneChoices = propVariants(
      level.stones.map((stone) => [stone.position]),
      stoneVariants.length,
    );
    this.flowerChoices = propVariants(
      level.scenery.flowers.map((flower) => [flower.position]),
      level.scenery.flowerVariants.length,
    ).map((choice) => FlowerVariant.All.indexOf(level.scenery.flowerVariants[choice]!));
    const joins = (position: TilePosition): boolean =>
      level.door.covers(position) || level.scenery.fences.some((fence) => fence.position.equals(position));
    this.fencePieces = level.scenery.fences.map(({ position }) =>
      [Direction.Up, Direction.Down, Direction.Left, Direction.Right].reduce(
        (piece, direction) => (piece << 1) | (joins(position.neighbor(direction)) ? 1 : 0),
        0,
      ),
    );
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
        const offset = (y * target.width + x) * 4;
        const source = isRestored(x + view.x, y + view.y, origin, framesSinceStart) ? this.after : this.before;
        target.pixels.set(source.pixels.subarray(offset, offset + 4), offset);
      }
    }
  }

  paintClosing(target: Picture, scene: Scene, framesSinceStart: number): void {
    this.paintVersion(target, scene, 'colored', scene.level.door.isOpen);
    const ink = new Picture(1, 1);
    ink.fill('Ink');
    for (let y = 0; y < target.height; y++) {
      for (let x = 0; x < target.width; x++) {
        if (isDarkened(x, y, framesSinceStart)) target.pixels.set(ink.pixels, (y * target.width + x) * 4);
      }
    }
  }

  // Color is split by tile rather than per prop, because a tree or the door can straddle two areas and only one of them may be restored.
  private compose(target: Picture, scene: Scene, restored: readonly Area[]): void {
    const { columns, rows } = scene.level.scenery.size;
    const colored = Array.from({ length: columns * rows }, (_, index) =>
      restored.some((area) => area.covers(TilePosition.at(index % columns, Math.floor(index / columns)))),
    );
    if (colored.every(Boolean)) {
      this.paintVersion(target, scene, 'colored', scene.level.orbs.length === 0);
      return;
    }
    this.paintVersion(target, scene, 'faded', false);
    if (!colored.some(Boolean)) return;
    this.colored = sized(this.colored, target);
    this.paintVersion(this.colored, scene, 'colored', false);
    const camera = cameraPosition(scene.level, target.width, target.height);
    const share = (column: number, row: number): number =>
      colored[clamp(row, 0, rows - 1) * columns + clamp(column, 0, columns - 1)] ? 1 : 0;
    // Color fades between neighboring tile centers, so the seam is a one tile wide dither band rather than a hard tile edge.
    for (let y = 0; y < target.height; y++) {
      const worldY = y + camera.y;
      const along = (worldY + 0.5) / tileSize - 0.5;
      const row = Math.floor(along);
      const down = along - row;
      for (let x = 0; x < target.width; x++) {
        const worldX = x + camera.x;
        const across = (worldX + 0.5) / tileSize - 0.5;
        const column = Math.floor(across);
        const right = across - column;
        const top = share(column, row) * (1 - right) + share(column + 1, row) * right;
        const bottom = share(column, row + 1) * (1 - right) + share(column + 1, row + 1) * right;
        const blend = top * (1 - down) + bottom * down;
        if (ditherThreshold(worldX, worldY) >= blend * ditherSteps) continue;
        const offset = (y * target.width + x) * 4;
        target.pixels.set(this.colored.pixels.subarray(offset, offset + 4), offset);
      }
    }
  }

  // The door is drawn open once every orb is picked up, so during the last restoration it opens exactly where color reaches it.
  private paintVersion(picture: Picture, scene: Scene, version: Version, doorLit: boolean): void {
    const { level, frame } = scene;
    const camera = cameraPosition(level, picture.width, picture.height);
    picture.fill('Ink');
    const draw = (art: Art, x: number, y: number, artVersion: Version = version): void =>
      picture.draw(art, x - camera.x, y - camera.y, artVersion);

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
        const tile = this.ground[clamp(row, 0, rows) * (columns + 1) + clamp(column, 0, columns)]!;
        draw(
          tile.frames[waterFrame % tile.frames.length]!,
          column * tileSize - tileSize / 2,
          row * tileSize - tileSize / 2,
        );
      }
    }
    for (const tree of level.scenery.trees) {
      picture.shade(tree.base.column * tileSize - camera.x, tree.base.row * tileSize - 4 - camera.y, 64, 4);
    }

    level.scenery.flowers.forEach((flower, index) => {
      const { column, row } = flower.position;
      const sway = Math.floor((frame + (column * 11 + row * 17) * 7) / flowerFrameLength) % 2;
      draw(flowerArt[this.flowerChoices[index]!]![sway]!, column * tileSize, row * tileSize);
    });

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
    level.scenery.trees.forEach((tree, index) => {
      const leaves = Math.floor((frame + index * 13) / treeFrameLength) % 2;
      const art = this.treeFrames[index]![leaves]!;
      const x = tree.base.column * tileSize;
      const base = (tree.base.row + 1) * tileSize;
      objects.push({
        base,
        shadow: shadow(12, tree.base, x + 26, base - 4),
        paint: () => draw(art, x, base - art.rows.length),
      });
    });
    level.stones.forEach((stone, index) => {
      const { column, row } = stone.position;
      objects.push({
        base: (row + 1) * tileSize,
        shadow: shadow(14, stone.position, column * tileSize + 9, row * tileSize + 27),
        paint: () => draw(stoneVariants[this.stoneChoices[index]!]!, column * tileSize, row * tileSize),
      });
    });
    for (const signpost of level.signposts) {
      const { column, row } = signpost.position;
      const againstFence = level.scenery.fences.some((fence) =>
        fence.position.equals(signpost.position.neighbor(Direction.Up)),
      );
      const y = row * tileSize - (againstFence ? 12 : 0);
      objects.push({
        base: y + tileSize,
        shadow: shadow(10, signpost.position, column * tileSize + 11, y + 27),
        paint: () => draw(signpostArt, column * tileSize, y),
      });
    }
    level.scenery.fences.forEach((fence, index) => {
      const { column, row } = fence.position;
      objects.push({
        base: (row + 1) * tileSize,
        shadow: shadow(8, fence.position, column * tileSize + 12, row * tileSize + 27),
        paint: () => draw(fenceArt[this.fencePieces[index]!]!, column * tileSize, row * tileSize),
      });
    });
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
    for (const orb of level.orbs) {
      const { column, row } = orb.position;
      const bob = orbBob[Math.floor(frame / 10) % orbBob.length]!;
      objects.push({
        base: (row + 1) * tileSize,
        shadow: shadow(12, orb.position, column * tileSize + 10, row * tileSize + 27),
        paint: () => draw(orbArt[orb.color.name], column * tileSize + 4, row * tileSize + 4 + bob, 'colored'),
      });
    }
    for (const star of level.stars) {
      const { column, row } = star.position;
      const bob = orbBob[Math.floor(frame / 10) % orbBob.length]!;
      objects.push({
        base: (row + 1) * tileSize,
        shadow: shadow(12, star.position, column * tileSize + 10, row * tileSize + 27),
        paint: () => draw(starArt, column * tileSize + 4, row * tileSize + 4 + bob, 'colored'),
      });
    }
    const hero = heroPixels(level);
    const standingOn = level.hero.position;
    objects.push({
      base: hero.y + tileSize,
      shadow: shadow(14, standingOn, hero.x + 9, hero.y + tileSize),
      paint: () => {
        if (scene.heldOrb) draw(orbArt[scene.heldOrb.name], hero.x + 4, hero.y - 18, 'colored');
        draw(scene.hero, hero.x, hero.y, 'colored');
      },
    });
    objects.forEach((object) => object.shadow());
    objects.sort((a, b) => a.base - b.base).forEach((object) => object.paint());
  }
}
