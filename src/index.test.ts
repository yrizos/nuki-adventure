import { expect, test } from 'vitest';
import * as entrypoint from './index.js';

test('the application entrypoint loads', () => {
  expect(Object.keys(entrypoint)).toEqual([]);
});
