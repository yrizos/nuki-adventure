import { describe, expect, test } from 'vitest';
import { Area, Orb } from '../domain/collectibles';
import { Door } from '../domain/door';
import { Level } from '../domain/level';
import { OrbCollected, SwingGateOpened, SwingGateOpeningStarted } from '../domain/level-events';
import { LevelId } from '../domain/level-id';
import type { LevelRepository } from '../domain/level-repository';
import { Direction, Heading, TilePosition } from '../domain/position';
import { Ground, LevelSize, Scenery } from '../domain/scenery';
import { SwingGate } from '../domain/swing-gate';
import { check2dObstacles } from '../infrastructure/check2d-obstacles';
import { PlayLevel } from './play-level';

const gateSwingLength = 16;

const levelId = LevelId.of('play');
const right = Heading.of(Direction.Right);
const size = LevelSize.of(5, 5);
const orb = Orb.at(TilePosition.at(1, 0), 4, size);

function playing(gate?: SwingGate) {
  const level = Level.create({
    id: levelId,
    scenery: Scenery.of(
      size,
      Array.from({ length: 5 }, () => Array<Ground>(5).fill(Ground.Path)),
      [],
      [],
    ),
    stones: [],
    orbs: [orb],
    door: Door.closedAt(TilePosition.at(2, 0)),
    hero: gate
      ? { position: gate.approach, facing: Direction.Up }
      : { position: TilePosition.at(0, 0), facing: Direction.Right },
    ...(gate ? { gates: [gate] } : {}),
    obstacles: check2dObstacles,
  });
  const loaded: LevelId[] = [];
  const saved: Level[] = [];
  const repository: LevelRepository = {
    load(id) {
      loaded.push(id);
      return level;
    },
    save(changed) {
      saved.push(changed);
    },
  };
  return { level, loaded, saved, play: new PlayLevel(repository) };
}

describe('playing a level', () => {
  test('shows the stored level without saving it', () => {
    const subject = playing();
    const view = subject.play.view(levelId);
    expect(view).toEqual({
      id: levelId,
      scenery: subject.level.scenery,
      stones: [],
      orbs: [orb],
      restored: [],
      door: subject.level.door,
      gates: [],
      isPlateDown: false,
      operableGate: undefined,
      canOperateGate: false,
      canGrip: false,
      isGripping: false,
      boulders: [],
      actions: [],
      hero: subject.level.hero,
      isComplete: false,
      outlines: subject.level.outlines,
    });
    expect('tick' in view).toBe(false);
    expect(subject.loaded).toEqual([levelId]);
    expect(subject.saved).toEqual([]);
  });

  test('keeps an earlier view unchanged while the level moves on', () => {
    const subject = playing();
    const before = subject.play.view(levelId);
    for (let frame = 0; frame < 17; frame++) subject.play.advance(levelId, right);
    expect(before.hero.position).toEqual(TilePosition.at(0, 0));
    expect(before.hero.isWalking).toBe(false);
    expect([before.orbs, before.restored]).toEqual([[orb], []]);
    expect(subject.play.view(levelId).orbs).toEqual([]);
  });

  test('advances the stored level in the held direction and saves it after every frame', () => {
    const subject = playing();
    const events = Array.from({ length: 17 }, () => subject.play.advance(levelId, right)).flat();
    expect(events).toEqual([new OrbCollected(levelId, TilePosition.at(1, 0), Area.whole(size), true)]);
    expect(subject.level.hero.position).toEqual(TilePosition.at(1, 0));
    expect(subject.loaded).toHaveLength(17);
    expect(subject.saved).toHaveLength(17);
    expect(subject.saved.every((level) => level === subject.level)).toBe(true);
  });

  test('operates the gate and finishes its swing on the stored level, saving each change', () => {
    const subject = playing(SwingGate.closedAt(TilePosition.at(2, 2)));
    expect(subject.play.view(levelId).canOperateGate).toBe(true);
    expect(subject.play.operateGate(levelId)).toEqual([new SwingGateOpeningStarted(levelId, TilePosition.at(2, 2))]);
    expect(subject.play.view(levelId).gates[0]?.state).toBe('opening');
    for (let tick = 1; tick < gateSwingLength; tick++) subject.play.advance(levelId, null);
    expect(subject.play.advance(levelId, null)).toEqual([new SwingGateOpened(levelId, TilePosition.at(2, 2))]);
    expect(subject.play.view(levelId).gates[0]?.state).toBe('open');
    expect(subject.saved).toHaveLength(1 + gateSwingLength);
  });
});
