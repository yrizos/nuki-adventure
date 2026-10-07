import { describe, expect, test } from 'vitest';
import { Playthrough, PlayTime } from '../domain/progress/playthrough';
import { StarCount } from '../domain/shared/star-count';
import { Area, OrbColor } from '../domain/level/collectibles';
import { OrbCollected } from '../domain/level/level-events';
import { LevelId } from '../domain/shared/level-id';
import { TilePosition } from '../domain/level/position';
import { closingLevel, holdFrames, holdingOrb, type Phase, phaseAfterFrame, playing } from './game-phase';
import { closingLength } from './world-transition';

const playthrough = (frames: number, collectedStars: number, starCount: number): Playthrough =>
  Playthrough.of(PlayTime.ofFrames(frames), StarCount.of(collectedStars), StarCount.of(starCount));

const origin = TilePosition.at(3, 4);
const restores = Area.of([origin]);
const orb = new OrbCollected(LevelId.of('phase'), origin, OrbColor.Teal, restores);
const completed = playthrough(600, 2, 5);
const after = (phase: Phase, frame: number, continuing = false): Phase =>
  phaseAfterFrame(phase, { frame, restorationLength: () => 40, continuing });

describe('the game phase', () => {
  test('holds a collected orb for thirty frames before restoring its area', () => {
    const holding = holdingOrb(orb, 100);
    expect(holding).toEqual({ name: 'holding', until: 130, origin, color: OrbColor.Teal, restores });
    expect(holdFrames).toBe(30);
    expect(after(holding, 129)).toBe(holding);
    expect(after(holding, 130)).toEqual({ name: 'restoring', since: 130, origin, restores });
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
      { frame: 1, continuing: false, restorationLength: (from) => asked.push(from) },
    );
    expect(asked).toEqual([origin]);
  });

  test('ends the level once the screen has darkened', () => {
    const closing = closingLevel(completed, 200);
    expect(closing).toEqual({ name: 'closing', since: 200, playthrough: completed });
    expect(after(closing, 200 + closingLength - 1)).toBe(closing);
    expect(after(closing, 200 + closingLength)).toEqual({ name: 'ended' });
  });

  test('waits at the end until the player continues', () => {
    const ended: Phase = { name: 'ended' };
    expect(after(ended, 1000)).toBe(ended);
    expect(after(ended, 1000, true)).toBe(playing);
  });

  test('stays playing whatever the frame or input', () => {
    expect(after(playing, 5000, true)).toBe(playing);
  });
});
