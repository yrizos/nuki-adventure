import { Direction, FlowerVariant, Ground, type LevelView, TilePosition, TreeVariant } from '../../../level';
import type { Art } from '../../graphics/art';
import {
  fenceArt,
  flowerArt,
  fruitTreeArt,
  mossyStoneVariants,
  stoneVariants,
  treeArt,
} from '../../graphics/sprite-library';
import { type Butterfly, butterflies } from './butterfly-routes';
import { frogs, type Frog, type WaterLily, waterLilies } from './pond-life';
import { propVariants } from './prop-variants';
import {
  groundTiles,
  type GroundTile,
  treeVersion,
  type Undergrowth,
  undergrowth,
  type WoodlandTree,
  woodlandTrees,
} from './terrain';

export interface WorldDressing {
  readonly ground: readonly GroundTile[];
  readonly lilies: readonly WaterLily[];
  readonly frogs: readonly Frog[];
  readonly undergrowth: readonly Undergrowth[];
  readonly trees: readonly (readonly Art[])[];
  readonly woodland: readonly WoodlandTree[];
  readonly stones: readonly Art[];
  readonly flowers: readonly (readonly Art[])[];
  readonly fences: readonly Art[];
  readonly butterflies: readonly Butterfly[];
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
    (tree) => fruitArt.get(tree.variant) ?? treeVersion(plainChoices[plainTrees.indexOf(tree)]!, tree.base),
  );
  const nearWater = ({ column, row }: TilePosition): boolean =>
    [-2, -1, 0, 1, 2].some((down) =>
      [-2, -1, 0, 1, 2].some((across) => {
        const tile = TilePosition.at(column + across, row + down);
        return level.scenery.size.contains(tile) && level.scenery.groundAt(tile).equals(Ground.Water);
      }),
    );
  // Mossy art shares the plain art's shapes by index, so the no-touch rule still holds across both sets.
  const stones = propVariants(
    level.stones.map((stone) => [stone.position]),
    stoneVariants.length,
  ).map((choice, index) => (nearWater(level.stones[index]!.position) ? mossyStoneVariants : stoneVariants)[choice]!);
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
  const water = random ? waterLilies(level.scenery, random) : { lilies: [], ponds: [] };
  return {
    ground: groundTiles(level.scenery),
    lilies: water.lilies,
    frogs: random ? frogs(water, random) : [],
    undergrowth: undergrowth(level),
    trees,
    woodland: woodlandTrees(level.scenery),
    stones,
    flowers,
    fences,
    butterflies: butterflies(level.scenery),
  };
}
