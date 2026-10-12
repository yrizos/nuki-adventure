import { expect, test } from 'vitest';
import { KeyMaterial } from '../domain/level/collectibles';
import { Door } from '../domain/level/door';
import type { Level } from '../domain/level/level';
import { KeyCollected, LevelCompleted, SwingGateStuck } from '../domain/level/level-events';
import { Direction, Heading, TilePosition } from '../domain/level/position';
import { SwingGate } from '../domain/level/swing-gate';
import { reverseOrder, starSpotsOf } from '../test-support/star-spots';
import { follow, pathTo } from '../test-support/walk-level';
import { fifthLevel, fifthLevelId } from './fifth-level';

type Shuffle = (positions: readonly TilePosition[]) => readonly TilePosition[];

const at = TilePosition.at;
const size = 25;
const tiles = Array.from({ length: size * size }, (_, index) => at(index % size, Math.floor(index / size)));
const sides = [Direction.Up, Direction.Down, Direction.Left, Direction.Right];
const plate = at(15, 9);
const gate = at(16, 11);
const key = at(18, 11);
const spots = [at(15, 7), at(14, 9)];
const inGarden = (tile: TilePosition): boolean =>
  tile.column >= 17 && tile.column <= 20 && tile.row >= 9 && tile.row <= 13;
const reach = (from: TilePosition, to: TilePosition): number =>
  Math.max(Math.abs(from.column - to.column), Math.abs(from.row - to.row));
const keepOrder: Shuffle = (positions) => positions;
const startingAt =
  (spot: TilePosition): Shuffle =>
  (positions) =>
    positions.some((other) => other.equals(spot))
      ? [spot, ...positions.filter((other) => !other.equals(spot))]
      : positions;

// The layout offers its star spots and its boulder spots to the same shuffle, and only the star spots come in twenties.
function boulderSpotsOf(): readonly TilePosition[] {
  const offered: (readonly TilePosition[])[] = [];
  fifthLevel((positions) => (offered.push(positions), positions));
  return offered.find((positions) => positions.length !== 20) ?? [];
}

// Ground she or the boulder may take with the gate shut, apart from the boulder itself.
function openGround(level: Level): (tile: TilePosition) => boolean {
  return (tile) =>
    level.scenery.isWalkable(tile) &&
    !level.stones.some((stone) => stone.position.equals(tile)) &&
    !level.door.covers(tile) &&
    !level.gate!.covers(tile);
}

function region(start: TilePosition, enterable: (tile: TilePosition) => boolean): readonly TilePosition[] {
  const reached = [start];
  for (let index = 0; index < reached.length; index++) {
    for (const side of sides) {
      const neighbor = reached[index]!.neighbor(side);
      if (enterable(neighbor) && !reached.some((tile) => tile.equals(neighbor))) reached.push(neighbor);
    }
  }
  return reached;
}

interface Move {
  readonly stand: TilePosition;
  readonly facing: Direction;
  readonly direction: Direction;
}

interface State {
  readonly label: string;
  readonly boulder: TilePosition;
  readonly hero: TilePosition;
  readonly moves: readonly Move[];
  readonly next: string[];
}

// Every state she can bring about, keyed by the boulder and the stretch of ground she can walk to around it.
function boulderStates(level: Level): readonly State[] {
  const open = openGround(level);
  const index = (tile: TilePosition): number => tile.row * size + tile.column;
  const name = (boulder: TilePosition, hero: TilePosition): string => {
    const around = region(hero, (tile) => open(tile) && !tile.equals(boulder));
    return `${index(boulder)}:${Math.min(...around.map(index))}`;
  };
  const boulder = level.boulders[0]!.position;
  const hero = level.hero.position;
  const states: State[] = [{ label: name(boulder, hero), boulder, hero, moves: [], next: [] }];
  const known = new Map(states.map((state) => [state.label, state]));
  for (let at = 0; at < states.length; at++) {
    const state = states[at]!;
    for (const stand of region(state.hero, (tile) => open(tile) && !tile.equals(state.boulder))) {
      const facing = sides.find((side) => stand.neighbor(side).equals(state.boulder));
      if (!facing) continue;
      // Gripping it, she can walk any way, and it moves the same way as long as both of them have room.
      const outcomes = sides.flatMap((direction) => {
        const boulder = state.boulder.neighbor(direction);
        const hero = stand.neighbor(direction);
        return (boulder.equals(stand) || open(boulder)) && (hero.equals(state.boulder) || open(hero))
          ? [{ boulder, hero, direction }]
          : [];
      });
      for (const outcome of outcomes) {
        const label = name(outcome.boulder, outcome.hero);
        state.next.push(label);
        if (known.has(label)) continue;
        const reached = {
          label,
          boulder: outcome.boulder,
          hero: outcome.hero,
          moves: [...state.moves, { stand, facing, direction: outcome.direction }],
          next: [],
        };
        states.push(reached);
        known.set(label, reached);
      }
    }
  }
  return states;
}

