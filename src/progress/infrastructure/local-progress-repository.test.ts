import { describe, expect, test } from 'vitest';
import { GameProgress } from '../domain/game-progress';
import { LevelOrder } from '../domain/level-order';
import { Playthrough, PlayTime } from '../domain/playthrough';
import { Direction, LevelId, WorldPosition } from '../../level';
import { LocalProgressRepository, progressKey } from './local-progress-repository';
import { memoryStorage } from '../testing/memory-storage';
import { leftInProgress, progressLevels, progressOrder, progressSequences } from '../testing/progress-sequences';

function storage(initial: string | null = null): Storage {
  const store = memoryStorage();
  if (initial !== null) store.setItem(progressKey, initial);
  return store;
}

const saved = {
  version: 4,
  continueLevelId: 'second',
  unlockedLevelIds: ['second'],
  lastPlaythroughs: [{ levelId: 'first', frames: 600 }],
  levelInProgress: null,
};

const savedInProgress = {
  levelId: 'second',
  frames: 1200,
  hero: { x: 48.5, y: 92.25, facing: 'left' },
  orbs: [{ column: 2, row: 4, radius: 5 }],
  collectedOrbs: [{ column: 0, row: 1, radius: 4 }],
  gates: ['open', 'closed'],
  boulders: [{ column: 3, row: 3 }],
};

const isFresh = (progress: GameProgress): boolean =>
  progress.continueLevel === null && progress.unlockedLevels.length === 0 && progress.lastPlaythroughs.length === 0;

const snapshot = (progress: GameProgress) => ({
  unlocked: progressLevels.map((level) => progress.isUnlocked(level, progressOrder)),
  last: progressLevels.map((level) => progress.lastPlaythroughOf(level)),
  continueLevel: progress.continueLevelAmong(progressOrder),
  levelInProgress: progress.levelInProgress,
});

describe('loading saved progress', () => {
  test('gives fresh progress when nothing is saved', () => {
    expect(isFresh(new LocalProgressRepository(storage()).load())).toBe(true);
  });

  test('reads saved progress into the domain', () => {
    const progress = new LocalProgressRepository(storage(JSON.stringify(saved))).load();
    expect(progress.continueLevel).toEqual(LevelId.of('second'));
    expect(progress.unlockedLevels).toEqual([LevelId.of('second')]);
    expect(progress.lastPlaythroughOf(LevelId.of('first'))).toEqual(Playthrough.of(PlayTime.ofFrames(600)));
  });

  test('reads the level left in progress', () => {
    const progress = new LocalProgressRepository(
      storage(JSON.stringify({ ...saved, levelInProgress: savedInProgress })),
    ).load();
    expect(progress.levelInProgress).toEqual(leftInProgress(LevelId.of('second')));
    expect(progress.levelInProgress?.snapshot.hero.facing).toBe(Direction.Left);
  });

  test.each([
    ['a level in progress with no level id', { ...savedInProgress, levelId: '' }],
    ['a level in progress with negative frames', { ...savedInProgress, frames: -1 }],
    [
      'a level in progress with a hero facing a diagonal',
      { ...savedInProgress, hero: { x: 0, y: 0, facing: 'up-left' } },
    ],
    ['a level in progress with a hero off the map', { ...savedInProgress, hero: { x: null, y: 0, facing: 'up' } }],
    [
      'a level in progress with an orb between tiles',
      { ...savedInProgress, orbs: [{ column: 0.5, row: 1, radius: 4 }] },
    ],
    ['a level in progress with an orb without a radius', { ...savedInProgress, orbs: [{ column: 2, row: 4 }] }],
    ['a level in progress with a gate halfway open', { ...savedInProgress, gates: ['opening'] }],
    ['a level in progress that is not the level to continue', { ...savedInProgress, levelId: 'first' }],
    ['a level in progress that is missing', undefined],
  ])('drops %s and keeps the rest', (_, levelInProgress) => {
    const progress = new LocalProgressRepository(storage(JSON.stringify({ ...saved, levelInProgress }))).load();
    expect(progress.levelInProgress).toBeNull();
    expect(progress.continueLevel).toEqual(LevelId.of('second'));
    expect(progress.lastPlaythroughs).toHaveLength(1);
  });

  test('keeps level ids the game no longer has', () => {
    const progress = new LocalProgressRepository(
      storage(JSON.stringify({ ...saved, continueLevelId: 'removed', unlockedLevelIds: ['removed'] })),
    ).load();
    expect(progress.continueLevel).toEqual(LevelId.of('removed'));
  });

  test.each([
    ['invalid JSON', '{'],
    ['a value that is not an object', '42'],
    ['a missing version', JSON.stringify({ ...saved, version: undefined })],
    ['progress saved by version 1', JSON.stringify({ ...saved, version: 1, levelInProgress: undefined })],
    ['progress saved by version 2', JSON.stringify({ ...saved, version: 2, levelInProgress: undefined })],
    ['progress saved by version 3', JSON.stringify({ ...saved, version: 3 })],
    ['an unsupported version', JSON.stringify({ ...saved, version: 5 })],
    ['an empty level id', JSON.stringify({ ...saved, unlockedLevelIds: [''] })],
    ['a blank level id', JSON.stringify({ ...saved, continueLevelId: '  ' })],
    ['negative frames', JSON.stringify({ ...saved, lastPlaythroughs: [{ ...saved.lastPlaythroughs[0], frames: -1 }] })],
  ])('gives fresh progress for %s', (_, json) => {
    expect(isFresh(new LocalProgressRepository(storage(json)).load())).toBe(true);
  });

  test('gives fresh progress when storage cannot be read', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {},
    };
    expect(isFresh(new LocalProgressRepository(blocked).load())).toBe(true);
  });
});

