import { expect, test } from 'vitest';
import { feet } from '../domain/level/hero';
import type { Level } from '../domain/level/level';
import { OrbCollected, SignpostRead, type LevelEvent } from '../domain/level/level-events';
import { Direction, Heading, TilePosition, type WorldPosition, tileSize } from '../domain/level/position';
import type { Signpost } from '../domain/level/signpost';
import { check2dObstacles } from './check2d-obstacles';
import { firstLevel } from './first-level';
import { secondLevel } from './second-level';

const keepOrder = (positions: readonly TilePosition[]): readonly TilePosition[] => positions;
const directions = [Direction.Up, Direction.Down, Direction.Left, Direction.Right];
const authoredLevels = [
  { name: 'first', create: firstLevel, orbHint: /ΜΩΒ/ },
  { name: 'second', create: secondLevel, orbHint: /ΤΥΡΚΟΥΑΖ/ },
];

function pathTo(
  level: Level,
  destination: (position: TilePosition) => boolean,
  avoid?: Signpost,
): readonly WorldPosition[] | undefined {
  const obstacles = check2dObstacles(level.outlines);
  const start = level.hero.feet;
  const key = (position: WorldPosition): string => `${position.x},${position.y}`;
  const reached = [start];
  const previous = new Map<string, WorldPosition | null>([[key(start), null]]);
  if (avoid?.isReadableFrom(start.tile)) return undefined;
  for (let index = 0; index < reached.length; index++) {
    const here = reached[index]!;
    if (destination(here.tile)) {
      const path = [here];
      let parent = previous.get(key(here));
      while (parent) {
        path.push(parent);
        parent = previous.get(key(parent));
      }
      return path.reverse();
    }
    for (const direction of directions) {
      const next = here.moved(Heading.of(direction), 2);
      if (
        next.x < 0 ||
        next.y < 0 ||
        next.x >= level.scenery.size.columns * tileSize ||
        next.y >= level.scenery.size.rows * tileSize ||
        previous.has(key(next)) ||
        avoid?.isReadableFrom(next.tile) ||
        !obstacles.walk(feet.at(here), next).equals(next)
      ) {
        continue;
      }
      previous.set(key(next), here);
      reached.push(next);
    }
  }
  return undefined;
}

function follow(level: Level, path: readonly WorldPosition[]): readonly LevelEvent[] {
  const events: LevelEvent[] = [];
  for (const next of path.slice(1)) {
    for (let attempt = 0; attempt < 3 && !level.hero.feet.equals(next); attempt++) {
      events.push(...level.tick(Heading.toward(next.x - level.hero.feet.x, next.y - level.hero.feet.y)));
    }
    expect(level.hero.feet.equals(next), 'the collision-checked path must be playable through Level.tick').toBe(true);
  }
  level.tick(null);
  return events;
}

function besideExit(level: Level, signpost: Signpost): boolean {
  const columns = level.door.footprint.map((tile) => tile.column);
  return [Math.min(...columns) - 1, Math.max(...columns) + 1].some((column) =>
    TilePosition.at(column, level.door.left.row + 1).equals(signpost.position),
  );
}

for (const { name, create, orbHint } of authoredLevels) {
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

  test(`the ${name} level cannot collect its orb without encountering its hint sign`, () => {
    const level = create(keepOrder);
    const hint = level.signposts.find((signpost) => orbHint.test(signpost.text.value) && !besideExit(level, signpost));
    expect(hint, 'the orb needs a location hint separate from the exit hint').toBeDefined();
    expect(hint!.isReadableFrom(level.hero.feet.tile), 'every route starts within the orb hint reading range').toBe(
      true,
    );
    const initialEvents = level.read();
    expect(initialEvents.find((event) => event instanceof SignpostRead)?.position).toEqual(hint!.position);
    expect(initialEvents.some((event) => event instanceof OrbCollected)).toBe(false);
    const orb = level.orbs[0]!;
    const ordinaryPath = pathTo(level, (position) => position.equals(orb.position));
    expect(ordinaryPath, 'the orb must remain reachable').toBeDefined();
    const events = [...initialEvents, ...follow(level, ordinaryPath!)];
    const collectionIndex = events.findIndex((event) => event instanceof OrbCollected);
    expect(collectionIndex, 'the playable route must collect the orb after its hint can be read').toBeGreaterThan(
      events.findIndex((event) => event instanceof SignpostRead),
    );
    const bypass = pathTo(create(keepOrder), (position) => position.equals(orb.position), hint);
    if (bypass) {
      expect(bypass.every((position) => !hint!.isReadableFrom(position.tile))).toBe(true);
      expect(follow(create(keepOrder), bypass).some((event) => event instanceof OrbCollected)).toBe(true);
    }
    expect(bypass === undefined, 'an alternate playable path collects the orb outside the hint reading range').toBe(
      true,
    );
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

test.each(authoredLevels)('the $name level objective hints use singular wording for its one orb', ({ create }) => {
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

test('the second level entry aligns with the previous exit after normalizing map widths', () => {
  const previous = firstLevel(keepOrder);
  const next = secondLevel(keepOrder);
  const previousExitCenter =
    previous.door.footprint.reduce((sum, tile) => sum + tile.column, 0) / previous.door.footprint.length;
  const alignedColumn = (previousExitCenter / (previous.scenery.size.columns - 1)) * (next.scenery.size.columns - 1);
  expect(
    Math.abs(next.hero.position.column - alignedColumn),
    'the entry may differ from the normalized previous exit by at most one tile',
  ).toBeLessThanOrEqual(1);
});
