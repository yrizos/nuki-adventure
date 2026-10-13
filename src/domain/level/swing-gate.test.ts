import { expect, test } from 'vitest';
import { feet } from './hero';
import { Outline, wholeTile } from './obstacles';
import { Direction, TilePosition, WorldPosition } from './position';
import { SwingGate } from './swing-gate';
import { swungThrough } from '../../test-support/walk-level';

const gateSwingLength = 16;

const at = TilePosition.at;

test('starts closed with its approach on the tile to the south', () => {
  const gate = SwingGate.closedAt(at(3, 2));
  expect(gate.state).toBe('closed');
  expect(gate.approach).toEqual(at(3, 3));
  expect(gate.covers(at(3, 2))).toBe(true);
  expect(gate.covers(at(3, 1))).toBe(false);
});

test('only moves forward from closed to opening to open', () => {
  const closed = SwingGate.closedAt(at(3, 2));
  expect(closed.swingOn()).toBe(closed);
  const opening = closed.requestOpen();
  expect(opening.state).toBe('opening');
  expect(opening.requestOpen()).toBe(opening);
  const open = swungThrough(opening);
  expect(open.state).toBe('open');
  expect(open.requestOpen()).toBe(open);
  expect(open.swingOn()).toBe(open);
});

test('closes only from open, through closing, back to closed', () => {
  const closed = SwingGate.closedAt(at(3, 2));
  expect(closed.requestClose()).toBe(closed);
  const open = swungThrough(closed.requestOpen());
  const closing = open.requestClose();
  expect(closing.state).toBe('closing');
  expect(closing.requestOpen()).toBe(closing);
  expect(closing.requestClose()).toBe(closing);
  expect(closing.obstacles).toEqual([wholeTile(at(3, 2))]);
  expect(swungThrough(closing).state).toBe('closed');
});

test('finishes its swing on the last of its frames', () => {
  let gate = SwingGate.closedAt(at(3, 2)).requestOpen();
  for (let frame = 1; frame < gateSwingLength; frame++) gate = gate.swingOn();
  expect(gate.state).toBe('opening');
  expect(gate.swung).toBe(gateSwingLength - 1);
  expect(gate.swingOn().state).toBe('open');
  expect(gate.swingOn().swung).toBe(0);
});

test('turns back from the angle the leaf has reached', () => {
  const opening = SwingGate.closedAt(at(3, 2)).requestOpen().swingOn().swingOn().swingOn();
  const closing = opening.reverse();
  expect(closing.state).toBe('closing');
  expect(closing.swung).toBe(gateSwingLength - 1 - 3);
  expect(closing.reverse().swung).toBe(3);
});

test('is operable from the three tiles on either side of its passage', () => {
  const gate = SwingGate.closedAt(at(3, 2));
  for (const column of [2, 3, 4]) {
    expect(gate.operableFrom(at(column, 1))).toBe(true);
    expect(gate.operableFrom(at(column, 3))).toBe(true);
  }
  for (const tile of [at(3, 2), at(2, 2), at(1, 3), at(5, 1), at(3, 4), at(3, 0)])
    expect(gate.operableFrom(tile)).toBe(false);
});

test('in a column of fence is approached from the west and swings east along the top of its tile', () => {
  const gate = SwingGate.closedAt(at(3, 2), Direction.Left);
  expect(gate.approach).toEqual(at(2, 2));
  expect(gate.swing).toBe(Direction.Right);
  for (const row of [1, 2, 3]) {
    expect(gate.operableFrom(at(2, row))).toBe(true);
    expect(gate.operableFrom(at(4, row))).toBe(true);
  }
  for (const tile of [at(3, 1), at(3, 3), at(5, 2), at(2, 4)]) expect(gate.operableFrom(tile)).toBe(false);
  expect(swungThrough(gate.requestOpen()).obstacles).toEqual([
    Outline.spanning(at(3, 2), 16, 0, 32, 3),
    Outline.spanning(at(4, 2), 0, 0, 16, 3),
  ]);
  for (const tile of [at(3, 2), at(4, 2), at(4, 1)]) expect(gate.hides(tile)).toBe(true);
  expect(gate.hides(at(2, 2))).toBe(false);
});

test('is approached only from the south or the west', () => {
  expect(() => SwingGate.closedAt(at(3, 2), Direction.Up)).toThrow('south or the west');
});

test('blocks its whole tile until it has finished opening', () => {
  const closed = SwingGate.closedAt(at(3, 2));
  expect(closed.obstacles).toEqual([wholeTile(at(3, 2))]);
  expect(closed.requestOpen().obstacles).toEqual([wholeTile(at(3, 2))]);
});

test('leaves the middle of the passage clear once open, with the leaf along its west side', () => {
  const open = swungThrough(SwingGate.closedAt(at(3, 2)).requestOpen());
  expect(open.obstacles).toEqual([Outline.spanning(at(3, 2), 0, 0, 3, 22), Outline.spanning(at(3, 1), 0, 12, 3, 32)]);
});

test('is clear of feet only where neither its shut nor its open leaf would touch them', () => {
  const gate = SwingGate.closedAt(at(3, 2));
  expect(gate.clearOf(feet.at(WorldPosition.within(at(3, 3), 16, 28)))).toBe(true);
  expect(gate.clearOf(feet.at(WorldPosition.within(at(3, 3), 16, 3)))).toBe(true);
  expect(gate.clearOf(feet.at(WorldPosition.within(at(3, 3), 16, 2)))).toBe(false);
  expect(gate.clearOf(feet.at(WorldPosition.within(at(3, 1), 16, 20)))).toBe(true);
  expect(gate.clearOf(feet.at(WorldPosition.within(at(3, 1), 6, 20)))).toBe(false);
  expect(gate.clearOf(feet.at(WorldPosition.within(at(2, 1), 30, 20)))).toBe(false);
});

test('turns back halfway through a swing and stays put when not swinging', () => {
  const closed = SwingGate.closedAt(at(3, 2));
  expect(closed.requestOpen().reverse().state).toBe('closing');
  expect(closed.requestOpen().reverse().reverse().state).toBe('opening');
  expect(closed.reverse()).toBe(closed);
  const open = swungThrough(closed.requestOpen());
  expect(open.reverse()).toBe(open);
});
