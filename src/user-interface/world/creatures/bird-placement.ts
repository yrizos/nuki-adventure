import { type LevelView, TilePosition, TreeVariant, Ground } from '../../../level';
import type { Art } from '../../graphics/art';
import { birdArt } from '../../graphics/sprite-library';
import { sprite } from '../../graphics/picture';
import type { WorldDressing } from '../dressing/world-dressing';
import { tileSize } from '../world-geometry';
import { type Bird, type BirdHabit, birdApproach, fleeReach } from './bird-motion';
import { between, type Point } from '../point';

// A visit is under half its cycle, so a bird is away longer than it stays. Cycles differ by bird, so birds drift out of step.
const birdVisitCycle = 3000;
const birdCycleSpread = 300;
const shortestBirdStay = 900;
const birdStaySpread = 300;
// A crossing sweeps the whole map and every view it passes, so it repeats far less often than a visit.
const birdSkyCycle = 10800;
// Ground birds keep clear of the tiles within flee distance of the hero start, so none flees the moment a level begins.
const birdStartClearance = 2;
const treesPerBird = 8;
const openTilesPerBird = 32;
const mostPerchingBirds = 3;
const mostGroundBirds = 3;

const spread = <T>(items: readonly T[], count: number): T[] =>
  Array.from({ length: count }, (_, index) => items[Math.floor(((index + 0.5) * items.length) / count)]!);

// Birds perch on plain and woodland trees, which butterflies skip, hop on open grass and cross the sky.
export function placeBirds(level: LevelView, dressing: WorldDressing): Bird[] {
  const { scenery } = level;
  const { columns, rows } = scenery.size;
  const visitor = (habit: BirdHabit, home: Point, spots: readonly Point[], index: number): Bird => {
    const seed = Math.floor(home.x / tileSize) * 3 + Math.floor(home.y / tileSize) * 5 + index * 7;
    const sign = seed % 2 === 0 ? 1 : -1;
    const cycle = birdVisitCycle + (seed % 4) * birdCycleSpread;
    return {
      habit,
      from: { x: home.x - sign * birdApproach.x, y: home.y - birdApproach.y },
      home,
      to: { x: home.x + sign * birdApproach.x, y: home.y - birdApproach.y },
      spots,
      stay: shortestBirdStay + ((seed * 29) % birdStaySpread),
      cycle,
      phase: (seed * 37 * 13) % cycle,
    };
  };
  // Feet sit one pixel into the top of the canopy, found on the middle column of the tree art.
  const canopyTop = (base: TilePosition, art: Art): Point => {
    const { width, height, colored } = sprite(art);
    const middle = Math.floor(width / 2);
    let top = 0;
    while (top < height - 1 && colored[(top * width + middle) * 4 + 3] === 0) top++;
    return { x: base.column * tileSize + middle, y: (base.row + 1) * tileSize - height + top + 1 };
  };
  const tops = [
    ...scenery.trees.flatMap((tree, index) =>
      tree.variant.equals(TreeVariant.NoFruit) ? [canopyTop(tree.base, dressing.trees[index]![0]!)] : [],
    ),
    ...dressing.woodland
      .filter(({ base }) => scenery.size.contains(base))
      .map(({ base, frames }) => canopyTop(base, frames[0]!)),
  ];
  const perchingWanted = Math.min(mostPerchingBirds, Math.ceil(tops.length / treesPerBird));
  const start = level.hero.position;
  const taken = [
    ...scenery.flowers.map((flower) => flower.position),
    ...level.stones.map((stone) => stone.position),
    ...level.orbs.map((orb) => orb.position),
    ...dressing.undergrowth.map(({ position }) => position),
    ...(level.plate ? [level.plate] : []),
  ];
  const open: Point[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const position = TilePosition.at(column, row);
      if (
        !scenery.groundAt(position).equals(Ground.Grass) ||
        !scenery.isWalkable(position) ||
        scenery.hides(position) ||
        scenery.trees.some((tree) => tree.hides(position)) ||
        level.door.covers(position) ||
        level.gates.some((gate) => gate.covers(position)) ||
        level.boulders.some((boulder) => boulder.covers(position)) ||
        taken.some((other) => other.equals(position)) ||
        Math.max(Math.abs(column - start.column), Math.abs(row - start.row)) <= birdStartClearance
      )
        continue;
      open.push({ x: column * tileSize + tileSize / 2, y: row * tileSize + tileSize / 2 });
    }
  }
  const groundWanted = Math.min(mostGroundBirds, Math.ceil(open.length / openTilesPerBird));
  // Visitors and the sky bird always number fewer than the butterflies, so a level never shows more birds than butterflies.
  const room = Math.max(0, dressing.butterflies.length - 2);
  const perchingCount = Math.min(perchingWanted, Math.max(room - groundWanted, Math.ceil(room / 2)));
  const perching = spread(tops, perchingCount);
  const grounded = spread(open, Math.min(groundWanted, room - perchingCount));
  // The crossing starts and ends one bird width beyond the map, so the bird enters and leaves the picture whole.
  const margin = sprite(birdArt.right.fly[0]!).width;
  const skySeed = columns * 3 + rows * 5;
  const skyRight = skySeed % 2 === 0;
  const skyY = Math.round(rows * tileSize * (0.25 + (skySeed % 5) / 10));
  const width = columns * tileSize;
  return [
    ...perching.map((home, index) => visitor('perch', home, [], index)),
    ...grounded.map((home, index) =>
      visitor(
        'ground',
        home,
        open.filter((spot) => between(spot, home) <= fleeReach),
        index + perching.length,
      ),
    ),
    {
      habit: 'sky',
      from: { x: skyRight ? -margin : width + margin, y: skyY },
      home: { x: width / 2, y: skyY },
      to: { x: skyRight ? width + margin : -margin, y: skyY - tileSize },
      spots: [],
      stay: 0,
      cycle: birdSkyCycle,
      phase: (skySeed * 37 * 13) % birdSkyCycle,
    },
  ];
}
