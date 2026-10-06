import { describe, expect, test } from 'vitest';
import { Area, Orb, OrbColor, Star, StarCount } from './collectibles';
import { Door } from './door';
import { Step } from './hero';
import { Level, Stone } from './level';
import { LevelCompleted, OrbCollected, SignpostLeft, SignpostRead, StarCollected } from './level-events';
import { LevelId } from './level-id';
import { Direction, TilePosition } from './position';
import { Fence, Flower, Ground, LevelSize, Scenery, Tree } from './scenery';
import { Signpost, SignpostText } from './signpost';

const at = TilePosition.at;
const area = (keep: (position: TilePosition) => boolean): Area =>
  Area.of(Array.from({ length: 1600 }, (_, index) => TilePosition.at(index % 40, Math.floor(index / 40))).filter(keep));
const everywhere = area(() => true);
const leftHalf = area((position) => position.column < 2);
const rightHalf = area((position) => position.column >= 2);
const hint = SignpostText.of('ΔΙΑΒΑΣΕ ΜΕ');
const signpostAt = (position: TilePosition): Signpost => Signpost.at(position, hint);

// Layouts without a door get a closed one on an extra row below, out of the way of the hero.
function parse(given: readonly string[]): { scenery: Scenery; where: (symbol: string) => TilePosition[] } {
  const layout = given.some((line) => line.includes('D')) ? given : [...given, 'DDD'.padEnd(given[0]!.length, '.')];
  const size = LevelSize.of(layout[0]!.length, layout.length);
  const ground = layout.map((line) => [...line].map((symbol) => (symbol === '~' ? Ground.Water : Ground.Grass)));
  const cells = layout.flatMap((line, row) =>
    [...line].map((symbol, column) => ({ symbol, position: at(column, row) })),
  );
  const where = (symbol: string): TilePosition[] =>
    cells.filter((cell) => cell.symbol === symbol).map((cell) => cell.position);
  return {
    scenery: Scenery.of(size, ground, where('T').map(Tree.at), where('*').map(Flower.at), where('F').map(Fence.at)),
    where,
  };
}

function level(given: readonly string[], start: TilePosition, orb: TilePosition): Level {
  const { scenery, where } = parse(given);
  return Level.create({
    id: LevelId.of('test'),
    scenery,
    stones: where('o').map(Stone.at),
    orbs: [Orb.at(orb, OrbColor.Violet, everywhere)],
    door: Door.closedAt(where('D')[0]!),
    hero: { position: start, facing: Direction.Right },
    stars: where('S').map(Star.at),
    signposts: where('P').map(signpostAt),
  });
}

function scattered(
  given: readonly string[],
  start: TilePosition,
  orb: TilePosition,
  count: number,
  shuffle: (positions: readonly TilePosition[]) => readonly TilePosition[],
): Level {
  const { scenery, where } = parse(given);
  return Level.withScatteredStars(
    {
      id: LevelId.of('test'),
      scenery,
      stones: where('o').map(Stone.at),
      orbs: [Orb.at(orb, OrbColor.Violet, everywhere)],
      door: Door.closedAt(where('D')[0]!),
      hero: { position: start, facing: Direction.Right },
      signposts: where('P').map(signpostAt),
    },
    StarCount.of(count),
    shuffle,
  );
}

function hold(subject: Level, direction: Direction | null, frames: number): void {
  for (let frame = 0; frame < frames; frame++) subject.tick(direction);
}