function stuckStates(states: readonly State[]): readonly State[] {
  const solvable = new Set(states.filter((state) => state.boulder.equals(plate)).map((state) => state.label));
  for (let grew = true; grew;) {
    grew = false;
    for (const state of states) {
      if (!solvable.has(state.label) && state.next.some((label) => solvable.has(label))) {
        solvable.add(state.label);
        grew = true;
      }
    }
  }
  return states.filter((state) => !solvable.has(state.label));
}

function settle(level: Level): void {
  for (let tick = 0; tick < 20 && level.boulders.some((boulder) => boulder.isSliding); tick++) level.tick(null);
  expect(level.boulders.some((boulder) => boulder.isSliding)).toBe(false);
}

function play(level: Level, { stand, facing, direction }: Move): void {
  const path = pathTo(level, (tile) => tile.equals(stand));
  expect(path, `she must reach ${stand.column}, ${stand.row}`).toBeDefined();
  follow(level, path!);
  for (let tick = 0; tick < 20 && !(level.hero.facing.equals(facing) && level.canGrip); tick++)
    level.tick(Heading.of(facing));
  expect(level.hero.position).toEqual(stand);
  expect(level.canGrip, `she must grip it facing ${facing.name} from ${stand.column}, ${stand.row}`).toBe(true);
  level.grip();
  level.tick(Heading.of(direction));
  settle(level);
  level.release();
}

test('the fifth level is a 25 by 25 map with a top-left door, a side gate held by a plate and one gold key', () => {
  const level = fifthLevel(keepOrder);
  expect(level.id).toBe(fifthLevelId);
  expect(level.scenery.size).toEqual({ columns: 25, rows: 25 });
  expect(level.hero.position).toEqual(at(14, 21));
  expect(level.door.equals(Door.closedAt(at(7, 1)))).toBe(true);
  expect(level.gate?.equals(SwingGate.closedAt(gate, Direction.Left))).toBe(true);
  expect(level.plate).toEqual(plate);
  expect(level.keys.map((each) => [each.position, each.material])).toEqual([[key, KeyMaterial.Gold]]);
  expect(level.stars).toHaveLength(5);
  expect(level.boulders.map((boulder) => boulder.position)).toEqual([spots[0]]);
});

test('the fifth level starts its one boulder within two tiles of the plate', () => {
  expect(boulderSpotsOf()).toEqual(spots);
  for (const spot of spots) {
    expect(Math.abs(spot.column - plate.column) + Math.abs(spot.row - plate.row)).toBeLessThanOrEqual(2);
    expect(fifthLevel(startingAt(spot)).boulders.map((boulder) => boulder.position)).toEqual([spot]);
  }
});

test('the fifth level keeps its plate two tiles clear of the gate and its swing', () => {
  const swing = fifthLevel(keepOrder).gate!.position.neighbor(Direction.Right);
  expect(reach(plate, gate)).toBeGreaterThanOrEqual(2);
  expect(reach(plate, swing)).toBeGreaterThanOrEqual(2);
});

test('from the plate the gate, its swing and the key fit in the seven by seven view', () => {
  const swing = gate.neighbor(Direction.Right);
  expect([gate, swing, key].map((tile) => reach(plate, tile) <= 3)).toEqual([true, true, true]);
});

test.each(spots.map((spot) => ({ spot, label: `${spot.column}, ${spot.row}` })))(
  'from boulder spot $label every move she can make still lets her bring the boulder onto the plate',
  ({ spot }) => {
    const states = boulderStates(fifthLevel(startingAt(spot)));
    expect(states.some((state) => state.boulder.equals(plate))).toBe(true);
    expect(
      stuckStates(states).map(
        ({ boulder, hero }) => `boulder ${boulder.column}, ${boulder.row} hero ${hero.column}, ${hero.row}`,
      ),
    ).toEqual([]);
  },
);

