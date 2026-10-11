import { expect, test } from 'vitest';
import type { Key } from '../domain/level/collectibles';
import type { Level } from '../domain/level/level';
import { LevelCompleted, KeyCollected, SignpostRead, type LevelEvent } from '../domain/level/level-events';
import { Direction, TilePosition } from '../domain/level/position';
import type { Signpost } from '../domain/level/signpost';
import { keepOrder, reverseOrder, starSpotsOf } from '../test-support/star-spots';
import { follow, pathTo } from '../test-support/walk-level';
import { firstLevel } from './first-level';
import { secondLevel } from './second-level';
import { thirdLevel } from './third-level';

const authoredLevels = [
  { name: 'first', create: firstLevel },
  { name: 'second', create: secondLevel },
  { name: 'third', create: thirdLevel },
].map((authored) => ({ ...authored, keyCount: authored.create(keepOrder).keys.length }));
const oneKeyLevels = authoredLevels.filter(({ keyCount }) => keyCount === 1);
const multiKeyLevels = authoredLevels.filter(({ keyCount }) => keyCount > 1);
// Every key looks the same, so each key's hint sign is named here by position, in the order the level lists its keys.
const keyHints: Readonly<Record<string, readonly TilePosition[]>> = {
  first: [TilePosition.at(14, 12)],
  second: [TilePosition.at(9, 17)],
  third: [TilePosition.at(10, 9), TilePosition.at(20, 7)],
};
const keyCases = authoredLevels.flatMap(({ name, create }) =>
  create(keepOrder).keys.map((_, index) => ({ name, create, index })),
);
// The exit sign has to say how many keys there are, so every key count that a level can have needs its number here.
const numberWords = new Map([[2, 'ΔΥΟ']]);

function besideExit(level: Level, signpost: Signpost): boolean {
  const columns = level.door.footprint.map((tile) => tile.column);
  return [Math.min(...columns) - 1, Math.max(...columns) + 1].some((column) =>
    TilePosition.at(column, level.door.left.row + 1).equals(signpost.position),
  );
}

function hintFor(level: Level, name: string, index: number): Signpost | undefined {
  const position = keyHints[name]![index]!;
  return level.signposts.find((signpost) => signpost.position.equals(position) && !besideExit(level, signpost));
}

function isKeyHint(name: string, signpost: Signpost): boolean {
  return keyHints[name]!.some((position) => position.equals(signpost.position));
}

const collects =
  (key: Key) =>
  (event: LevelEvent): boolean =>
    event instanceof KeyCollected && event.position.equals(key.position);

for (const { name, create } of authoredLevels) {
  test(`the ${name} level enters at its bottom playable edge, facing inward and far from the exit`, () => {
    const level = create(keepOrder);
    const bottomPlayableRow = Math.max(
      ...Array.from({ length: level.scenery.size.rows }, (_, row) =>
        Array.from({ length: level.scenery.size.columns }, (_, column) => TilePosition.at(column, row)),
      )
        .flat()
        .filter(
          (tile) =>
            level.scenery.isWalkable(tile) &&
            !level.stones.some((stone) => stone.position.equals(tile)) &&
            !level.signposts.some((signpost) => signpost.position.equals(tile)) &&
            !level.door.covers(tile),
        )
        .map((tile) => tile.row),
    );
    expect(level.hero.facing).toBe(Direction.Up);
    expect(level.hero.position.row, 'the entry belongs on the bottom playable edge').toBe(bottomPlayableRow);
    expect(
      Math.min(...level.door.footprint.map((tile) => level.hero.position.row - tile.row)),
      'the exit must stay beyond the seven-row minimum game view from the entry',
    ).toBeGreaterThanOrEqual(7);
  });

  test(`the ${name} level signposts never use compass directions or bearings`, () => {
    const forbiddenWords = [
      /^(?:(?:north|south)(?:east|west)?|east|west)(?:ern|erly|ward|wards|erner|erners)?$/iu,
      /^(?:βορ(?:ει|ε|ι|ρα|ρη)|νοτι|ανατολ|δυτικ)[α-ω]*$|^(?:νοτ(?:ος|ου|ο|ε|οι|ων|ους)|δυσ(?:η|ης|εως|ιν))$/iu,
      /^(?:n|s|e|w|ne|nw|se|sw|nne|nnw|ene|ese|sse|ssw|wsw|wnw)$/iu,
      /^(?:bearings?|azimuths?|degrees?|μοιρ[α-ω]*|αζιμουθ[α-ω]*|διοπτευ[α-ω]*)$/iu,
    ];
    const offendingSigns = create(keepOrder).signposts.filter((signpost) => {
      const text = signpost.text.value.normalize('NFD').replace(/\p{M}/gu, '');
      const words = text.match(/\p{L}+/gu) ?? [];
      return words.some((word) => forbiddenWords.some((pattern) => pattern.test(word))) || /\d\s*°/u.test(text);
    });
    expect(
      offendingSigns.map((signpost) => signpost.text.value),
      'signposts must refer to visible landmarks because the player has no compass',
    ).toEqual([]);
  });

  test(`the ${name} level exit has its own reachable, readable general completion hint`, () => {
    const level = create(keepOrder);
    const exitSigns = level.signposts.filter((signpost) => besideExit(level, signpost));
    expect(exitSigns.length, 'the exit needs an adjacent sign, not a distant location hint').toBeGreaterThan(0);
    const exitSign = exitSigns.find(
      (signpost) =>
        /ΚΛΕΙΔ/.test(signpost.text.value) &&
        /ΠΥΛ/.test(signpost.text.value) &&
        !isKeyHint(name, signpost) &&
        !/ΠΕΡΙΜΕΝΕΙ|ΜΗΛΕΩΝ|ΛΙΜΝ|ΛΟΥΛΟΥΔ|ΑΝΑΤΟΛ|ΔΥΤΙΚ|ΒΟΡΕΙ|ΝΟΤ|ΟΧΘ/.test(signpost.text.value),
    );
    expect(exitSign, 'the exit hint must explain completion without giving a key location').toBeDefined();
    const path = pathTo(level, (position) => exitSign!.isReadableFrom(position));
    expect(path, 'the exit sign must be readable from reachable ground while the door is closed').toBeDefined();
    follow(level, path!);
    const read = level.read().find((event) => event instanceof SignpostRead);
    expect(read?.position).toEqual(exitSign!.position);
    expect(read?.text).toEqual(exitSign!.text);
  });
}