describe('the hero in a level', () => {
  test.each([
    [Direction.UpLeft, at(0, 0)],
    [Direction.UpRight, at(2, 0)],
    [Direction.DownLeft, at(0, 2)],
    [Direction.DownRight, at(2, 2)],
  ])('walks diagonally %s without increasing speed', (direction, destination) => {
    const subject = level(['...', '...', '...'], at(1, 1), at(0, 1));
    hold(subject, direction, 3);
    expect(subject.hero.step?.direction).toBe(direction);
    expect(subject.hero.facing).toBe(direction.vertical);
    hold(subject, direction, Step.framesPerTile);
    expect(subject.hero.position).toEqual(at(1, 1));
    hold(subject, null, Math.ceil(Step.framesPerTile * Math.SQRT2) - Step.framesPerTile);
    expect(subject.hero.position).toEqual(destination);
  });

  test.each([
    ['.o.', '...', '...'],
    ['...', '..o', '...'],
    ['..o', '...', '...'],
    ['.~.', '...', '...'],
    ['...', '..~', '...'],
  ])('does not cross a blocked diagonal corner or destination in %j', (...layout) => {
    const subject = level(layout, at(1, 1), at(0, 2));
    hold(subject, Direction.UpRight, 40);
    expect(subject.hero.position).toEqual(at(1, 1));
  });

  test('walks one tile in sixteen frames', () => {
    const subject = level(['.....'], at(0, 0), at(4, 0));
    hold(subject, Direction.Right, 1 + Step.framesPerTile);
    expect(subject.hero.position).toEqual(at(1, 0));
  });

  test('shows a new facing for two frames before moving', () => {
    const subject = level(['...', '...'], at(0, 0), at(2, 1));
    subject.tick(Direction.Down);
    expect(subject.hero.facing).toBe(Direction.Down);
    subject.tick(Direction.Down);
    expect(subject.hero.step).toBeNull();
    subject.tick(Direction.Down);
    expect(subject.hero.step?.direction).toBe(Direction.Down);
  });

  test.each([
    ['a stone', '.o..'],
    ['a tree', '.Tt.'],
    ['a fence', '.F..'],
    ['water', '.~..'],
    ['the level edge', '....'],
  ])('is stopped by %s', (_, line) => {
    const start = line === '....' ? at(3, 0) : at(0, 0);
    const subject = level([line], start, at(line === '....' ? 0 : 3, 0));
    hold(subject, Direction.Right, 40);
    expect(subject.hero.position).toEqual(start);
  });

  test('walks over flowers', () => {
    const subject = level(['.*..'], at(0, 0), at(3, 0));
    hold(subject, Direction.Right, 1 + Step.framesPerTile);
    expect(subject.hero.position).toEqual(at(1, 0));
  });

  test('picks up the orb, which opens the door and stops her there', () => {
    const subject = level(['....'], at(0, 0), at(2, 0));
    let events = subject.tick(Direction.Right);
    for (let frame = 0; frame < 80 && events.length === 0; frame++) events = subject.tick(Direction.Right);
    expect(events).toEqual([new OrbCollected(LevelId.of('test'), at(2, 0), OrbColor.Violet, everywhere)]);
    expect(subject.orbs).toEqual([]);
    expect(subject.door.isOpen).toBe(true);
    expect(subject.isComplete).toBe(false);
    expect(subject.hero.position).toEqual(at(2, 0));
    expect(subject.hero.step).toBeNull();
  });

  test('opens the door only once she has picked up every orb', () => {
    const { scenery, where } = parse(['...', 'DDD']);
    const subject = Level.create({
      id: LevelId.of('test'),
      scenery,
      stones: [],
      orbs: [Orb.at(at(1, 0), OrbColor.Red, leftHalf), Orb.at(at(2, 0), OrbColor.Blue, rightHalf)],
      door: Door.closedAt(where('D')[0]!),
      hero: { position: at(0, 0), facing: Direction.Right },
    });
    hold(subject, Direction.Right, 1 + Step.framesPerTile);
    expect(subject.orbs).toEqual([Orb.at(at(2, 0), OrbColor.Blue, rightHalf)]);
    expect(subject.door.isOpen).toBe(false);
    hold(subject, Direction.Right, 1 + Step.framesPerTile);
    expect(subject.orbs).toEqual([]);
    expect(subject.door.isOpen).toBe(true);
  });

  test('picks up a star by walking onto it and keeps walking', () => {
    const subject = level(['.S..', '....', '....'], at(0, 0), at(3, 0));
    const events = Array.from({ length: 1 + Step.framesPerTile }, () => subject.tick(Direction.Right)).flat();
    expect(events).toEqual([new StarCollected(LevelId.of('test'), at(1, 0))]);
    expect(subject.stars).toEqual([]);
    expect(subject.collected).toEqual([Star.at(at(1, 0))]);
    expect(subject.hero.step?.direction).toBe(Direction.Right);
  });

  test('completes the level without picking up the stars', () => {
    const subject = level(['S..', '...', '...', 'DDD'], at(1, 0), at(2, 0));
    hold(subject, Direction.Right, 1 + Step.framesPerTile);
    const events = Array.from({ length: 80 }, () => subject.tick(Direction.Down)).flat();
    expect(events).toEqual([new LevelCompleted(LevelId.of('test'))]);
    expect(subject.stars).toEqual([Star.at(at(0, 0))]);
  });

  test('is stopped by a closed door', () => {
    const subject = level(['...', 'DDD'], at(1, 0), at(2, 0));
    hold(subject, Direction.Down, 40);
    expect(subject.hero.position).toEqual(at(1, 0));
  });

  test('completes the level by stepping into the open doorway, after which nothing moves', () => {
    const subject = level(['...', 'DDD'], at(0, 0), at(1, 0));
    hold(subject, Direction.Right, 1 + Step.framesPerTile);
    expect(subject.door.isOpen).toBe(true);
    const events = Array.from({ length: 80 }, () => subject.tick(Direction.Down)).flat();
    expect(events).toEqual([new LevelCompleted(LevelId.of('test'))]);
    expect(subject.isComplete).toBe(true);
    expect(subject.hero.position).toEqual(at(1, 1));
    expect(subject.hero.step).toBeNull();
  });
});

