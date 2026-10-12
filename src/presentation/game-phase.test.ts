import { describe, expect, test } from 'vitest';
import { Area } from '../domain/level/collectibles';
import { TilePosition } from '../domain/level/position';
import { type Phase, phaseAfterFrame, playing } from './game-phase';

const origin = TilePosition.at(3, 4);
const restores = Area.of([origin]);
const after = (phase: Phase, frame: number): Phase => phaseAfterFrame(phase, { frame, restorationLength: () => 40 });

describe('the game phase', () => {
  test('plays on once the restoration has spread', () => {
    const restoring: Phase = { name: 'restoring', since: 130, origin, restores };
    expect(after(restoring, 169)).toBe(restoring);
    expect(after(restoring, 170)).toBe(playing);
  });

  test('stays playing whatever the frame', () => {
    expect(after(playing, 5000)).toBe(playing);
  });
});