test.each(keyCases)(
  'the $name level cannot collect key $index without encountering its hint sign',
  ({ name, create, index }) => {
    const level = create(keepOrder);
    const key = level.keys[index]!;
    const hint = hintFor(level, name, index);
    expect(hint, 'the key needs its own location hint, separate from the exit hint').toBeDefined();
    const ordinaryPath = pathTo(level, (position) => position.equals(key.position));
    expect(ordinaryPath, 'the key must remain reachable').toBeDefined();
    const reading = ordinaryPath!.findIndex((position) => hint!.isReadableFrom(position.tile));
    expect(reading, 'the playable route must come within the hint reading range').toBeGreaterThanOrEqual(0);
    expect(
      follow(level, ordinaryPath!.slice(0, reading + 1)).some(collects(key)),
      'the key must not be collected before the hint can be read',
    ).toBe(false);
    expect(level.read().find((event) => event instanceof SignpostRead)?.position).toEqual(hint!.position);
    expect(
      follow(level, ordinaryPath!.slice(reading)).some(collects(key)),
      'the playable route must collect the key once its hint has been read',
    ).toBe(true);
    const bypass = pathTo(create(keepOrder), (position) => position.equals(key.position), hint);
    if (bypass) {
      expect(bypass.every((position) => !hint!.isReadableFrom(position.tile))).toBe(true);
      expect(follow(create(keepOrder), bypass).some(collects(key))).toBe(true);
    }
    expect(bypass === undefined, 'an alternate playable path collects the key outside the hint reading range').toBe(
      true,
    );
  },
);

test.each(authoredLevels)('the $name level holds exactly five stars', ({ create }) => {
  expect(create(keepOrder).stars).toHaveLength(5);
});

test.each(authoredLevels)('the $name level marks fifteen star spots', ({ create }) => {
  expect(starSpotsOf(create)).toHaveLength(15);
});

test.each(authoredLevels)('the $name level holds different stars under a different shuffle', ({ create }) => {
  const stars = (shuffle: typeof keepOrder) => create(shuffle).stars.map((star) => star.position);
  expect(stars(reverseOrder)).not.toEqual(stars(keepOrder));
});

test.each(authoredLevels)(
  'the $name level general exit sign is beside either door end and one row inside the fence',
  ({ name, create }) => {
    const level = create(keepOrder);
    const exitSign = level.signposts.find(
      (signpost) =>
        besideExit(level, signpost) &&
        /ΚΛΕΙΔ/.test(signpost.text.value) &&
        /ΠΥΛ/.test(signpost.text.value) &&
        !isKeyHint(name, signpost) &&
        !/ΠΕΡΙΜΕΝΕΙ|ΜΗΛΕΩΝ|ΛΙΜΝ|ΛΟΥΛΟΥΔ|ΑΝΑΤΟΛ|ΔΥΤΙΚ|ΒΟΡΕΙ|ΝΟΤ|ΟΧΘ/.test(signpost.text.value),
    );
    expect(exitSign, 'the door needs its own general completion hint').toBeDefined();
    expect(besideExit(level, exitSign!)).toBe(true);
    expect(level.door.covers(exitSign!.position)).toBe(false);
    expect(
      level.scenery.fences.some((fence) => fence.position.equals(exitSign!.position.neighbor(Direction.Up))),
      'the fence directly above the sign must stay intact',
    ).toBe(true);
    expect(level.signposts.some((signpost) => level.door.covers(signpost.position))).toBe(false);
  },
);

