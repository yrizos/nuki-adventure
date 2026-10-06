import { expect, test } from 'vitest';
import { SignpostText } from './signpost';

test('rejects a signpost with nothing written on it', () => {
  expect(() => SignpostText.of(' ')).toThrow(RangeError);
});