describe('saving progress', () => {
  test('writes progress that loads back the same', () => {
    const store = storage();
    const repository = new LocalProgressRepository(store);
    const progress = GameProgress.fresh();
    progress.reach(LevelId.of('second'));
    progress.complete(
      LevelId.of('first'),
      Playthrough.of(PlayTime.ofFrames(600)),
      LevelOrder.of([LevelId.of('first'), LevelId.of('second')]),
    );
    repository.save(progress);
    expect(JSON.parse(store.getItem(progressKey)!)).toEqual(saved);
    expect(snapshot(repository.load())).toEqual(snapshot(progress));
  });

  test('writes the level left in progress that loads back the same', () => {
    const store = storage();
    const repository = new LocalProgressRepository(store);
    const progress = GameProgress.fresh();
    progress.reach(LevelId.of('second'));
    progress.suspend(leftInProgress(LevelId.of('second')));
    repository.save(progress);
    expect((JSON.parse(store.getItem(progressKey)!) as { levelInProgress: unknown }).levelInProgress).toEqual(
      savedInProgress,
    );
    expect(repository.load().levelInProgress).toEqual(progress.levelInProgress);
  });

  test('writes no level in progress for a hero facing a diagonal, and keeps the rest', () => {
    const store = storage();
    const repository = new LocalProgressRepository(store);
    const progress = GameProgress.fresh();
    progress.reach(LevelId.of('second'));
    const left = leftInProgress(LevelId.of('second'));
    progress.suspend({
      ...left,
      snapshot: { ...left.snapshot, hero: { feet: WorldPosition.at(0, 0), facing: Direction.UpLeft } },
    });
    repository.save(progress);
    expect(JSON.parse(store.getItem(progressKey)!)).toMatchObject({ continueLevelId: 'second', levelInProgress: null });
  });

  test('leaves progress saved by a newer version of the game alone', () => {
    const newer = JSON.stringify({ version: 5, somethingNew: true });
    const store = storage(newer);
    new LocalProgressRepository(store).save(GameProgress.fresh());
    expect(store.getItem(progressKey)).toBe(newer);
  });

  test('writes version 4 over progress saved by an earlier version', () => {
    const store = storage(JSON.stringify({ ...saved, version: 3 }));
    const repository = new LocalProgressRepository(store);
    repository.save(repository.load());
    expect(JSON.parse(store.getItem(progressKey)!)).toEqual({
      version: 4,
      continueLevelId: null,
      unlockedLevelIds: [],
      lastPlaythroughs: [],
      levelInProgress: null,
    });
  });

  test('overwrites progress that cannot be read', () => {
    const store = storage('{');
    new LocalProgressRepository(store).save(GameProgress.fresh());
    expect(JSON.parse(store.getItem(progressKey)!)).toMatchObject({ version: 4 });
  });

  test('carries on when storage cannot be written', () => {
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error('full');
      },
    };
    expect(() => new LocalProgressRepository(full).save(GameProgress.fresh())).not.toThrow();
  });
});

test('every progress state after every short sequence loads back the same', () => {
  const differences: string[] = [];
  for (const { steps } of progressSequences) {
    const progress = GameProgress.fresh();
    for (const step of steps) {
      step.apply(progress);
      const repository = new LocalProgressRepository(storage());
      repository.save(progress);
      const loaded = repository.load();
      if (JSON.stringify(snapshot(loaded)) !== JSON.stringify(snapshot(progress))) differences.push(step.label);
    }
  }
  expect(differences).toEqual([]);
});