test('the fifth level marks twenty star spots, all outside the garden and reachable with the gate shut', () => {
  const level = fifthLevel(keepOrder);
  const open = openGround(level);
  const reached = region(level.hero.position, (tile) => open(tile) && !level.boulders[0]!.covers(tile));
  const starSpots = starSpotsOf(fifthLevel);
  expect(starSpots).toHaveLength(20);
  expect(starSpots.filter(inGarden)).toEqual([]);
  expect(starSpots.filter((spot) => !reached.some((tile) => tile.equals(spot)))).toEqual([]);
  expect(starSpots.filter((spot) => spots.some((other) => other.equals(spot)))).toEqual([]);
  expect(fifthLevel(reverseOrder).stars.map((star) => star.position)).toEqual([...starSpots].reverse().slice(0, 5));
});

test('the fifth level keeps the garden and its key shut until the boulder rests on the plate', () => {
  const level = fifthLevel(keepOrder);
  const open = openGround(level);
  const reached = region(level.hero.position, (tile) => open(tile) && !level.boulders[0]!.covers(tile));
  expect(reached.some((tile) => tile.equals(level.gate!.approach))).toBe(true);
  expect(reached.filter(inGarden)).toEqual([]);
  expect(pathTo(level, (tile) => inGarden(tile))).toBeUndefined();
  follow(
    level,
    pathTo(level, (tile) => tile.equals(plate))!,
  );
  expect(level.gate!.state, 'her own weight on the plate swings the gate open').toBe('opening');
  level.finishGate();
  follow(
    level,
    pathTo(level, (tile) => tile.equals(level.gate!.approach))!,
  );
  expect(level.gate!.state, 'stepping off the plate lets the gate swing shut').toBe('closing');
  level.finishGate();
  expect(level.operateGate()).toEqual([new SwingGateStuck(fifthLevelId, gate)]);
  expect(level.gate!.state).toBe('closed');
});

test('the fifth level leaves no open ground cut off once the gate opens', () => {
  const level = fifthLevel(keepOrder);
  const walkable = (tile: TilePosition): boolean =>
    level.scenery.isWalkable(tile) &&
    !level.stones.some((stone) => stone.position.equals(tile)) &&
    !level.door.covers(tile);
  const reached = region(level.hero.position, walkable);
  expect(tiles.filter((tile) => walkable(tile) && !reached.some((other) => other.equals(tile)))).toEqual([]);
});

test.each(spots.map((spot) => ({ spot, label: `${spot.column}, ${spot.row}` })))(
  'with the boulder starting at $label she rolls it onto the plate, takes the key through the gate and leaves',
  ({ spot }) => {
    const level = fifthLevel(startingAt(spot));
    const solved = boulderStates(level).find((state) => state.boulder.equals(plate))!;
    for (const move of solved.moves) play(level, move);
    expect(level.boulders[0]!.position).toEqual(plate);
    level.tick(null);
    expect(level.gate!.state).toBe('opening');
    level.finishGate();
    const toKey = pathTo(level, (tile) => tile.equals(key));
    expect(toKey, 'the key must open up once the gate swings').toBeDefined();
    expect(follow(level, toKey!).some((event) => event instanceof KeyCollected)).toBe(true);
    level.openDoor();
    const toDoor = pathTo(level, (tile) => level.door.covers(tile));
    expect(toDoor, 'the door must stay reachable with the boulder on the plate').toBeDefined();
    expect(follow(level, toDoor!).some((event) => event instanceof LevelCompleted)).toBe(true);
  },
);

test('the fifth level shuts the gate again once the boulder leaves the plate', () => {
  const level = fifthLevel(keepOrder);
  const solved = boulderStates(level).find((state) => state.boulder.equals(plate))!;
  for (const move of solved.moves) play(level, move);
  level.tick(null);
  level.finishGate();
  expect(level.gate!.isOpen).toBe(true);
  const last = solved.moves.at(-1)!;
  play(level, { stand: plate.neighbor(last.facing.opposite), facing: last.facing, direction: last.facing.opposite });
  expect(level.gate!.state).toBe('closing');
  level.finishGate();
  expect(level.gate!.state).toBe('closed');
  expect(pathTo(level, (tile) => inGarden(tile))).toBeUndefined();
});
