import { expect, test } from 'vitest';
import { GameProgress } from '../domain/progress/game-progress';
import { Playthrough, PlayTime } from '../domain/progress/playthrough';
import type { ProgressRepository } from '../domain/progress/progress-repository';
import { LevelId } from '../domain/shared/level-id';
import { StarCount } from '../domain/shared/star-count';
import { ManageProgress } from './manage-progress';

const one = LevelId.of('one');
const two = LevelId.of('two');

function subject() {
  let saved = GameProgress.fresh();
  let saves = 0;
  const repository: ProgressRepository = {
    load: () => GameProgress.restore(saved),
    save: (progress) => {
      saved = progress;
      saves++;
    },
  };
  return { manage: new ManageProgress(repository, [one, two]), saves: () => saves };
}

test('shows the levels of the game by number, with only the first unlocked at first', () => {
  const { manage } = subject();
  expect(manage.view()).toEqual({
    continueLevel: one,
    levels: [
      { id: one, number: 1, isUnlocked: true, bestPlaythrough: null },
      { id: two, number: 2, isUnlocked: false, bestPlaythrough: null },
    ],
  });
});

test('saves reaching a level and completing one', () => {
  const { manage, saves } = subject();
  const playthrough = Playthrough.of(PlayTime.ofFrames(120), StarCount.of(2), StarCount.of(3));
  manage.reach(two);
  manage.complete(one, playthrough);
  expect(saves()).toBe(2);
  const view = manage.view();
  expect(view.continueLevel).toBe(two);
  expect(view.levels.map((level) => level.isUnlocked)).toEqual([true, true]);
  expect(view.levels[0]!.bestPlaythrough).toEqual(playthrough);
});
