import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { PlayLevel } from '../application/play-level';
import { fifthLevel } from '../infrastructure/fifth-level';
import { firstLevel } from '../infrastructure/first-level';
import { fourthLevel } from '../infrastructure/fourth-level';
import { InMemoryLevelRepository } from '../infrastructure/in-memory-level-repository';
import { secondLevel } from '../infrastructure/second-level';
import { sixthLevel } from '../infrastructure/sixth-level';
import { thirdLevel } from '../infrastructure/third-level';
import { keepOrder } from '../test-support/star-spots';
import { png } from '../test-support/png';
import { levelMap } from './level-map';

// `make level-map LEVEL=<id|all>` sets this. The suite skips it, because it only writes pictures for a person to judge.
const requested = process.env['LEVEL_MAP'];
const levels = [firstLevel, secondLevel, thirdLevel, fourthLevel, fifthLevel, sixthLevel].map((create) =>
  create(keepOrder),
);
const chosen = levels.filter((level) => requested === 'all' || level.id.value === requested);

test.skipIf(!requested)('writes the level picker card map of each requested level', () => {
  expect(chosen, `no level is named ${requested}`).not.toEqual([]);
  const directory = new URL('../../test-output/level-maps/', import.meta.url);
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
