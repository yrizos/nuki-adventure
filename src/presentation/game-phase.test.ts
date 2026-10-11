import { describe, expect, test } from 'vitest';
import { Area } from '../domain/level/collectibles';
import { KeyCollected } from '../domain/level/level-events';
import { LevelId } from '../domain/shared/level-id';
import { TilePosition } from '../domain/level/position';
import { closingLevel, restoringKey, type Phase, phaseAfterFrame, playing } from './game-phase';
import { closingLength } from './world-transition';

const origin = TilePosition.at(3, 4);
const restores = Area.of([origin]);
const key = new KeyCollected(LevelId.of('phase'), origin, restores);
const after = (phase: Phase, frame: number): Phase => phaseAfterFrame(phase, { frame, restorationLength: () => 40 });

describe('the game phase', () => {
  test('starts restoring the collected key area on the pickup frame', () => {
    const restoring = restoringKey(key, 100);
    expect(restoring).toEqual({ name: 'restoring', since: 100, origin, restores });
    expect(after(restoring, 100)).toBe(restoring);
  });

  test('plays on once the restoration has spread', () => {
    const restoring: Phase = { name: 'restoring', since: 130, origin, restores };
    expect(after(restoring, 169)).toBe(restoring);
    expect(after(restoring, 170)).toBe(playing);
  });

  test('asks for the restoration length from the restoration origin', () => {
    const asked: TilePosition[] = [];
    phaseAfterFrame(
      { name: 'restoring', since: 0, origin, restores },
      { frame: 1, restorationLength: (from) => asked.push(from) },
    );
    expect(asked).toEqual([origin]);
  });

  test('ends the level once the screen has darkened', () => {
    const closing = closingLevel(200);
    expect(closing).toEqual({ name: 'closing', since: 200 });
    expect(after(closing, 200 + closingLength - 1)).toBe(closing);
    expect(after(closing, 200 + closingLength)).toEqual({ name: 'ended' });
  });

  test('stays playing whatever the frame', () => {
    expect(after(playing, 5000)).toBe(playing);
  });
});