describe('the hero beside a signpost', () => {
  test.each([at(1, 0), at(0, 1), at(2, 1), at(1, 2)])('reads it from %j', (start) => {
    const subject = level(['...', '.P.', '...'], start, at(0, 0).equals(start) ? at(2, 2) : at(0, 0));
    expect(subject.read()).toEqual([new SignpostRead(LevelId.of('test'), at(1, 1), hint)]);
  });

  test('reads the words of whichever signpost she stands beside', () => {
    const { scenery, where } = parse(['P..P', '....']);
    const left = SignpostText.of('ΑΡΙΣΤΕΡΑ');
    const right = SignpostText.of('ΔΕΞΙΑ');
    const subject = Level.create({
      id: LevelId.of('test'),
      scenery,
      stones: [],
      orbs: [Orb.at(at(2, 1), OrbColor.Violet, everywhere)],
      door: Door.closedAt(where('D')[0]!),
      hero: { position: at(1, 0), facing: Direction.Right },
      stars: [],
      signposts: [Signpost.at(at(0, 0), left), Signpost.at(at(3, 0), right)],
    });
    expect(subject.read()).toEqual([new SignpostRead(LevelId.of('test'), at(0, 0), left)]);
    hold(subject, Direction.Right, 1 + Step.framesPerTile);
    hold(subject, null, 1);
    expect(subject.read()).toEqual([new SignpostRead(LevelId.of('test'), at(3, 0), right)]);
  });

  test('reads nothing from a diagonal tile', () => {
    const subject = level(['...', '.P.', '...'], at(0, 0), at(2, 2));
    expect(subject.read()).toEqual([]);
  });

  test('keeps reading while she turns in place and stops once she steps away', () => {
    const subject = level(['...', '.P.', '...'], at(1, 0), at(2, 2));
    subject.read();
    expect(Array.from({ length: 2 }, () => subject.tick(Direction.Left)).flat()).toEqual([]);
    expect(subject.hero.step).toBeNull();
    expect(subject.tick(Direction.Left)).toEqual([new SignpostLeft(LevelId.of('test'))]);
    expect(Array.from({ length: 40 }, () => subject.tick(Direction.Left)).flat()).toEqual([]);
  });

  test('is stopped by it', () => {
    const subject = level(['.P..'], at(0, 0), at(3, 0));
    hold(subject, Direction.Right, 40);
    expect(subject.hero.position).toEqual(at(0, 0));
  });
});

