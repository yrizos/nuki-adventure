import { expect, test } from 'vitest';
import { Area } from './collectibles';

test('rejects an area without tiles', () => {
  expect(() => Area.of([])).toThrow(RangeError);
});
