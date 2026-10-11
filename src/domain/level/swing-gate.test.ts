import { expect, test } from 'vitest';
import { Outline, wholeTile } from './obstacles';
import { TilePosition } from './position';
import { SwingGate } from './swing-gate';

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
  expect(closed.finishOpening()).toBe(closed);
  const opening = closed.requestOpen();
  expect(opening.state).toBe('opening');
  expect(opening.requestOpen()).toBe(opening);
  const open = opening.finishOpening();
  expect(open.state).toBe('open');
  expect(open.requestOpen()).toBe(open);
  expect(open.finishOpening()).toBe(open);
});

test('offers no way to close again', () => {
  const open = SwingGate.closedAt(at(3, 2)).requestOpen().finishOpening();
  for (const name of ['close', 'toggle', 'reset', 'setOpen']) expect(name in open).toBe(false);
});

test('blocks its whole tile until it has finished opening', () => {
  const closed = SwingGate.closedAt(at(3, 2));
  expect(closed.obstacles).toEqual([wholeTile(at(3, 2))]);
  expect(closed.requestOpen().obstacles).toEqual([wholeTile(at(3, 2))]);
});

test('leaves the middle of the passage clear once open, with the leaf along its west side', () => {
  const open = SwingGate.closedAt(at(3, 2)).requestOpen().finishOpening();
  expect(open.obstacles).toEqual([Outline.spanning(at(3, 2), 0, 0, 3, 22), Outline.spanning(at(3, 1), 0, 12, 3, 32)]);
});

test('is equal only with the same position and state', () => {
  const gate = SwingGate.closedAt(at(3, 2));
  expect(gate.equals(SwingGate.closedAt(at(3, 2)))).toBe(true);
  expect(gate.equals(SwingGate.closedAt(at(4, 2)))).toBe(false);
  expect(gate.equals(gate.requestOpen())).toBe(false);
});
