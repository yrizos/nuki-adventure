import { describe, expect, test } from 'vitest';
import { LevelId } from '../shared/level-id';
import { LevelOrder } from './level-order';

const one = LevelId.of('one');
const two = LevelId.of('two');
const three = LevelId.of('three');

describe('a level order', () => {
  test('rejects an empty list of levels', () => {
    expect(() => LevelOrder.of([])).toThrow(RangeError);
  });

  test('rejects a level that appears twice', () => {
    expect(() => LevelOrder.of([one, two, LevelId.of('one')])).toThrow(RangeError);
  });

  test('starts with its first level', () => {
    expect(LevelOrder.of([two, one]).first).toEqual(two);
  });

  test('includes only its own levels', () => {
    const order = LevelOrder.of([one, two]);
    expect([one, two, three].map((level) => order.includes(level))).toEqual([true, true, false]);
  });

  test.each([
    ['the first level', one, two],
    ['a middle level', two, three],
    ['the last level', three, null],
    ['a level not in the order', LevelId.of('removed'), null],
  ])('names the level after %s', (_, level, next) => {
    expect(LevelOrder.of([one, two, three]).after(level)).toEqual(next);
  });

  test('is unaffected by later changes to the list it was made from', () => {
    const levels = [one, two];
    const order = LevelOrder.of(levels);
    levels.push(three);
    levels[0] = three;
    expect(order).toEqual(LevelOrder.of([one, two]));
  });
});
