import type { LevelView } from '../application/level-view';
import { Direction, TilePosition } from '../domain/level/position';
import { FlowerVariant, Ground, type Scenery, TreeVariant } from '../domain/level/scenery';
import type { Art } from './art/art';
import {
  fenceArt,
  flowerArt,
  fruitTreeArt,
  grassArt,
  pathArt,
  stoneVariants,
  terrainArt,
  treeArt,
  waterArt,
  waterLilyVariants,
} from './sprite-library';
import { clamp, tileSize } from './world-geometry';

interface GroundTile {
  readonly x: number;
  readonly y: number;
  readonly frames: readonly Art[];
}

interface WoodlandTree {
  readonly base: TilePosition;
  readonly frames: readonly Art[];
}

// ponytail: fixed 8-tile margin, derive from the largest view if maps shrink below the view
const woodlandMargin = 8;

// A tree starts on every woodland tile, because canopies placed two tiles apart leave grass showing where their rounded edges meet.
function woodlandTrees(scenery: Scenery): WoodlandTree[] {
  if (scenery.woodland.tiles.length === 0) return [];
  const { columns, rows } = scenery.size;
  const wooded = (column: number, row: number): boolean =>
    column < 0 || row < 0 || column >= columns || row >= rows || scenery.woodland.covers(TilePosition.at(column, row));
  const bases: TilePosition[] = [];
  for (let row = -woodlandMargin; row < rows + woodlandMargin; row++) {
    for (let column = -woodlandMargin; column < columns + woodlandMargin; column++) {
      if (!wooded(column, row) || (column > -woodlandMargin && wooded(column - 1, row))) continue;
      let end = column;
      while (end + 1 < columns + woodlandMargin && wooded(end + 1, row)) end++;
      for (let start = column; start < Math.max(end, column + 1); start++) bases.push(TilePosition.at(start, row));
    }
  }
  // propVariants derives its starting choice from the position, which must not be negative.
  const choices = propVariants(
    bases.map(({ column, row }) => [
      TilePosition.at(column + woodlandMargin, row + woodlandMargin),
      TilePosition.at(column + woodlandMargin + 1, row + woodlandMargin),
    ]),
    treeArt.length,
  );
  return bases.map((base, index) => ({ base, frames: treeArt[choices[index]!]! }));
}

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

interface WaterLily {
  readonly x: number;
  readonly y: number;
  readonly art: Art;
}

const lilyDrift = 4;
const secondGroupArea = 12;

// Pads sit on the half-offset ground grid, where four water corners mean a tile with no shore foam at all.
function waterLilies(scenery: Scenery, random: () => number): WaterLily[] {
  const { columns, rows } = scenery.size;
  const isWater = (column: number, row: number): boolean =>
    scenery.groundAt(TilePosition.at(column, row)).equals(Ground.Water);
  const open = new Set<number>();
  for (let row = 1; row < rows; row++)
    for (let column = 1; column < columns; column++)
      if (isWater(column - 1, row - 1) && isWater(column, row - 1) && isWater(column - 1, row) && isWater(column, row))
        open.add(row * columns + column);
  // Column 0 is never open, so stepping one key across a row edge can never land on an open tile.
  const neighbors = (key: number): number[] =>
    [key - 1, key + 1, key - columns, key + columns].filter((next) => open.has(next));
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
  const between = (low: number, high: number): number => low + Math.floor(random() * (high - low + 1));
  const chosen: number[] = [];
  const seen = new Set<number>();
  for (const start of open) {
    if (seen.has(start)) continue;
    seen.add(start);
    const pond = [start];
    for (let index = 0; index < pond.length; index++)
      for (const next of neighbors(pond[index]!))
        if (!seen.has(next)) {
          seen.add(next);
          pond.push(next);
        }
    const taken = new Set<number>();
    const grow = (seed: number, size: number): void => {
      taken.add(seed);
      const group = [seed];
      while (group.length < size) {
        const frontier = group.flatMap(neighbors).filter((next) => !taken.has(next));
        if (frontier.length === 0) break;
        const next = pick(frontier);
        taken.add(next);
        group.push(next);
      }
      chosen.push(...group);
    };
    grow(pick(pond), between(3, 5));
    if (pond.length >= secondGroupArea) {
      const apart = pond.filter((key) => !taken.has(key) && neighbors(key).every((next) => !taken.has(next)));
      if (apart.length > 0) grow(pick(apart), between(2, 3));
    }
  }
  const positions = chosen.map((key) => TilePosition.at(key % columns, Math.floor(key / columns)));
  const drift = (): number => Math.round((random() * 2 - 1) * lilyDrift);
  const choices = propVariants(
    positions.map((position) => [position]),
    waterLilyVariants.length,
  );
  return positions.map((position, index) => ({
    x: position.column * tileSize - tileSize / 2 + drift(),
    y: position.row * tileSize - tileSize / 2 + drift(),
    art: waterLilyVariants[choices[index]!]!,
  }));
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

export interface WorldDressing {
  readonly ground: readonly GroundTile[];
  readonly lilies: readonly WaterLily[];
  readonly trees: readonly (readonly Art[])[];
  readonly woodland: readonly WoodlandTree[];
  readonly stones: readonly Art[];
  readonly flowers: readonly (readonly Art[])[];
  readonly fences: readonly Art[];
}

export function dressWorld(level: LevelView, random?: () => number): WorldDressing {
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
  const trees = level.scenery.trees.map(
    (tree) => fruitArt.get(tree.variant) ?? treeArt[plainChoices[plainTrees.indexOf(tree)]!]!,
  );
  const stones = propVariants(
    level.stones.map((stone) => [stone.position]),
    stoneVariants.length,
  ).map((choice) => stoneVariants[choice]!);
  const flowers = propVariants(
    level.scenery.flowers.map((flower) => [flower.position]),
    level.scenery.flowerVariants.length,
  ).map((choice) => flowerArt[FlowerVariant.All.indexOf(level.scenery.flowerVariants[choice]!)]!);
  const joins = (position: TilePosition): boolean => level.scenery.joinsFence(position, level.door, level.gates);
  const fences = level.scenery.fences.map(
    ({ position }) =>
      fenceArt[
        [Direction.Up, Direction.Down, Direction.Left, Direction.Right].reduce(
          (piece, direction) => (piece << 1) | (joins(position.neighbor(direction)) ? 1 : 0),
          0,
        )
      ]!,
  );
  return {
    ground: groundTiles(level.scenery),
    lilies: random ? waterLilies(level.scenery, random) : [],
    trees,
    woodland: woodlandTrees(level.scenery),
    stones,
    flowers,
    fences,
  };
}