describe('a level', () => {
  test('rejects a signpost in water', () => {
    expect(() =>
      Level.create({
        id: LevelId.of('test'),
        scenery: Scenery.of(
          LevelSize.of(3, 2),
          [
            [Ground.Grass, Ground.Grass, Ground.Water],
            [Ground.Grass, Ground.Grass, Ground.Grass],
          ],
          [],
          [],
        ),
        stones: [],
        orbs: [Orb.at(at(1, 0), OrbColor.Violet, everywhere)],
        door: Door.closedAt(at(0, 1)),
        hero: { position: at(0, 0), facing: Direction.Right },
        stars: [],
        signposts: [signpostAt(at(2, 0))],
      }),
    ).toThrow(RangeError);
  });

  test.each([OrbColor.Red, OrbColor.Blue, OrbColor.Violet, OrbColor.Teal])(
    'preserves collected %s orb color in its collection event',
    (color) => {
      const ground = [
        [Ground.Grass, Ground.Grass, Ground.Grass],
        [Ground.Grass, Ground.Grass, Ground.Grass],
      ];
      const subject = Level.create({
        id: LevelId.of('color'),
        scenery: Scenery.of(LevelSize.of(3, 2), ground, [], []),
        stones: [],
        orbs: [Orb.at(at(1, 0), color, everywhere)],
        door: Door.closedAt(at(0, 1)),
        hero: { position: at(0, 0), facing: Direction.Right },
      });
      const events = Array.from({ length: 17 }, () => subject.tick(Direction.Right)).flat();
      expect(events).toEqual([new OrbCollected(LevelId.of('color'), at(1, 0), color, everywhere)]);
      expect(subject.orbs).toEqual([]);
    },
  );

  test('rejects a level without an orb', () => {
    const { scenery, where } = parse(['...']);
    expect(() =>
      Level.create({
        id: LevelId.of('test'),
        scenery,
        stones: [],
        orbs: [],
        door: Door.closedAt(where('D')[0]!),
        hero: { position: at(0, 0), facing: Direction.Right },
      }),
    ).toThrow(RangeError);
  });

  test('rejects two orbs on one tile', () => {
    const { scenery, where } = parse(['...']);
    expect(() =>
      Level.create({
        id: LevelId.of('test'),
        scenery,
        stones: [],
        orbs: [Orb.at(at(2, 0), OrbColor.Red, leftHalf), Orb.at(at(2, 0), OrbColor.Blue, rightHalf)],
        door: Door.closedAt(where('D')[0]!),
        hero: { position: at(0, 0), facing: Direction.Right },
      }),
    ).toThrow(RangeError);
  });

  test('rejects orbs that leave a tile faded', () => {
    const { scenery, where } = parse(['...']);
    expect(() =>
      Level.create({
        id: LevelId.of('test'),
        scenery,
        stones: [],
        orbs: [Orb.at(at(2, 0), OrbColor.Red, leftHalf)],
        door: Door.closedAt(where('D')[0]!),
        hero: { position: at(0, 0), facing: Direction.Right },
      }),
    ).toThrow(RangeError);
  });

  test('rejects a hero that starts on a stone', () => {
    expect(() => level(['o..'], at(0, 0), at(2, 0))).toThrow(RangeError);
  });

  test('rejects an orb that cannot be reached', () => {
    expect(() => level(['..~'], at(0, 0), at(2, 0))).toThrow(RangeError);
  });

  test('rejects a star that cannot be reached', () => {
    expect(() =>
      Level.create({
        id: LevelId.of('test'),
        scenery: Scenery.of(
          LevelSize.of(3, 2),
          [
            [Ground.Grass, Ground.Grass, Ground.Water],
            [Ground.Grass, Ground.Grass, Ground.Grass],
          ],
          [],
          [],
        ),
        stones: [],
        orbs: [Orb.at(at(1, 0), OrbColor.Violet, everywhere)],
        door: Door.closedAt(at(0, 1)),
        hero: { position: at(0, 0), facing: Direction.Right },
        stars: [Star.at(at(2, 0))],
      }),
    ).toThrow(RangeError);
  });

  test('rejects a star on open ground that fences cut off from the hero', () => {
    expect(() => level(['..F.S', '..F..'], at(0, 0), at(1, 0))).toThrow(RangeError);
  });

  test('rejects a star behind the door', () => {
    expect(() => level(['.S.', '...', 'DDD'], at(0, 1), at(2, 1))).toThrow(RangeError);
  });

  test('rejects a star behind a tree', () => {
    expect(() => level(['.S..', '.Tt.'], at(0, 0), at(3, 0))).toThrow(RangeError);
  });

  test('rejects a star on the orb', () => {
    expect(() => level(['S..'], at(1, 0), at(0, 0))).toThrow(RangeError);
  });

  test('rejects an orb behind the closed door', () => {
    expect(() => level(['...', 'DDD'], at(0, 0), at(1, 1))).toThrow(RangeError);
  });

  test('rejects a door that does not stand on open ground', () => {
    expect(() => level(['...', 'DD~'], at(0, 0), at(2, 0))).toThrow(RangeError);
  });

  test('rejects trees standing in water', () => {
    expect(() => level(['.T~'], at(0, 0), at(0, 0))).toThrow(RangeError);
  });
});

describe('stars scattered across a level', () => {
  // Trees hide the two tiles above them, the door hides the two rows above it, and fences close off the bottom right corner.
  const layout = ['.....', '.Tt..', '....F', '...F.'];
  const spots = [at(3, 0), at(0, 1), at(3, 1), at(4, 1), at(3, 2)];
  const shuffles: [string, (positions: readonly TilePosition[]) => readonly TilePosition[]][] = [
    ['in order', (positions) => positions],
    ['reversed', (positions) => [...positions].reverse()],
    ['rotated', (positions) => [...positions.slice(2), ...positions.slice(0, 2)]],
  ];

  test.each(shuffles)('fill every visible, reachable tile when %s', (_, shuffle) => {
    const subject = scattered(layout, at(0, 0), at(4, 0), spots.length, shuffle);
    expect(subject.stars.map((star) => star.position)).toEqual(expect.arrayContaining(spots));
    expect(subject.stars).toHaveLength(spots.length);
  });

  test.each(shuffles)('number exactly as many as the level asks for when %s', (_, shuffle) => {
    const subject = scattered(layout, at(0, 0), at(4, 0), 3, shuffle);
    expect(subject.stars).toHaveLength(3);
    expect(spots).toEqual(expect.arrayContaining(subject.stars.map((star) => star.position)));
  });

  test('need enough visible, reachable tiles', () => {
    expect(() => scattered(layout, at(0, 0), at(4, 0), spots.length + 1, (positions) => positions)).toThrow(RangeError);
  });
});
