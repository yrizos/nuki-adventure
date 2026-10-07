import { describe, expect, test } from 'vitest';
import { GameProgress } from '../domain/progress/game-progress';
import { Playthrough, PlayTime } from '../domain/progress/playthrough';
import { LevelId } from '../domain/shared/level-id';
import { StarCount } from '../domain/shared/star-count';
import { LocalProgressRepository, progressKey } from './local-progress-repository';
import { memoryStorage } from '../test-support/memory-storage';
import { progressLevels, progressSequences } from '../test-support/progress-sequences';

function storage(initial: string | null = null): Storage {
  const store = memoryStorage();
  if (initial !== null) store.setItem(progressKey, initial);
  return store;
}

const saved = {
  version: 1,
  continueLevelId: 'second',
  unlockedLevelIds: ['second'],
  bestPlaythroughs: [{ levelId: 'first', frames: 600, collectedStars: 2, starCount: 3 }],
};

const isFresh = (progress: GameProgress): boolean =>
  progress.continueLevel === null && progress.unlockedLevels.length === 0 && progress.bestPlaythroughs.length === 0;

function expectSameProgress(loaded: GameProgress, expected: GameProgress, label: string): void {
  for (const level of progressLevels) {
    expect(loaded.isUnlocked(level, progressLevels), `${label}: ${level.value} unlocked`).toBe(
      expected.isUnlocked(level, progressLevels),
    );
    expect(loaded.bestPlaythroughOf(level), `${label}: ${level.value} best`).toEqual(expected.bestPlaythroughOf(level));
  }
  expect(loaded.continueLevelAmong(progressLevels), label).toEqual(expected.continueLevelAmong(progressLevels));
}

describe('loading saved progress', () => {
  test('gives fresh progress when nothing is saved', () => {
    expect(isFresh(new LocalProgressRepository(storage()).load())).toBe(true);
  });

  test('reads saved progress into the domain', () => {
    const progress = new LocalProgressRepository(storage(JSON.stringify(saved))).load();
    expect(progress.continueLevel).toEqual(LevelId.of('second'));
    expect(progress.unlockedLevels).toEqual([LevelId.of('second')]);
    expect(progress.bestPlaythroughOf(LevelId.of('first'))).toEqual(
      Playthrough.of(PlayTime.ofFrames(600), StarCount.of(2), StarCount.of(3)),
    );
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
    ['an unsupported version', JSON.stringify({ ...saved, version: 2 })],
    ['an empty level id', JSON.stringify({ ...saved, unlockedLevelIds: [''] })],
    ['a blank level id', JSON.stringify({ ...saved, continueLevelId: '  ' })],
    ['negative frames', JSON.stringify({ ...saved, bestPlaythroughs: [{ ...saved.bestPlaythroughs[0], frames: -1 }] })],
    [
      'more stars collected than the level holds',
      JSON.stringify({ ...saved, bestPlaythroughs: [{ ...saved.bestPlaythroughs[0], collectedStars: 4 }] }),
    ],
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
    progress.complete(LevelId.of('first'), Playthrough.of(PlayTime.ofFrames(600), StarCount.of(2), StarCount.of(3)));
    repository.save(progress);
    expect(JSON.parse(store.getItem(progressKey)!)).toEqual(saved);
    expectSameProgress(repository.load(), progress, 'saved progress');
  });

  test('leaves progress saved by a newer version of the game alone', () => {
    const newer = JSON.stringify({ version: 2, somethingNew: true });
    const store = storage(newer);
    new LocalProgressRepository(store).save(GameProgress.fresh());
    expect(store.getItem(progressKey)).toBe(newer);
  });

  test('overwrites progress that cannot be read', () => {
    const store = storage('{');
    new LocalProgressRepository(store).save(GameProgress.fresh());
    expect(JSON.parse(store.getItem(progressKey)!)).toMatchObject({ version: 1 });
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

test.each(progressSequences)('every progress state after $label loads back the same', ({ steps }) => {
  const progress = GameProgress.fresh();
  for (const step of steps) {
    step.apply(progress);
    const repository = new LocalProgressRepository(storage());
    repository.save(progress);
    expectSameProgress(repository.load(), progress, step.label);
  }
});
