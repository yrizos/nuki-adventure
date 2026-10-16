import type { LevelView } from '../application/level-view';
import type { Area } from '../domain/level/collectibles';
import { Direction, TilePosition } from '../domain/level/position';
import { Ground, TreeVariant } from '../domain/level/scenery';
import { arrivalMotes, revealed, risingEdge, shadowShown } from './arrival';
import type { Art } from './art/art';
import { ditherSteps, ditherThreshold } from './ordered-dither';
import { lighten, Picture, sprite, type Version } from './picture';
import {
  birdArt,
  birdFrameLength,
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
import { type Butterfly, type ButterflyLeg, dressWorld, type WorldDressing } from './world-dressing';
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

type Point = ButterflyLeg['from'];

// Smoothstep eases each flight off and onto a stop, and the arc and flutter are whole pixels like every other motion.
function arc(from: Point, to: Point, progress: number, height: number, wobble = 0): Point {
  const eased = progress * progress * (3 - 2 * progress);
  return {
    x: Math.round(from.x + (to.x - from.x) * eased),
    y: Math.round(from.y + (to.y - from.y) * eased - Math.sin(Math.PI * progress) * height - wobble),
  };
}

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
      const flutter = Math.sin(2 * Math.PI * butterflyFlutterBeats * progress) * butterflyFlutter;
      return { ...arc(leg.from, leg.to, progress, butterflyArc, flutter), flying: true };
    }
    time -= leg.flight;
  }
  const first = butterfly.legs[0]!.from;
  return { x: first.x, y: first.y, flying: false };
}

type Facing = keyof typeof birdArt;
type BirdHabit = 'perch' | 'ground' | 'sky';

export interface Bird {
  readonly habit: BirdHabit;
  readonly from: Point;
  readonly home: Point;
  readonly to: Point;
  // Open grass a ground bird may flee to.
  readonly spots: readonly Point[];
  readonly stay: number;
  readonly cycle: number;
  readonly phase: number;
}

// Where a visiting bird stands now. A painter keeps one per bird, because fleeing depends on where the hero has been.
export interface BirdVisit {
  round?: number;
  anchor?: Point;
  landed?: number;
  flight?:
    | {
        readonly from: Point;
        readonly to: Point;
        readonly start: number;
        readonly length: number;
        readonly leaving: boolean;
      }
    | undefined;
}

export interface BirdPlace {
  readonly x: number;
  readonly y: number;
  readonly art: Art;
}

const birdFlightSpeed = 1.5;
const shortestBirdFlight = 18;
const birdArc = 10;
const birdFleeArc = 6;
// Visits start and end this far up and to the side, about half a portrait view, so a bird flies in from the edge of the screen instead of appearing beside the hero.
const birdApproach = { x: 160, y: 112 };
// A visit is under a quarter of its cycle, so a bird is away far longer than it stays. Cycles differ by bird, so birds drift out of step and the level often has none.
const birdVisitCycle = 4800;
const birdCycleSpread = 300;
const shortestBirdStay = 600;
const birdStaySpread = 300;
// A crossing sweeps the whole map and every view it passes, so it repeats far less often than a visit.
const birdSkyCycle = 10800;
const birdSkyWave = 3;
const fleeDistance = 48;
const fleeReach = 3 * tileSize;
// Ground birds keep clear of the tiles within flee distance of the hero start, so none flees the moment a level begins.
const birdStartClearance = 2;
const treesPerBird = 16;
const openTilesPerBird = 64;
const mostPerchingBirds = 2;
const mostGroundBirds = 2;
const birdHopStride = 8;
const pecksPerStop = 2;
const hopsPerStride = 2;

const between = (first: Point, second: Point): number => Math.hypot(first.x - second.x, first.y - second.y);
const birdFlight = (from: Point, to: Point): number =>
  Math.max(shortestBirdFlight, Math.round(between(from, to) / birdFlightSpeed));
const heading = (from: Point, to: Point, otherwise: Facing): Facing =>
  to.x > from.x ? 'right' : to.x < from.x ? 'left' : otherwise;
const spread = <T>(items: readonly T[], count: number): T[] =>
  Array.from({ length: count }, (_, index) => items[Math.floor(((index + 0.5) * items.length) / count)]!);

// A ground bird pecks, hops a stride along, pecks, turns and hops back, so it stays within one stride of where it landed.
function strut(
  anchor: Point,
  facing: Facing,
  since: number,
): { readonly spot: Point; readonly animation: 'hop' | 'peck'; readonly facing: Facing; readonly time: number } {
  const peck = pecksPerStop * birdArt[facing].peck.length * birdFrameLength;
  const hop = hopsPerStride * birdArt[facing].hop.length * birdFrameLength;
  const time = since % (2 * (peck + hop));
  const out = time < peck + hop;
  const local = out ? time : time - peck - hop;
  const hopped = local < peck ? 0 : Math.round((birdHopStride * (local - peck)) / hop);
  const offset = out ? hopped : birdHopStride - hopped;
  const sign = facing === 'right' ? 1 : -1;
  return {
    spot: { x: anchor.x + sign * offset, y: anchor.y },
    animation: local < peck ? 'peck' : 'hop',
    facing: out ? facing : facing === 'right' ? 'left' : 'right',
    time: local < peck ? local : local - peck,
  };
}

