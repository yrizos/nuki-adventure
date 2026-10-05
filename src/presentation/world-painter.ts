import type { Level, OrbColor } from '../domain/level/level';
import { Direction, TilePosition } from '../domain/level/position';
import { Ground, type Scenery } from '../domain/level/scenery';
import type { Art } from './art/art';
import { doorArt, fenceArt, flowerArt, grassArt, pathArt, terrainArt, treeArt, waterArt } from './art/scenery';
import { groundShadow, lightMote, orbArt, stoneVariants } from './art/sprites';
import { Picture, type Version } from './picture';

export const tileSize = 32;

const orbBob = [0, -1, 0, 1];
const motes = [[22, 0], [34, 37], [47, 14], [58, 51], [71, 26]] as const;
const framesPerMoteRise = 4;
const bayer = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const framesPerRing = 4;
const framesPerDarkening = 3;
export const closingLength = bayer.length * bayer.length * framesPerDarkening;

interface GroundTile {
  readonly x: number;
  readonly y: number;
  readonly frames: readonly Art[];
}

export interface Scene {
  readonly level: Level;
  readonly frame: number;
  readonly hero: Art;
  readonly heldOrb: OrbColor | null;
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

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
      const mask = (ground: Ground): number => corners.reduce((bits, corner) => (bits << 1) | (corner.equals(ground) ? 1 : 0), 0);
      let frames: readonly Art[] | undefined;
      if (mask(Ground.Grass) === 15) frames = [grassArt[variant]!];
      else if (mask(Ground.Path) === 15) frames = [pathArt[variant]!];
      else if (mask(Ground.Water) === 15) frames = waterArt[variant];
      else frames = terrainArt[corners.map((ground) => ground.equals(Ground.Water) ? 'w' : ground.equals(Ground.Path) ? 'p' : 'g').join('')];
      if (!frames) throw new RangeError(`No ground art for ${column}, ${row}`);
      tiles.push({ x: column * tileSize - tileSize / 2, y: row * tileSize - tileSize / 2, frames });
    }
  }
  return tiles;
}

export function propVariants(footprints: readonly (readonly TilePosition[])[], count: number): readonly number[] {
  const choices = new Map<number, number>();
  const ordered = footprints.map((footprint, index) => ({ footprint, index })).sort((first, second) =>
    first.footprint[0]!.row - second.footprint[0]!.row || first.footprint[0]!.column - second.footprint[0]!.column);
  for (const { footprint, index } of ordered) {
    const excluded = new Set<number>();
    for (const [neighbor, choice] of choices) {
      if (footprint.some((position) => footprints[neighbor]!.some((other) =>
        Math.abs(position.column - other.column) + Math.abs(position.row - other.row) <= 1))) excluded.add(choice);
    }
    const start = (footprint[0]!.column * 3 + footprint[0]!.row * 5) % count;
    const selected = Array.from({ length: count }, (_, offset) => (start + offset) % count).find((choice) => !excluded.has(choice));
    if (selected === undefined) throw new RangeError('Touching props need another art variant');
    choices.set(index, selected);
  }
  return footprints.map((_, index) => choices.get(index)!);
}

export function heroPixels(level: Level): { x: number; y: number } {
  const { position, step } = level.hero;
  const travelled = step ? Math.round((step.framesTaken / step.duration) * tileSize) : 0;
  const direction = step?.direction ?? Direction.Down;
  return {
    x: position.column * tileSize + (step ? direction.columnStep * travelled : 0),
    y: position.row * tileSize + (step ? direction.rowStep * travelled : 0),
  };
}

export class WorldPainter {
  private readonly ground: readonly GroundTile[];
  private colored = new Picture(0, 0);
  private faded = new Picture(0, 0);
  private readonly treeChoices: readonly number[];
  private readonly stoneChoices: readonly number[];
  private readonly fencePieces: readonly number[];
  private readonly shadows = new Map<string, Art>();