test.each(oneKeyLevels)('the $name level objective hints use singular wording for its one key', ({ create }) => {
  const level = create(keepOrder);
  expect(level.keys).toHaveLength(1);
  const offendingSigns = level.signposts.filter((signpost) => {
    const text = signpost.text.value.normalize('NFD').replace(/\p{M}/gu, '');
    if (!/ΚΛΕΙΔ/u.test(text)) return false;
    const words = text.match(/\p{L}+/gu) ?? [];
    return words.some((word) => word === 'ΚΛΕΙΔΙΑ' || word === 'ΚΛΕΙΔΙΩΝ') || /ΒΡΕΣ\s+ΤΑ(?:[^\p{L}]|$)/u.test(text);
  });
  expect(
    offendingSigns.map((signpost) => signpost.text.value),
    'a one-key objective must not mention plural keys or instruct the player to find them',
  ).toEqual([]);
});

test.each(multiKeyLevels)(
  'the $name level exit sign says plainly how many keys there are and mentions the door',
  ({ create, keyCount }) => {
    const level = create(keepOrder);
    const number = numberWords.get(keyCount);
    expect(number, `a ${keyCount}-key level needs its count spelled out`).toBeDefined();
    const exitSign = level.signposts.find((signpost) => besideExit(level, signpost));
    expect(exitSign, 'the door needs its own sign').toBeDefined();
    const words =
      exitSign!.text.value
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .match(/\p{L}+/gu) ?? [];
    expect(words, 'the objective must state the number of keys').toContain(number);
    expect(words, 'the objective must speak of the keys in the plural').toContain('ΚΛΕΙΔΙΑ');
    expect(
      words.some((word) => word.startsWith('ΠΥΛ')),
      'the objective must mention the door',
    ).toBe(true);
  },
);

test.each(multiKeyLevels)('the $name level objective hints never imply a single key', ({ name, create }) => {
  const level = create(keepOrder);
  const objectiveSigns = level.signposts.filter(
    (signpost) => /ΚΛΕΙΔ/u.test(signpost.text.value) && !isKeyHint(name, signpost),
  );
  expect(objectiveSigns.length, 'the level needs an objective hint that is not a key hint').toBeGreaterThan(0);
  const offendingSigns = objectiveSigns.filter((signpost) => {
    const text = signpost.text.value.normalize('NFD').replace(/\p{M}/gu, '');
    const words = text.match(/\p{L}+/gu) ?? [];
    return words.some((word) => word === 'ΚΛΕΙΔΙ' || word === 'ΚΛΕΙΔΙΟΥ') || /ΒΡΕΣ\s+ΤΟ(?:[^\p{L}]|$)/u.test(text);
  });
  expect(
    offendingSigns.map((signpost) => signpost.text.value),
    'a multi-key objective must not speak of one key or tell the player to find one',
  ).toEqual([]);
});

test.each(authoredLevels.slice(1).map((next, index) => ({ previous: authoredLevels[index]!, next })))(
  'the $next.name level entry aligns with the $previous.name exit after normalizing map widths',
  ({ previous, next }) => {
    const exited = previous.create(keepOrder);
    const entered = next.create(keepOrder);
    const exitCenter = exited.door.footprint.reduce((sum, tile) => sum + tile.column, 0) / exited.door.footprint.length;
    const alignedColumn = (exitCenter / (exited.scenery.size.columns - 1)) * (entered.scenery.size.columns - 1);
    expect(
      Math.abs(entered.hero.position.column - alignedColumn),
      'the entry may differ from the normalized previous exit by at most one tile',
    ).toBeLessThanOrEqual(1);
  },
);

test.each(
  multiKeyLevels.flatMap(({ name, create, keyCount }) =>
    [
      Array.from({ length: keyCount }, (_, index) => index),
      Array.from({ length: keyCount }, (_, index) => keyCount - 1 - index),
    ].map((order) => ({
      name,
      create,
      order,
      label: order.join(' then '),
    })),
  ),
)('the $name level completes at its door after its keys are collected $label', ({ create, order }) => {
  const level = create(keepOrder);
  const keys = order.map((index) => level.keys[index]!);
  for (const [collected, key] of keys.entries()) {
    const path = pathTo(level, (position) => position.equals(key.position));
    expect(path, 'the key must be reachable from where she stands').toBeDefined();
    const events = follow(level, path!).filter((event) => event instanceof KeyCollected);
    expect(
      events.map((event) => event.position),
      'walking to a key must collect only that key',
    ).toEqual([key.position]);
    expect(level.keys).toHaveLength(keys.length - collected - 1);
    expect(level.door.isOpen).toBe(false);
    if (collected < keys.length - 1) {
      expect(() => level.openDoor(), 'the door must refuse to open while a key remains').toThrow();
      expect(level.door.isOpen).toBe(false);
    }
    expect(level.isComplete).toBe(false);
  }
  level.openDoor();
  expect(level.door.isOpen, 'the last key must allow the door to open').toBe(true);
  const toDoor = pathTo(level, (position) => level.door.covers(position));
  expect(toDoor, 'the open door must be reachable').toBeDefined();
  expect(follow(level, toDoor!).some((event) => event instanceof LevelCompleted)).toBe(true);
  expect(level.isComplete).toBe(true);
});