export function birdPlace(bird: Bird, frame: number, hero: Point, visit: BirdVisit): BirdPlace | undefined {
  const clock = frame + bird.phase;
  const time = clock % bird.cycle;
  const side = heading(bird.from, bird.to, 'right');
  const pose = (animation: keyof (typeof birdArt)[Facing], facing: Facing, spot: Point, since = clock): BirdPlace => {
    const frames = birdArt[facing][animation];
    return { ...spot, art: frames[Math.floor(since / birdFrameLength) % frames.length]! };
  };
  if (bird.habit === 'sky') {
    const crossing = birdFlight(bird.from, bird.to);
    if (time >= crossing) return undefined;
    const progress = time / crossing;
    return pose('fly', side, {
      x: Math.round(bird.from.x + (bird.to.x - bird.from.x) * progress),
      y: Math.round(
        bird.from.y + (bird.to.y - bird.from.y) * progress + Math.sin(2 * Math.PI * 3 * progress) * birdSkyWave,
      ),
    });
  }
  const travel = birdFlight(bird.from, bird.home);
  const since = time - (bird.cycle - 2 * travel - bird.stay);
  if (since < 0) return undefined;
  if (since < travel) return pose('fly', side, arc(bird.from, bird.home, since / travel, birdArc));
  const round = Math.floor(clock / bird.cycle);
  if (visit.round !== round || frame < (visit.flight?.start ?? visit.landed ?? 0)) {
    visit.round = round;
    visit.anchor = bird.home;
    visit.landed = frame - since + travel;
    visit.flight = undefined;
  }
  const { flight } = visit;
  if (flight) {
    const into = frame - flight.start;
    if (into < flight.length)
      return pose(
        'fly',
        heading(flight.from, flight.to, side),
        arc(flight.from, flight.to, into / flight.length, birdFleeArc),
      );
    if (flight.leaving) return undefined;
    visit.anchor = flight.to;
    visit.landed = flight.start + flight.length;
    visit.flight = undefined;
  }
  const standing = (at: number) =>
    bird.habit === 'perch'
      ? { spot: visit.anchor!, animation: 'perch' as const, facing: side, time: clock }
      : strut(visit.anchor!, side, at - visit.landed!);
  const departure = Math.max(frame - since + travel + bird.stay, visit.landed!);
  if (frame < departure) {
    const now = standing(frame);
    if (bird.habit === 'ground' && between(now.spot, hero) < fleeDistance) {
      const refuge = bird.spots
        .filter((spot) => between(spot, hero) >= fleeDistance && between(spot, now.spot) <= fleeReach)
        .reduce<Point | undefined>(
          (best, spot) => (!best || between(spot, hero) > between(best, hero) ? spot : best),
          undefined,
        );
      const away = now.spot.x >= hero.x ? 1 : -1;
      const to = refuge ?? { x: now.spot.x + away * birdApproach.x, y: now.spot.y - birdApproach.y };
      visit.flight = { from: now.spot, to, start: frame, length: birdFlight(now.spot, to), leaving: !refuge };
      return pose('fly', heading(now.spot, to, side), now.spot);
    }
    return pose(now.animation, now.facing, now.spot, now.time);
  }
  const from = standing(departure).spot;
  const to = { x: from.x + bird.to.x - bird.home.x, y: from.y + bird.to.y - bird.home.y };
  const into = frame - departure;
  return into < travel ? pose('fly', side, arc(from, to, into / travel, birdArc)) : undefined;
}

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
  const perching = spread(tops, Math.min(mostPerchingBirds, Math.ceil(tops.length / treesPerBird)));
  const start = level.hero.position;
  const taken = [
    ...scenery.flowers.map((flower) => flower.position),
    ...level.stones.map((stone) => stone.position),
    ...level.keys.map((key) => key.position),
    ...level.stars.map((star) => star.position),
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
  const grounded = spread(open, Math.min(mostGroundBirds, Math.ceil(open.length / openTilesPerBird)));
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
  private readonly birds: readonly { readonly bird: Bird; readonly visit: BirdVisit }[];

  constructor(level: LevelView, random?: () => number) {
    this.dressing = dressWorld(level, random);
    this.birds = placeBirds(level, this.dressing).map((bird) => ({ bird, visit: {} }));
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