  constructor(private readonly level: Level) {
    this.ground = groundTiles(level.scenery);
    this.treeChoices = propVariants(level.scenery.trees.map((tree) => tree.footprint), treeArt.length);
    this.stoneChoices = propVariants(level.stones.map((stone) => [stone.position]), stoneVariants.length);
    const joins = (position: TilePosition): boolean =>
      level.door.covers(position) || level.scenery.fences.some((fence) => fence.position.equals(position));
    this.fencePieces = level.scenery.fences.map(({ position }) => [Direction.Up, Direction.Down, Direction.Left, Direction.Right]
      .reduce((piece, direction) => (piece << 1) | (joins(position.neighbor(direction)) ? 1 : 0), 0));
  }

  restorationLength(origin: TilePosition): number {
    const { columns, rows } = this.level.scenery.size;
    const rings = Math.max(origin.column, columns - 1 - origin.column, origin.row, rows - 1 - origin.row);
    return rings * framesPerRing + bayer.length * bayer.length;
  }

  paint(target: Picture, scene: Scene, version: Version): void {
    this.paintVersion(target, scene, version);
  }

  paintRestoring(target: Picture, scene: Scene, origin: TilePosition, framesSinceStart: number): void {
    if (this.colored.width !== target.width || this.colored.height !== target.height) {
      this.colored = new Picture(target.width, target.height);
      this.faded = new Picture(target.width, target.height);
    }
    this.paintVersion(this.colored, scene, 'colored');
    this.paintVersion(this.faded, scene, 'faded');
    const camera = this.camera(scene.level, target);
    for (let y = 0; y < target.height; y++) {
      for (let x = 0; x < target.width; x++) {
        const worldX = x + camera.x;
        const worldY = y + camera.y;
        const ring = Math.max(
          Math.abs(Math.floor(worldX / tileSize) - origin.column),
          Math.abs(Math.floor(worldY / tileSize) - origin.row),
        );
        const threshold = ring * framesPerRing + bayer[worldY & 3]![worldX & 3]!;
        const offset = (y * target.width + x) * 4;
        const source = framesSinceStart >= threshold ? this.colored : this.faded;
        target.pixels.set(source.pixels.subarray(offset, offset + 4), offset);
      }
    }
  }

  paintClosing(target: Picture, scene: Scene, framesSinceStart: number): void {
    this.paintVersion(target, scene, 'colored');
    const ink = new Picture(1, 1);
    ink.fill('Ink');
    for (let y = 0; y < target.height; y++) {
      for (let x = 0; x < target.width; x++) {
        if (framesSinceStart >= (bayer[y & 3]![x & 3]! + 1) * framesPerDarkening) target.pixels.set(ink.pixels, (y * target.width + x) * 4);
      }
    }
  }

  private camera(level: Level, picture: Picture): { x: number; y: number } {
    const hero = heroPixels(level);
    const follow = (heroStart: number, view: number, map: number): number => {
      // A view larger than the map cannot follow the hero, so the map is centered in it instead.
      if (view >= map) return Math.floor((map - view) / 2);
      return clamp(heroStart + tileSize / 2 - Math.floor(view / 2), 0, map - view);
    };
    return {
      x: follow(hero.x, picture.width, level.scenery.size.columns * tileSize),
      y: follow(hero.y, picture.height, level.scenery.size.rows * tileSize),
    };
  }

