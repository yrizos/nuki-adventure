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

  test('keeps the last completed playthrough even when it is worse', () => {
    const progress = GameProgress.fresh();
    progress.complete(one, playthrough(400, 5), order);
    progress.complete(one, playthrough(900, 1), order);
    expect(progress.lastPlaythroughOf(one)).toEqual(playthrough(900, 1));
    expect(progress.lastPlaythroughOf(two)).toBeNull();
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
      lastPlaythroughs: [{ level: one, playthrough: playthrough(300, 1) }],
    });
    expect(progress.continueLevel).toBe(two);
    expect(progress.unlockedLevels).toEqual([two]);
    expect(progress.lastPlaythroughs).toEqual([{ level: one, playthrough: playthrough(300, 1) }]);
  });

  test('restoring last playthroughs unlocks nothing beyond the saved unlocked levels', () => {
    const progress = GameProgress.restore({
      continueLevel: one,
      unlockedLevels: [],
      lastPlaythroughs: [
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
  'progress through $label never relocks a level or moves the continue level on completion, and keeps each completion as the last playthrough',
  ({ steps }) => {
    const progress = GameProgress.fresh();
    const violations: string[] = [];
    for (const step of steps) {
      const continueBefore = progress.continueLevel;
      const unlockedBefore = progressLevels.map((level) => progress.isUnlocked(level, progressOrder));
      step.apply(progress);
      const continueAfter = progress.continueLevel;
      const continueKept =
        continueBefore === null
          ? continueAfter === null
          : continueAfter !== null && continueBefore.equals(continueAfter);
      if (step.completion && !continueKept) violations.push(`${step.label}: moved the continue level`);
      const last = step.completion && progress.lastPlaythroughOf(step.completion.level);
      if (step.completion && !last?.equals(step.completion.playthrough))
        violations.push(`${step.label}: did not keep the playthrough as the last one`);
      progressLevels.forEach((level, index) => {
        if (unlockedBefore[index] && !progress.isUnlocked(level, progressOrder))
          violations.push(`${step.label}: relocked ${level.value}`);
      });
    }
    expect(violations).toEqual([]);
  },
);
