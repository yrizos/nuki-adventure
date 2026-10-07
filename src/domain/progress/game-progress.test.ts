import { describe, expect, test } from 'vitest';
import { progressLevels, progressSequences } from '../../test-support/progress-sequences';
import { LevelId } from '../shared/level-id';
import { StarCount } from '../shared/star-count';
import { GameProgress } from './game-progress';
import { Playthrough, PlayTime } from './playthrough';

const one = LevelId.of('one');
const two = LevelId.of('two');
const three = LevelId.of('three');
const levels = [one, two, three];
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
    expect(progress.continueLevelAmong(levels)).toBe(one);
    expect(levels.map((level) => progress.isUnlocked(level, levels))).toEqual([true, false, false]);
  });

  test('unlocks and continues every level it reaches', () => {
    const progress = GameProgress.fresh();
    progress.reach(two);
    progress.reach(three);
    expect(progress.continueLevelAmong(levels)).toBe(three);
    expect(levels.map((level) => progress.isUnlocked(level, levels))).toEqual([true, true, true]);
  });

  test('keeps later levels unlocked when an earlier one is replayed', () => {
    const progress = GameProgress.fresh();
    progress.reach(three);
    progress.reach(one);
    expect(progress.continueLevelAmong(levels)).toBe(one);
    expect(progress.isUnlocked(three, levels)).toBe(true);
    expect(progress.unlockedLevels).toEqual([three, one]);
  });

  test('continues at the first level when the saved one is no longer in the game', () => {
    const progress = GameProgress.fresh();
    progress.reach(LevelId.of('removed'));
    expect(progress.continueLevelAmong(levels)).toBe(one);
  });

  test('keeps only a better playthrough as the best one', () => {
    const progress = GameProgress.fresh();
    progress.complete(one, playthrough(500, 3));
    progress.complete(one, playthrough(400, 2));
    expect(progress.bestPlaythroughOf(one)).toEqual(playthrough(500, 3));
    progress.complete(one, playthrough(450, 3));
    expect(progress.bestPlaythroughOf(one)).toEqual(playthrough(450, 3));
    expect(progress.bestPlaythroughOf(two)).toBeNull();
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
});

test.each(progressSequences)(
  'progress through $label never relocks a level or worsens a best playthrough',
  ({ steps }) => {
    const progress = GameProgress.fresh();
    for (const step of steps) {
      const unlockedBefore = progressLevels.filter((level) => progress.isUnlocked(level, progressLevels));
      const bestBefore = progressLevels.map((level) => progress.bestPlaythroughOf(level));
      step.apply(progress);
      expect(
        progressLevels.filter((level) => progress.isUnlocked(level, progressLevels)),
        step.label,
      ).toEqual(expect.arrayContaining(unlockedBefore));
      progressLevels.forEach((level, index) => {
        const before = bestBefore[index];
        if (!before) return;
        const after = progress.bestPlaythroughOf(level);
        expect(after, step.label).not.toBeNull();
        expect(before.isBetterThan(after!), step.label).toBe(false);
      });
    }
  },
);
