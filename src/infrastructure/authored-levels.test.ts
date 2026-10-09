import { expect, test } from 'vitest';
import type { Orb } from '../domain/level/collectibles';
import type { Level } from '../domain/level/level';
import { LevelCompleted, OrbCollected, SignpostRead, type LevelEvent } from '../domain/level/level-events';
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
].map((authored) => ({ ...authored, orbCount: authored.create(keepOrder).orbs.length }));
const oneOrbLevels = authoredLevels.filter(({ orbCount }) => orbCount === 1);
const multiOrbLevels = authoredLevels.filter(({ orbCount }) => orbCount > 1);
const orbWords = { red: /ΚΟΚΚΙΝ/u, blue: /ΜΠΛΕ/u, violet: /ΜΩΒ/u, teal: /ΤΥΡΚΟΥΑΖ/u };
const orbCases = authoredLevels.flatMap(({ name, create }) =>
  create(keepOrder).orbs.map((orb, index) => ({ name, create, index, color: orb.color.name })),
);
// The exit sign has to say how many spheres there are, so every orb count that a level can have needs its number here.
const numberWords = new Map([[2, 'ΔΥΟ']]);

function besideExit(level: Level, signpost: Signpost): boolean {
  const columns = level.door.footprint.map((tile) => tile.column);
  return [Math.min(...columns) - 1, Math.max(...columns) + 1].some((column) =>
    TilePosition.at(column, level.door.left.row + 1).equals(signpost.position),
  );
}

function hintFor(level: Level, orb: Orb): Signpost | undefined {
  const others = level.orbs.filter((other) => other !== orb);
  return level.signposts.find(
    (signpost) =>
      orbWords[orb.color.name].test(signpost.text.value) &&
      !others.some((other) => orbWords[other.color.name].test(signpost.text.value)) &&
      !besideExit(level, signpost),
  );
}

const collects =
  (orb: Orb) =>
  (event: LevelEvent): boolean =>
    event instanceof OrbCollected && event.position.equals(orb.position);

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
        /ΣΦΑΙΡ/.test(signpost.text.value) &&
        /ΠΥΛ/.test(signpost.text.value) &&
        !/ΜΩΒ|ΤΥΡΚΟΥΑΖ|ΚΟΚΚΙΝ|ΜΠΛΕ|ΑΝΑΤΟΛ|ΔΥΤΙΚ|ΒΟΡΕΙ|ΝΟΤ|ΟΧΘ/.test(signpost.text.value),
    );
    expect(exitSign, 'the exit hint must explain completion without giving an orb color or location').toBeDefined();
    const path = pathTo(level, (position) => exitSign!.isReadableFrom(position));
    expect(path, 'the exit sign must be readable from reachable ground while the door is closed').toBeDefined();
    follow(level, path!);
    const read = level.read().find((event) => event instanceof SignpostRead);
    expect(read?.position).toEqual(exitSign!.position);
    expect(read?.text).toEqual(exitSign!.text);
  });
}