  private paintVersion(picture: Picture, scene: Scene, version: Version): void {
    const { level, frame } = scene;
    const camera = this.camera(level, picture);
    picture.fill('Ink');
    const draw = (art: Art, x: number, y: number, artVersion: Version = version): void =>
      picture.draw(art, x - camera.x, y - camera.y, artVersion);

    const waterFrame = Math.floor(frame / 15) % 4;
    const { columns, rows } = level.scenery.size;
    for (let row = Math.floor((camera.y + tileSize / 2) / tileSize); row <= Math.floor((camera.y + picture.height - 1 + tileSize / 2) / tileSize); row++) {
      for (let column = Math.floor((camera.x + tileSize / 2) / tileSize); column <= Math.floor((camera.x + picture.width - 1 + tileSize / 2) / tileSize); column++) {
        const tile = this.ground[clamp(row, 0, rows) * (columns + 1) + clamp(column, 0, columns)]!;
        draw(tile.frames[waterFrame % tile.frames.length]!, column * tileSize - tileSize / 2, row * tileSize - tileSize / 2);
      }
    }
    for (const tree of level.scenery.trees) {
      picture.shade(tree.base.column * tileSize - camera.x, tree.base.row * tileSize - 4 - camera.y, 64, 4);
    }

    for (const flower of level.scenery.flowers) {
      const { column, row } = flower.position;
      const sway = Math.floor((frame + (column * 11 + row * 17) * 7) / 30) % 2;
      draw(flowerArt[(column * 7 + row * 3) % flowerArt.length]![sway]!, column * tileSize, row * tileSize);
    }

    const { door } = level;
    const doorBase = (door.left.row + 1) * tileSize;
    const doorLit = door.isOpen && version === 'colored';

    const objects: { base: number; paint: () => void; shadow: () => void }[] = [];
    const shadow = (width: number, position: TilePosition, x: number, y: number): (() => void) => () => {
      const code = level.scenery.groundAt(position).equals(Ground.Path) ? 'E2' : 'G1';
      const key = `${width}:${code}`;
      let art = this.shadows.get(key);
      if (!art) { art = groundShadow(width, code); this.shadows.set(key, art); }
      draw(art, x, y);
    };
    level.scenery.trees.forEach((tree, index) => {
      const leaves = Math.floor((frame + index * 13) / 40) % 2;
      const art = treeArt[this.treeChoices[index]!]![leaves]!;
      const x = tree.base.column * tileSize;
      const base = (tree.base.row + 1) * tileSize;
      objects.push({ base, shadow: shadow(12, tree.base, x + 26, base - 4), paint: () => draw(art, x, base - art.rows.length) });
    });
    level.stones.forEach((stone, index) => {
      const { column, row } = stone.position;
      objects.push({ base: (row + 1) * tileSize, shadow: shadow(14, stone.position, column * tileSize + 9, row * tileSize + 27),
        paint: () => draw(stoneVariants[this.stoneChoices[index]!]!, column * tileSize, row * tileSize) });
    });
    level.scenery.fences.forEach((fence, index) => {
      const { column, row } = fence.position;
      objects.push({ base: (row + 1) * tileSize, shadow: shadow(8, fence.position, column * tileSize + 12, row * tileSize + 27),
        paint: () => draw(fenceArt[this.fencePieces[index]!]!, column * tileSize, row * tileSize) });
    });
    // The faded world keeps the door closed, so during restoration it opens exactly where color reaches it.
    const doorFrame = doorLit ? doorArt.open : doorArt.closed;
    const doorTop = doorBase - doorFrame.rows.length;
    const doorLeft = door.left.column * tileSize;
    objects.push({ base: doorBase, shadow: shadow(92, door.footprint[1]!, doorLeft + 2, doorBase - 5),
      paint: () => {
        draw(doorFrame, doorLeft, doorTop);
        if (!doorLit) return;
        for (const [column, offset] of motes) {
          const risen = (Math.floor(frame / framesPerMoteRise) + offset) % 64;
          const sway = Math.floor((frame + offset * 9) / 40) % 2;
          draw(lightMote, doorLeft + column + sway, doorTop + 88 - risen);
        }
      } });
    const orb = level.orb;
    if (orb) {
      const { column, row } = orb.position;
      const bob = orbBob[Math.floor(frame / 10) % orbBob.length]!;
      objects.push({
        base: (row + 1) * tileSize,
        shadow: shadow(12, orb.position, column * tileSize + 10, row * tileSize + 27),
        paint: () => draw(orbArt[orb.color.name], column * tileSize + 4, row * tileSize + 4 + bob, 'colored'),
      });
    }
    const hero = heroPixels(level);
    const { position, step } = level.hero;
    const standingOn = step && step.framesTaken >= step.duration / 2 ? position.neighbor(step.direction) : position;
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
