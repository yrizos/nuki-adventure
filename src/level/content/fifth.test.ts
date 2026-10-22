import { expect, test } from 'vitest';
import { check2dObstacles } from '../infrastructure/check2d-obstacles';
import { Door } from '../domain/door';
import type { Level } from '../domain/level';
import { LevelCompleted, OrbCollected, SwingGateStuck } from '../domain/level-events';
import { Direction, Heading, TilePosition, tileKey } from '../domain/position';
import { SwingGate } from '../domain/swing-gate';
import { lowestRoll } from '../testing/draws';
import { collectEveryOrb, follow, pathTo, settleGate } from '../testing/walk-level';
import { fifthLevel, fifthLevelId } from './fifth';

type Shuffle = (positions: readonly TilePosition[]) => readonly TilePosition[];

const at = TilePosition.at;
const size = 25;
const sides = [Direction.Up, Direction.Down, Direction.Left, Direction.Right];
const plate = at(15, 9);
const gate = at(16, 11);
const gardenOrb = at(18, 11);
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

function boulderSpotsOf(): readonly TilePosition[] {
  const offered: (readonly TilePosition[])[] = [];
  fifthLevel((positions) => (offered.push(positions), positions), check2dObstacles, lowestRoll);
  return offered[0] ?? [];
}

function openGround(level: Level): (tile: TilePosition) => boolean {
  return (tile) =>
    level.scenery.isWalkable(tile) &&
    !level.stones.some((stone) => stone.position.equals(tile)) &&
    !level.door.covers(tile) &&
    !level.gates[0]!.covers(tile);
}

function region(start: TilePosition, enterable: (tile: TilePosition) => boolean): readonly TilePosition[] {
  const reached = [start];
  const seen = new Set([tileKey(start)]);
  for (let index = 0; index < reached.length; index++) {
    for (const side of sides) {
      const neighbor = reached[index]!.neighbor(side);
      if (seen.has(tileKey(neighbor)) || !enterable(neighbor)) continue;
      seen.add(tileKey(neighbor));
      reached.push(neighbor);
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

// The search is the slowest part of these tests and depends only on the starting layout, so tests share it.
const searched = new Map<number, readonly State[]>();
function boulderStates(level: Level): readonly State[] {
  const start = tileKey(level.boulders[0]!.position);
  if (!searched.has(start)) searched.set(start, searchBoulderStates(level));
  return searched.get(start)!;
}

function searchBoulderStates(level: Level): readonly State[] {
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

test('the fifth level is a 25 by 25 map with a top-left door, a side gate held by a plate and one permanent orb', () => {
  const level = fifthLevel(keepOrder, check2dObstacles, lowestRoll);
  expect(level.id).toBe(fifthLevelId);
  expect(level.scenery.size).toEqual({ columns: 25, rows: 25 });
  expect(level.hero.position).toEqual(at(14, 21));
  expect(level.door).toEqual(Door.closedAt(at(7, 1)));
  expect(level.gates).toEqual([SwingGate.closedAt(gate, Direction.Left)]);
  expect(level.plate).toEqual(plate);
  expect(level.permanentOrbs).toEqual([gardenOrb]);
  expect(level.boulders.map((boulder) => boulder.position)).toEqual([spots[0]]);
});

test('the fifth level starts its one boulder within two tiles of the plate', () => {
  expect(boulderSpotsOf()).toEqual(spots);
  for (const spot of spots) {
    expect(Math.abs(spot.column - plate.column) + Math.abs(spot.row - plate.row)).toBeLessThanOrEqual(2);
    expect(
      fifthLevel(startingAt(spot), check2dObstacles, lowestRoll).boulders.map((boulder) => boulder.position),
    ).toEqual([spot]);
  }
});

test('from the plate the gate, its swing and the permanent orb fit in the seven by seven view', () => {
  const swing = gate.neighbor(Direction.Right);
  expect([gate, swing, gardenOrb].map((tile) => reach(plate, tile) <= 3)).toEqual([true, true, true]);
});

test.each(spots.map((spot) => ({ spot, label: `${spot.column}, ${spot.row}` })))(
  'from boulder spot $label every move she can make still lets her bring the boulder onto the plate',
  ({ spot }) => {
    const states = boulderStates(fifthLevel(startingAt(spot), check2dObstacles, lowestRoll));
    expect(states.some((state) => state.boulder.equals(plate))).toBe(true);
    expect(
      stuckStates(states).map(
        ({ boulder, hero }) => `boulder ${boulder.column}, ${boulder.row} hero ${hero.column}, ${hero.row}`,
      ),
    ).toEqual([]);
  },
);

test('the fifth level keeps the garden and its permanent orb shut until the boulder rests on the plate', () => {
  const level = fifthLevel(keepOrder, check2dObstacles, lowestRoll);
  const open = openGround(level);
  const reached = region(level.hero.position, (tile) => open(tile) && !level.boulders[0]!.covers(tile));
  expect(reached.some((tile) => tile.equals(level.gates[0]!.approach))).toBe(true);
  expect(reached.filter(inGarden)).toEqual([]);
  expect(pathTo(level, (tile) => inGarden(tile))).toBeUndefined();
  follow(
    level,
    pathTo(level, (tile) => tile.equals(plate))!,
  );
  expect(level.gates[0]!.state, 'her own weight on the plate swings the gate open').toBe('opening');
  settleGate(level);
  follow(
    level,
    pathTo(level, (tile) => tile.equals(level.gates[0]!.approach))!,
  );
  expect(level.gates[0]!.state, 'stepping off the plate lets the gate swing shut').toBe('closed');
  expect(level.operateGate()).toEqual([new SwingGateStuck(fifthLevelId, gate)]);
  expect(level.gates[0]!.state).toBe('closed');
});

test.each(spots.map((spot) => ({ spot, label: `${spot.column}, ${spot.row}` })))(
  'with the boulder starting at $label she rolls it onto the plate, takes the orb through the gate and leaves',
  ({ spot }) => {
    const level = fifthLevel(startingAt(spot), check2dObstacles, lowestRoll);
    const solved = boulderStates(level).find((state) => state.boulder.equals(plate))!;
    for (const move of solved.moves) play(level, move);
    expect(level.boulders[0]!.position).toEqual(plate);
    level.tick(null);
    settleGate(level);
    expect(level.gates[0]!.state).toBe('open');
    const toGarden = pathTo(level, (tile) => tile.equals(gardenOrb));
    expect(toGarden, 'the permanent orb must open up once the gate swings').toBeDefined();
    expect(follow(level, toGarden!).some((event) => event instanceof OrbCollected)).toBe(true);
    collectEveryOrb(level);
    level.openDoor();
    const toDoor = pathTo(level, (tile) => level.door.covers(tile));
    expect(toDoor, 'the door must stay reachable with the boulder on the plate').toBeDefined();
    expect(follow(level, toDoor!).some((event) => event instanceof LevelCompleted)).toBe(true);
  },
);