test.each(orbCases)(
  'the $name level cannot collect its $color orb without encountering its hint sign',
  ({ create, index }) => {
    const level = create(keepOrder);
    const orb = level.orbs[index]!;
    const hint = hintFor(level, orb);
    expect(hint, 'the orb needs a location hint that names only it, separate from the exit hint').toBeDefined();
    const ordinaryPath = pathTo(level, (position) => position.equals(orb.position));
    expect(ordinaryPath, 'the orb must remain reachable').toBeDefined();
    const reading = ordinaryPath!.findIndex((position) => hint!.isReadableFrom(position.tile));
    expect(reading, 'the playable route must come within the hint reading range').toBeGreaterThanOrEqual(0);
    expect(
      follow(level, ordinaryPath!.slice(0, reading + 1)).some(collects(orb)),
      'the orb must not be collected before the hint can be read',
    ).toBe(false);
    expect(level.read().find((event) => event instanceof SignpostRead)?.position).toEqual(hint!.position);
    expect(
      follow(level, ordinaryPath!.slice(reading)).some(collects(orb)),
      'the playable route must collect the orb once its hint has been read',
    ).toBe(true);
    const bypass = pathTo(create(keepOrder), (position) => position.equals(orb.position), hint);
    if (bypass) {
      expect(bypass.every((position) => !hint!.isReadableFrom(position.tile))).toBe(true);
      expect(follow(create(keepOrder), bypass).some(collects(orb))).toBe(true);
    }
    expect(bypass === undefined, 'an alternate playable path collects the orb outside the hint reading range').toBe(
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
  ({ create }) => {
    const level = create(keepOrder);
    const exitSign = level.signposts.find(
      (signpost) =>
        besideExit(level, signpost) &&
        /ΣΦΑΙΡ/.test(signpost.text.value) &&
        /ΠΥΛ/.test(signpost.text.value) &&
        !/ΜΩΒ|ΤΥΡΚΟΥΑΖ|ΚΟΚΚΙΝ|ΜΠΛΕ|ΑΝΑΤΟΛ|ΔΥΤΙΚ|ΒΟΡΕΙ|ΝΟΤ|ΟΧΘ/.test(signpost.text.value),
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

test.each(oneOrbLevels)('the $name level objective hints use singular wording for its one orb', ({ create }) => {
  const level = create(keepOrder);
  expect(level.orbs).toHaveLength(1);
  const offendingSigns = level.signposts.filter((signpost) => {
    const text = signpost.text.value.normalize('NFD').replace(/\p{M}/gu, '');
    if (!/ΣΦΑΙΡ/u.test(text)) return false;
    const words = text.match(/\p{L}+/gu) ?? [];
    return words.some((word) => word === 'ΣΦΑΙΡΕΣ' || word === 'ΣΦΑΙΡΩΝ') || /ΒΡΕΣ\s+ΤΙΣ(?:[^\p{L}]|$)/u.test(text);
  });
  expect(
    offendingSigns.map((signpost) => signpost.text.value),
    'a one-orb objective must not mention plural spheres or instruct the player to find them',
  ).toEqual([]);
});

test.each(multiOrbLevels)(
  'the $name level exit sign says plainly how many spheres there are and mentions the door',
  ({ create, orbCount }) => {
    const level = create(keepOrder);
    const number = numberWords.get(orbCount);
    expect(number, `a ${orbCount}-orb level needs its count spelled out`).toBeDefined();
    const exitSign = level.signposts.find((signpost) => besideExit(level, signpost));
    expect(exitSign, 'the door needs its own sign').toBeDefined();
    const words =
      exitSign!.text.value
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .match(/\p{L}+/gu) ?? [];
    expect(words, 'the objective must state the number of spheres').toContain(number);
    expect(words, 'the objective must speak of the spheres in the plural').toContain('ΣΦΑΙΡΕΣ');
    expect(
      words.some((word) => word.startsWith('ΠΥΛ')),
      'the objective must mention the door',
    ).toBe(true);
  },
);

test.each(multiOrbLevels)('the $name level objective hints never imply a single orb', ({ create }) => {
  const level = create(keepOrder);
  const objectiveSigns = level.signposts.filter((signpost) => {
    const text = signpost.text.value.normalize('NFD').replace(/\p{M}/gu, '');
    return /ΣΦΑΙΡ/u.test(text) && !level.orbs.some((orb) => orbWords[orb.color.name].test(text));
  });
  expect(objectiveSigns.length, 'the level needs an objective hint that is not an orb hint').toBeGreaterThan(0);
  const offendingSigns = objectiveSigns.filter((signpost) => {
    const text = signpost.text.value.normalize('NFD').replace(/\p{M}/gu, '');
    const words = text.match(/\p{L}+/gu) ?? [];
    return words.some((word) => word === 'ΣΦΑΙΡΑ' || word === 'ΣΦΑΙΡΑΣ') || /ΒΡΕΣ\s+ΤΗΝ?(?:[^\p{L}]|$)/u.test(text);
  });
  expect(
    offendingSigns.map((signpost) => signpost.text.value),
    'a multi-orb objective must not speak of one sphere or tell the player to find one',
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
  multiOrbLevels.flatMap(({ name, create, orbCount }) =>
    [
      Array.from({ length: orbCount }, (_, index) => index),
      Array.from({ length: orbCount }, (_, index) => orbCount - 1 - index),
    ].map((order) => ({
      name,
      create,
      order,
      label: order.map((index) => create(keepOrder).orbs[index]!.color.name).join(' then '),
    })),
  ),
)('the $name level completes at its door after its orbs are collected $label', ({ create, order }) => {
  const level = create(keepOrder);
  const orbs = order.map((index) => level.orbs[index]!);
  for (const [collected, orb] of orbs.entries()) {
    const path = pathTo(level, (position) => position.equals(orb.position));
    expect(path, 'the orb must be reachable from where she stands').toBeDefined();
    const events = follow(level, path!).filter((event) => event instanceof OrbCollected);
    expect(
      events.map((event) => event.position),
      'walking to an orb must collect only that orb',
    ).toEqual([orb.position]);
    expect(level.orbs).toHaveLength(orbs.length - collected - 1);
    expect(level.door.isOpen).toBe(false);
    if (collected < orbs.length - 1) {
      expect(() => level.openDoor(), 'the door must refuse to open while an orb remains').toThrow();
      expect(level.door.isOpen).toBe(false);
    }
    expect(level.isComplete).toBe(false);
  }
  level.openDoor();
  expect(level.door.isOpen, 'the last orb must allow the door to open').toBe(true);
  const toDoor = pathTo(level, (position) => level.door.covers(position));
  expect(toDoor, 'the open door must be reachable').toBeDefined();
  expect(follow(level, toDoor!).some((event) => event instanceof LevelCompleted)).toBe(true);
  expect(level.isComplete).toBe(true);
});
