import { describe, expect, test } from 'vitest';
import { progressLevels, progressOrder, progressSequences } from '../../test-support/progress-sequences';
import { LevelId } from '../shared/level-id';
import { StarCount } from '../shared/star-count';
import { GameProgress } from './game-progress';
import { LevelOrder } from './level-order';
import { Playthrough, PlayTime } from './playthrough';

const one = LevelId.of('one');
const two = LevelId.of('two');
const three = LevelId.of('three');
const levels = [one, two, three];
const order = LevelOrder.of(levels);
const playthrough = (frames: number, collectedStars: number, starCount = 5): Playthrough =>
  Playthrough.of(PlayTime.ofFrames(frames), StarCount.of(collectedStars), StarCount.of(starCount));

describe('a playthrough', () => {
  test.each([-1, 1.5, Number.NaN])('rejects a play time of %s frames', (frames) => {
    expect(() => PlayTime.ofFrames(frames)).toThrow(RangeError);
  });

  test('cannot collect more stars than the level holds', () => {
    expect(() => playthrough(10, 6, 5)).toThrow(RangeError);
  });

  test.each([
    ['more stars, even when slower', playthrough(900, 4), playthrough(100, 3), true],
    ['fewer stars, even when faster', playthrough(100, 3), playthrough(900, 4), false],
    ['equal stars in fewer frames', playthrough(100, 3), playthrough(101, 3), true],
    ['equal stars in the same frames', playthrough(100, 3), playthrough(100, 3), false],
    ['equal stars in more frames', playthrough(101, 3), playthrough(100, 3), false],
    ['a different star count, even with fewer stars', playthrough(900, 1, 8), playthrough(100, 5, 5), true],
  ])('is better with %s', (_, candidate, best, better) => {
    expect(candidate.isBetterThan(best)).toBe(better);
  });
});

describe('game progress', () => {
  test('starts at the first level with only the first level unlocked', () => {
    const progress = GameProgress.fresh();
    expect(progress.continueLevelAmong(order)).toBe(one);
    expect(levels.map((level) => progress.isUnlocked(level, order))).toEqual([true, false, false]);
  });

  test('unlocks and continues every level it reaches', () => {
    const progress = GameProgress.fresh();
    progress.reach(two);
    progress.reach(three);
    expect(progress.continueLevelAmong(order)).toBe(three);
    expect(levels.map((level) => progress.isUnlocked(level, order))).toEqual([true, true, true]);
  });

  test('keeps later levels unlocked when an earlier one is replayed', () => {
    const progress = GameProgress.fresh();
    progress.reach(three);
    progress.reach(one);
    expect(progress.continueLevelAmong(order)).toBe(one);
    expect(progress.isUnlocked(three, order)).toBe(true);
    expect(progress.unlockedLevels).toEqual([three, one]);
  });

  test('continues at the first level when the saved one is no longer in the game', () => {
    const progress = GameProgress.fresh();
    progress.reach(LevelId.of('removed'));
    expect(progress.continueLevelAmong(order)).toBe(one);
  });

  test('keeps only a better playthrough as the best one', () => {
    const progress = GameProgress.fresh();
    progress.complete(one, playthrough(500, 3), order);
    progress.complete(one, playthrough(400, 2), order);
    expect(progress.bestPlaythroughOf(one)).toEqual(playthrough(500, 3));
    progress.complete(one, playthrough(450, 3), order);
    expect(progress.bestPlaythroughOf(one)).toEqual(playthrough(450, 3));
    expect(progress.bestPlaythroughOf(two)).toBeNull();
  });

  test('completing a level unlocks the next level of the game', () => {
    const progress = GameProgress.fresh();
    progress.complete(one, playthrough(500, 3), order);
    expect(progress.isUnlocked(two, order)).toBe(true);
    expect(progress.unlockedLevels).toEqual([two]);
    expect(progress.continueLevel).toBeNull();
  });

  test('completing the last level unlocks nothing', () => {
    const progress = GameProgress.fresh();
    progress.complete(three, playthrough(500, 3), order);
    expect(progress.unlockedLevels).toEqual([]);
    expect(progress.isUnlocked(two, order)).toBe(false);
    expect(progress.isUnlocked(three, order)).toBe(false);
  });

  test('completing a level that is not in the order unlocks nothing', () => {
    const progress = GameProgress.fresh();
    progress.complete(LevelId.of('removed'), playthrough(500, 3), order);
    expect(progress.unlockedLevels).toEqual([]);
  });

  test('restores what was saved', () => {
    const progress = GameProgress.restore({
      continueLevel: two,
      unlockedLevels: [two, two],
      bestPlaythroughs: [{ level: one, playthrough: playthrough(300, 1) }],
    });
    expect(progress.continueLevel).toBe(two);
    expect(progress.unlockedLevels).toEqual([two]);
    expect(progress.bestPlaythroughs).toEqual([{ level: one, playthrough: playthrough(300, 1) }]);
  });

  test('restoring best playthroughs unlocks nothing beyond the saved unlocked levels', () => {
    const progress = GameProgress.restore({
      continueLevel: one,
      unlockedLevels: [],
      bestPlaythroughs: [
        { level: one, playthrough: playthrough(300, 1) },
        { level: two, playthrough: playthrough(300, 1) },
      ],
    });
    expect(progress.unlockedLevels).toEqual([]);
    expect(progress.isUnlocked(two, order)).toBe(false);
    expect(progress.isUnlocked(three, order)).toBe(false);
  });
});

test.each(progressSequences)(
  'progress through $label never relocks a level, worsens a best playthrough or moves the continue level on completion',
  ({ steps }) => {
    const progress = GameProgress.fresh();
    const violations: string[] = [];
    for (const step of steps) {
      const continueBefore = progress.continueLevel;
      const unlockedBefore = progressLevels.map((level) => progress.isUnlocked(level, progressOrder));
      const bestBefore = progressLevels.map((level) => progress.bestPlaythroughOf(level));
      step.apply(progress);
      const continueAfter = progress.continueLevel;
      const continueKept =
        continueBefore === null
          ? continueAfter === null
          : continueAfter !== null && continueBefore.equals(continueAfter);
      if (step.completes && !continueKept) violations.push(`${step.label}: moved the continue level`);
      progressLevels.forEach((level, index) => {
        if (unlockedBefore[index] && !progress.isUnlocked(level, progressOrder))
          violations.push(`${step.label}: relocked ${level.value}`);
        const before = bestBefore[index];
        const after = progress.bestPlaythroughOf(level);
        if (before && (!after || before.isBetterThan(after)))
          violations.push(`${step.label}: worsened the best playthrough of ${level.value}`);
      });
    }
    expect(violations).toEqual([]);
  },
);
