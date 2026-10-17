import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { authoredLevels, PlayLevel } from '../../level';
import { check2dObstacles } from '../../level/infrastructure/check2d-obstacles';
import { InMemoryLevelRepository } from '../../level/infrastructure/in-memory-level-repository';
import { keepOrder } from '../../level/testing/star-spots';
import { png } from '../testing/png';
import { levelMap } from './level-map';

// `make level-map LEVEL=<id|all>` sets this. The suite skips it, because it only writes pictures for a person to judge.
const requested = process.env['LEVEL_MAP'];
const levels = authoredLevels.map(({ create }) => create(keepOrder, check2dObstacles));
const chosen = levels.filter((level) => requested === 'all' || level.id.value === requested);

test.skipIf(!requested)('writes the level picker card map of each requested level', () => {
  expect(chosen, `no level is named ${requested}`).not.toEqual([]);
  const directory = new URL('../../../test-output/level-maps/', import.meta.url);
  mkdirSync(directory, { recursive: true });
  for (const level of chosen) {
    const view = new PlayLevel(new InMemoryLevelRepository([level])).view(level.id);
    for (const [colored, name] of [
      [false, 'faded'],
      [true, 'colored'],
    ] as const) {
      const file = new URL(`${level.id.value}-${name}.png`, directory);
      writeFileSync(file, png(levelMap(view, colored, () => 0.5)));
      console.log(decodeURIComponent(file.pathname));
    }
  }
});
