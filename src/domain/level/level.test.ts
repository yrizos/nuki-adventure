import { describe, expect, test } from 'vitest';
import { Boulder } from './boulder';
import { Area, Key, Star } from './collectibles';
import { StarCount } from '../shared/star-count';
import { Door } from './door';
import { Level, Stone } from './level';
import {
  LevelCompleted,
  type LevelEvent,
  KeyCollected,
  StarCollected,
  SwingGateClosed,
  SwingGateClosingStarted,
  SwingGateOpened,
  SwingGateOpeningStarted,
  SwingGateStuck,
  PlatePressed,
  PlateReleased,
} from './level-events';
import { LevelId } from '../shared/level-id';
import { Hero } from './hero';
import { Direction, Heading, TilePosition } from './position';
import { Fence, Flower, Ground, LevelSize, Scenery, Tree, TreeVariant } from './scenery';
import { SwingGate } from './swing-gate';
import { check2dObstacles } from '../../infrastructure/check2d-obstacles';
import { follow, pathTo } from '../../test-support/walk-level';

const at = TilePosition.at;
const area = (keep: (position: TilePosition) => boolean): Area =>
  Area.of(Array.from({ length: 1600 }, (_, index) => TilePosition.at(index % 40, Math.floor(index / 40))).filter(keep));
const everywhere = area(() => true);
const leftHalf = area((position) => position.column < 2);
const rightHalf = area((position) => position.column >= 2);

function parse(given: readonly string[]): { scenery: Scenery; where: (symbol: string) => TilePosition[] } {
  const layout = given.some((line) => line.includes('D'))
    ? given
    : given.map((line, row) => line + (row === 0 ? 'DDD' : '~~~'));
  const size = LevelSize.of(layout[0]!.length, layout.length);
  const ground = layout.map((line) => [...line].map((symbol) => (symbol === '~' ? Ground.Water : Ground.Grass)));
  const cells = layout.flatMap((line, row) =>
    [...line].map((symbol, column) => ({ symbol, position: at(column, row) })),
  );
  const where = (symbol: string): TilePosition[] =>
    cells.filter((cell) => cell.symbol === symbol).map((cell) => cell.position);
  return {
    scenery: Scenery.of(
      size,
      ground,
      where('T').map((base) => Tree.at(base, TreeVariant.NoFruit)),
      where('*').map(Flower.at),
      where('F').map(Fence.at),
      undefined,
      where('W'),
    ),
    where,
  };
}

function level(given: readonly string[], start: TilePosition, key: TilePosition): Level {
  const { scenery, where } = parse(given);
  return Level.create({
    id: LevelId.of('test'),
    scenery,
    stones: where('o').map(Stone.at),
    keys: [Key.at(key, everywhere)],
    door: Door.closedAt(where('D')[0]!),
    hero: { position: start, facing: Direction.Right },
    obstacles: check2dObstacles,
    stars: where('S').map(Star.at),
  });
}

function scattered(
  given: readonly string[],
  start: TilePosition,
  key: TilePosition,
  count: number,
  shuffle: (positions: readonly TilePosition[]) => readonly TilePosition[],
): Level {
  const { scenery, where } = parse(given);
  return Level.withScatteredStars(
    {
      id: LevelId.of('test'),
      scenery,
      stones: where('o').map(Stone.at),
      keys: [Key.at(key, everywhere)],
      door: Door.closedAt(where('D')[0]!),
      hero: { position: start, facing: Direction.Right },
      obstacles: check2dObstacles,
    },
    StarCount.of(count),
    shuffle,
  );
}

const toward = (direction: Direction | null): Heading | null => direction && Heading.of(direction);

function hold(subject: Level, direction: Direction | null, frames: number): readonly LevelEvent[] {
  return Array.from({ length: frames }, () => subject.tick(toward(direction))).flat();
}

describe('the hero in a level', () => {
  test.each([Direction.UpLeft, Direction.UpRight, Direction.DownLeft, Direction.DownRight])(
    'walks diagonally %s as fast as she walks straight',
    (direction) => {
      const straight = level(['.....', '.....', '.....', '.....', '.....'], at(2, 2), at(0, 0));
      const diagonal = level(['.....', '.....', '.....', '.....', '.....'], at(2, 2), at(0, 0));
      const travelled = (subject: Level, heading: Direction): number => {
        hold(subject, heading, 3);
        const { x, y } = subject.hero.feet;
        hold(subject, heading, 10);
        return Math.hypot(subject.hero.feet.x - x, subject.hero.feet.y - y);
      };
      expect(travelled(straight, Direction.Right)).toBeCloseTo(20);
      expect(travelled(diagonal, direction)).toBeCloseTo(20);
    },
  );

  test('shows her part of the way along her last move between ticks', () => {
    const subject = level(['.....'], at(0, 0), at(4, 0));
    hold(subject, Direction.Right, 3);
    expect(subject.hero.between(0).feet.x).toBe(20);
    expect(subject.hero.between(0.25).feet.x).toBe(20.5);
    expect(subject.hero.between(1).feet).toEqual(subject.hero.feet);
    hold(subject, null, 1);
    expect(subject.hero.between(0.5).feet).toEqual(subject.hero.feet);
  });

  test('walks one tile in sixteen frames', () => {
    const subject = level(['.....'], at(0, 0), at(4, 0));
    hold(subject, Direction.Right, 16);
    expect(subject.hero.feet.x).toBe(48);
    expect(subject.hero.position).toEqual(at(1, 0));
  });

  test('shows a new facing for two frames before moving', () => {
    const subject = level(['....', '....'], at(0, 0), at(3, 1));
    const start = subject.hero.feet;
    hold(subject, Direction.Down, 1);
    expect(subject.hero.facing).toBe(Direction.Down);
    hold(subject, Direction.Down, 1);
    expect(subject.hero.feet).toEqual(start);
    hold(subject, Direction.Down, 1);
    expect(subject.hero.feet.y).toBe(start.y + 2);
  });

  test('turns while walking without stopping', () => {
    const subject = level(['....', '....', '....'], at(0, 0), at(3, 2));
    hold(subject, Direction.Right, 4);
    const before = subject.hero.feet;
    hold(subject, Direction.Down, 1);
    expect(subject.hero.facing).toBe(Direction.Down);
    expect(subject.hero.feet.y).toBe(before.y + 2);
  });

  test('keeps her facing while the heading wavers around a diagonal', () => {
    const subject = level(['.....', '.....', '.....'], at(0, 0), at(4, 2));
    for (const angle of [40, 50, 44, 52, 46]) {
      const radians = (angle * Math.PI) / 180;
      subject.tick(Heading.toward(Math.cos(radians), Math.sin(radians)));
      expect(subject.hero.facing).toBe(Direction.Right);
    }
  });

  test.each([
    ['a stone', '.o..', 37, 48],
    ['a tree', '.Tt.', 55, 64],
    ['a fence', '.F..', 44, 44],
    ['water', '.~..', 32, 32],
    ['woodland', '.W..', 32, 32],
  ])('walks up to the base of %s without passing it', (_, line, nearest, farthest) => {
    const subject = level(['DDD.', line], at(0, 1), at(0, 1));
    hold(subject, Direction.Right, 40);
    const front = subject.hero.feet.x + 7;
    expect(front).toBeGreaterThan(nearest - 0.5);
    expect(front).toBeLessThan(farthest + 0.5);
  });

  test('stops at the level edge', () => {
    const subject = level(['DDD.', '....', '....'], at(3, 1), at(3, 2));
    hold(subject, Direction.Right, 40);
    expect(subject.hero.feet.x + 7).toBeCloseTo(128, 0);
  });

  test('slides along water when pushed diagonally into it', () => {
    const subject = level(['DDD..', '.....', '~~~~~'], at(0, 1), at(4, 1));
    hold(subject, Direction.DownRight, 40);
    expect(subject.hero.position.row).toBe(1);
    expect(subject.hero.feet.x).toBeGreaterThan(16 + 40);
  });

  test('slides along woodland when pushed diagonally into it', () => {
    const subject = level(['DDD..', '.....', 'WWWWW'], at(0, 1), at(4, 0));
    hold(subject, Direction.DownRight, 40);
    expect(subject.hero.position.row).toBe(1);
    expect(subject.hero.feet.x).toBeGreaterThan(16 + 40);
  });

  test('cannot cross where two woodland tiles meet at a corner', () => {
    const subject = level(['DDD.', '..W.', '.W..', '....'], at(1, 1), at(3, 0));
    hold(subject, Direction.DownRight, 40);
    expect(subject.hero.position).toEqual(at(1, 1));
  });

  test('slides along a fence when pushed diagonally into it', () => {
    const subject = level(['.F.', '.F.', '.F.', '...'], at(0, 0), at(2, 0));
    hold(subject, Direction.DownRight, 30);
    expect(subject.hero.feet.x + 7).toBeLessThan(44.5);
    expect(subject.hero.feet.y).toBeGreaterThan(28 + 30);
  });

  test('curves around a stone she walks into and carries on', () => {
    const subject = level(['...', '.o.', '...'], at(0, 1), at(2, 0));
    hold(subject, Direction.Right, 60);
    expect(subject.hero.position.column).toBe(2);
  });

  test('walks over flowers', () => {
    const subject = level(['.*..'], at(0, 0), at(3, 0));
    hold(subject, Direction.Right, 16);
    expect(subject.hero.position).toEqual(at(1, 0));
  });

  test('picks up the key once her feet reach its tile, leaving the door closed', () => {
    const subject = level(['....', '....', '....'], at(0, 0), at(2, 0));
    let events = subject.tick(toward(Direction.Right));
    for (let frame = 0; frame < 80 && events.length === 0; frame++) events = subject.tick(toward(Direction.Right));
    expect(events).toEqual([new KeyCollected(LevelId.of('test'), at(2, 0), everywhere)]);
    expect(subject.keys).toEqual([]);
    expect(subject.door.isOpen).toBe(false);
    expect(subject.isComplete).toBe(false);
    expect(subject.hero.position).toEqual(at(2, 0));
  });

  test('opens the door only once she has picked up every key', () => {
    const { scenery, where } = parse(['DDD', '...', '...', '...']);
    const subject = Level.create({
      id: LevelId.of('test'),
      scenery,
      stones: [],
      keys: [Key.at(at(1, 3), leftHalf), Key.at(at(2, 3), rightHalf)],
      door: Door.closedAt(where('D')[0]!),
      hero: { position: at(0, 3), facing: Direction.Right },
      obstacles: check2dObstacles,
    });
    hold(subject, Direction.Right, 16);
    expect(subject.keys).toEqual([Key.at(at(2, 3), rightHalf)]);
    expect(() => subject.openDoor()).toThrow('The door opens only once every key is picked up');
    expect(subject.door.isOpen).toBe(false);
    hold(subject, Direction.Right, 16);
    expect(subject.keys).toEqual([]);
    expect(subject.door.isOpen).toBe(false);
    subject.openDoor();
    expect(subject.door.isOpen).toBe(true);
  });

  test('picks up a star by walking onto it and keeps walking', () => {
    const subject = level(['.S..', '....', '....'], at(0, 0), at(3, 0));
    const events = hold(subject, Direction.Right, 16);
    expect(events).toEqual([new StarCollected(LevelId.of('test'), at(1, 0))]);
    expect(subject.stars).toEqual([]);
    expect(subject.collected).toEqual([Star.at(at(1, 0))]);
    expect(subject.hero.isWalking).toBe(true);
  });

  test('completes the level without picking up the stars', () => {
    const subject = level(['DDD', '...', '...', 'S..'], at(1, 3), at(2, 3));
    hold(subject, Direction.Right, 16);
    subject.openDoor();
    const events = hold(subject, Direction.Up, 80);
    expect(events).toEqual([new LevelCompleted(LevelId.of('test'))]);
    expect(subject.stars).toEqual([Star.at(at(0, 3))]);
  });

  test('is stopped by the door after picking up every key until the door opens', () => {
    const subject = level(['DDD', '...', '...', '...'], at(0, 3), at(1, 3));
    hold(subject, Direction.Right, 16);
    hold(subject, Direction.Up, 60);
    expect(subject.hero.position).toEqual(at(1, 1));
    expect(subject.isComplete).toBe(false);
  });

  test('is stopped by a closed door', () => {
    const subject = level(['DDD', '...', '...', '...'], at(1, 3), at(2, 3));
    hold(subject, Direction.Up, 60);
    expect(subject.hero.position).toEqual(at(1, 1));
  });

  test('completes the level by stepping into the open doorway, after which nothing moves', () => {
    const subject = level(['DDD', '...', '...', '...'], at(0, 3), at(1, 3));
    hold(subject, Direction.Right, 16);
    expect(subject.door.isOpen).toBe(false);
    subject.openDoor();
    expect(subject.door.isOpen).toBe(true);
    const events = hold(subject, Direction.Up, 80);
    expect(events).toEqual([new LevelCompleted(LevelId.of('test'))]);
    expect(subject.isComplete).toBe(true);
    expect(subject.hero.position).toEqual(at(1, 0));
  });
});

describe('a level', () => {
  test.each([
    ['inside the map', ['.......', '..DDD..', '.......', '.......', '.......']],
    ['on the bottom edge', ['.......', '.......', '.......', '.......', '..DDD..']],
    ['only on the left edge', ['.......', 'DDD....', '.......', '.......', '.......']],
    ['only on the right edge', ['.......', '....DDD', '.......', '.......', '.......']],
  ])('rejects an exit door %s with reachable ground above it', (_, layout) => {
    expect(() => level(layout, at(0, 3), at(6, 3))).toThrow(
      new RangeError('The door must stand on the top edge of the playable area'),
    );
  });

  test('accepts an exit door with its base on the top edge', () => {
    const subject = level(['..DDD..', '.......', '.......', '.......'], at(0, 3), at(6, 3));
    expect(subject.door.left.row).toBe(0);
  });

  test('accepts unreachable decorative trees behind an exit door on the playable top edge', () => {
    const subject = level(['.Tt....', '....Tt.', 'FFDDDFF', '.......', '...S...'], at(0, 4), at(6, 4));
    expect(subject.door.left).toEqual(at(2, 2));
    expect(subject.scenery.trees.map((tree) => tree.base)).toEqual([at(1, 0), at(4, 1)]);
    expect(subject.keys.map((key) => key.position)).toEqual([at(6, 4)]);
    expect(subject.stars.map((star) => star.position)).toEqual([at(3, 4)]);
  });

  test('rejects a key outside the fenced playable area', () => {
    expect(() => level(['.Tt....', '....Tt.', 'FFDDDFF', '.......', '...S...'], at(0, 4), at(0, 0))).toThrow(
      new RangeError('Every key must lie where the hero can reach it'),
    );
  });

  test('reports the collected key position and area in its collection event', () => {
    const ground = Array.from({ length: 4 }, () => [Ground.Grass, Ground.Grass, Ground.Grass]);
    const subject = Level.create({
      id: LevelId.of('color'),
      scenery: Scenery.of(LevelSize.of(3, 4), ground, [], []),
      stones: [],
      keys: [Key.at(at(1, 3), everywhere)],
      door: Door.closedAt(at(0, 0)),
      hero: { position: at(0, 3), facing: Direction.Right },
      obstacles: check2dObstacles,
    });
    const events = Array.from({ length: 17 }, () => subject.tick(Heading.of(Direction.Right))).flat();
    expect(events).toEqual([new KeyCollected(LevelId.of('color'), at(1, 3), everywhere)]);
    expect(subject.keys).toEqual([]);
  });

  test('rejects a level without a key', () => {
    const { scenery, where } = parse(['...']);
    expect(() =>
      Level.create({
        id: LevelId.of('test'),
        scenery,
        stones: [],
        keys: [],
        door: Door.closedAt(where('D')[0]!),
        hero: { position: at(0, 0), facing: Direction.Right },
        obstacles: check2dObstacles,
      }),
    ).toThrow(RangeError);
  });

  test('rejects two keys on one tile', () => {
    const { scenery, where } = parse(['...']);
    expect(() =>
      Level.create({
        id: LevelId.of('test'),
        scenery,
        stones: [],
        keys: [Key.at(at(2, 0), leftHalf), Key.at(at(2, 0), rightHalf)],
        door: Door.closedAt(where('D')[0]!),
        hero: { position: at(0, 0), facing: Direction.Right },
        obstacles: check2dObstacles,
      }),
    ).toThrow(RangeError);
  });

  test('rejects keys that leave a tile faded', () => {
    const { scenery, where } = parse(['...']);
    expect(() =>
      Level.create({
        id: LevelId.of('test'),
        scenery,
        stones: [],
        keys: [Key.at(at(2, 0), leftHalf)],
        door: Door.closedAt(where('D')[0]!),
        hero: { position: at(0, 0), facing: Direction.Right },
        obstacles: check2dObstacles,
      }),
    ).toThrow(RangeError);
  });

  test('rejects a hero that starts on a stone', () => {
    expect(() => level(['o..'], at(0, 0), at(2, 0))).toThrow(RangeError);
  });

  test('rejects a key that cannot be reached', () => {
    expect(() => level(['..~'], at(0, 0), at(2, 0))).toThrow(RangeError);
  });

  test('rejects a star that cannot be reached', () => {
    expect(() =>
      Level.create({
        id: LevelId.of('test'),
        scenery: Scenery.of(
          LevelSize.of(3, 3),
          [
            [Ground.Grass, Ground.Grass, Ground.Grass],
            [Ground.Grass, Ground.Grass, Ground.Water],
            [Ground.Grass, Ground.Grass, Ground.Grass],
          ],
          [],
          [],
        ),
        stones: [],
        keys: [Key.at(at(1, 2), everywhere)],
        door: Door.closedAt(at(0, 0)),
        hero: { position: at(0, 2), facing: Direction.Right },
        obstacles: check2dObstacles,
        stars: [Star.at(at(2, 1))],
      }),
    ).toThrow('Every star must lie where the hero can reach it');
  });

  test('rejects a star on open ground that fences cut off from the hero', () => {
    expect(() => level(['..F.S', '..F..'], at(0, 0), at(1, 0))).toThrow(RangeError);
  });

  test('rejects a star behind a tree', () => {
    expect(() => level(['.S..', '.Tt.'], at(0, 0), at(3, 0))).toThrow(RangeError);
  });

  test('rejects a star on the key', () => {
    expect(() => level(['S..'], at(1, 0), at(0, 0))).toThrow(RangeError);
  });

  test('rejects a star on the hero start', () => {
    expect(() => level(['S..'], at(0, 0), at(2, 0))).toThrow(RangeError);
  });

  test('rejects a star behind woodland', () => {
    expect(() => level(['.S..', '.W..', '....'], at(0, 0), at(3, 0))).toThrow(RangeError);
  });

  test('rejects a key behind woodland', () => {
    expect(() => level(['...', '..W', '...'], at(0, 0), at(2, 0))).toThrow(RangeError);
  });

  test('rejects a key that woodland cuts off from the hero', () => {
    expect(() => level(['.W..', '.W..'], at(0, 0), at(3, 1))).toThrow(RangeError);
  });

  test('rejects a key behind a tree', () => {
    expect(() => level(['...', '.Tt'], at(0, 0), at(2, 0))).toThrow(RangeError);
  });

  test('rejects a door that fences cut off from the hero', () => {
    expect(() => level(['DDD', 'FFF', '...'], at(0, 2), at(2, 2))).toThrow(
      'The door must open beside a tile the hero can reach',
    );
  });

  test('rejects a key on the closed door', () => {
    expect(() => level(['DDD', '...'], at(0, 1), at(1, 0))).toThrow('Every key must lie where the hero can reach it');
  });

  test('rejects a door that does not stand on open ground', () => {
    expect(() => level(['DD~', '...'], at(0, 1), at(2, 1))).toThrow(
      'The door needs open ground across its whole width',
    );
  });

  test('rejects trees standing in water', () => {
    expect(() => level(['.T~'], at(0, 0), at(0, 0))).toThrow(RangeError);
  });
});

describe('trees in the scenery', () => {
  const grove = (...trees: Tree[]): Scenery =>
    Scenery.of(
      LevelSize.of(6, 4),
      Array.from({ length: 4 }, () => Array.from({ length: 6 }, () => Ground.Grass)),
      trees,
      [],
    );

  test.each([
    ['side by side', at(2, 0)],
    ['one above the other', at(0, 1)],
    ['only at a corner', at(2, 1)],
  ])('rejects a tree cluster of different variants touching %s', (_, base) => {
    expect(() => grove(Tree.at(at(0, 0), TreeVariant.NoFruit), Tree.at(base, TreeVariant.Apples))).toThrow(RangeError);
  });

  test('accepts a tree cluster of one variant', () => {
    expect(() =>
      grove(
        Tree.at(at(0, 0), TreeVariant.Lemons),
        Tree.at(at(2, 0), TreeVariant.Lemons),
        Tree.at(at(4, 1), TreeVariant.Lemons),
      ),
    ).not.toThrow();
  });

  test('accepts separate tree clusters of different variants two tiles apart', () => {
    expect(() =>
      grove(
        Tree.at(at(0, 0), TreeVariant.NoFruit),
        Tree.at(at(3, 0), TreeVariant.Oranges),
        Tree.at(at(0, 2), TreeVariant.Apples),
      ),
    ).not.toThrow();
  });

  test('are equal only with the same base and variant', () => {
    expect(Tree.at(at(1, 1), TreeVariant.Apples).equals(Tree.at(at(1, 1), TreeVariant.Apples))).toBe(true);
    expect(Tree.at(at(1, 1), TreeVariant.Apples).equals(Tree.at(at(1, 1), TreeVariant.Lemons))).toBe(false);
    expect(Tree.at(at(1, 1), TreeVariant.Apples).equals(Tree.at(at(2, 1), TreeVariant.Apples))).toBe(false);
  });
});

describe('stars scattered across a level', () => {
  const layout = ['.....', '.Tt..', '....F', '...F.'];
  const spots = [
    at(3, 0),
    at(0, 1),
    at(3, 1),
    at(4, 1),
    at(0, 2),
    at(1, 2),
    at(2, 2),
    at(3, 2),
    at(0, 3),
    at(1, 3),
    at(2, 3),
  ];
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

describe('stars chosen among star spots', () => {
  const open = ['......', '......', '......', '......'];
  const hero = at(0, 0);
  const key = at(5, 3);
  const free = Array.from({ length: 24 }, (_, index) => at(index % 6, Math.floor(index / 6))).filter(
    (tile) => !tile.equals(hero) && !tile.equals(key),
  );
  const among = (
    spots: readonly TilePosition[],
    shuffle: (positions: readonly TilePosition[]) => readonly TilePosition[] = (positions) => positions,
  ): Level => {
    const { scenery, where } = parse(open);
    return Level.withStarsAmong(
      {
        id: LevelId.of('test'),
        scenery,
        stones: [],
        keys: [Key.at(key, everywhere)],
        door: Door.closedAt(where('D')[0]!),
        hero: { position: hero, facing: Direction.Right },
        obstacles: check2dObstacles,
      },
      spots,
      shuffle,
    );
  };

  test.each([0, 14])('rejects %s spots', (count) => {
    expect(() => among(free.slice(0, count))).toThrow(RangeError);
  });
  test.each([15, 20])('accepts %s spots', (count) => {
    expect(among(free.slice(0, count)).stars).toHaveLength(5);
  });

  test('rejects an invalid spot even when the shuffle would not pick it', () => {
    expect(() => among([...free.slice(0, 14), hero])).toThrow(RangeError);
  });

  test('holds the first five of the shuffled spots', () => {
    const spots = free.slice(0, 15);
    const subject = among(spots, (positions) => [...positions].reverse());
    expect(subject.stars.map((star) => star.position)).toEqual([...spots].reverse().slice(0, 5));
  });
});

describe('a door', () => {
  test.each([false, true])('hides exactly the two rows above its footprint when open is %s', (open) => {
    const closed = Door.closedAt(at(2, 2));
    const subject = open ? closed.opened() : closed;
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 6; column++) {
        expect(subject.hides(at(column, row))).toBe(row < 2 && column >= 2 && column <= 4);
      }
    }
  });
});

describe('a swing gate', () => {
  const fenced = ['..DDD..', '.......', '.......', 'WWFGFWW', '.......', '.......'];

  function gated(start = at(3, 4), facing = Direction.Up, key = at(0, 0), given: readonly string[] = fenced): Level {
    const { scenery, where } = parse(given);
    return Level.create({
      id: LevelId.of('test'),
      scenery,
      stones: [],
      keys: [Key.at(key, everywhere)],
      door: Door.closedAt(where('D')[0]!),
      hero: { position: start, facing },
      gate: SwingGate.closedAt(where('G')[0]!),
      obstacles: check2dObstacles,
    });
  }

  function opened(subject: Level): Level {
    subject.operateGate();
    subject.finishGate();
    return subject;
  }

  test('lets a key lie behind it, out of reach until it opens', () => {
    const subject = gated();
    expect(pathTo(subject, (tile) => tile.equals(at(0, 0)))).toBeUndefined();
    expect(pathTo(opened(subject), (tile) => tile.equals(at(0, 0)))).toBeDefined();
  });

  test('opens from any tile beside it, whichever way the hero faces', () => {
    expect(gated().canOperateGate).toBe(true);
    expect(gated(at(2, 4)).canOperateGate).toBe(true);
    expect(gated(at(4, 4), Direction.Left).canOperateGate).toBe(true);
    expect(gated(at(3, 4), Direction.Down).canOperateGate).toBe(true);
    expect(gated(at(3, 5)).canOperateGate).toBe(false);
    expect(gated(at(1, 4)).operateGate()).toEqual([]);
    expect(gated(at(1, 4)).gate?.state).toBe('closed');
  });

  test('starts opening once and stays shut while it swings', () => {
    const subject = gated();
    expect(subject.operateGate()).toEqual([new SwingGateOpeningStarted(LevelId.of('test'), at(3, 3))]);
    expect(subject.gate?.state).toBe('opening');
    expect(subject.canOperateGate).toBe(false);
    expect(subject.operateGate()).toEqual([]);
    for (let tick = 0; tick < 40; tick++) subject.tick(Heading.of(Direction.Up));
    expect(subject.hero.position).toEqual(at(3, 4));
  });

  test('never opens when the hero walks into it', () => {
    const subject = gated();
    for (let tick = 0; tick < 40; tick++) subject.tick(Heading.of(Direction.Up));
    expect(subject.gate?.state).toBe('closed');
    expect(subject.hero.position).toEqual(at(3, 4));
  });

  test('lets the hero through both ways once it finishes opening', () => {
    const subject = gated();
    expect(subject.finishGate()).toEqual([]);
    subject.operateGate();
    const before = subject.outlines;
    expect(subject.finishGate()).toEqual([new SwingGateOpened(LevelId.of('test'), at(3, 3))]);
    expect(subject.outlines).not.toEqual(before);
    expect(subject.finishGate()).toEqual([]);
    follow(
      subject,
      pathTo(subject, (tile) => tile.equals(at(3, 2)))!,
    );
    follow(
      subject,
      pathTo(subject, (tile) => tile.equals(at(3, 5)))!,
    );
    expect(subject.gate?.state).toBe('open');
  });

  test('closes again from the far side and shuts the passage as soon as it starts swinging', () => {
    const subject = opened(gated());
    follow(
      subject,
      pathTo(subject, (tile) => tile.equals(at(4, 2)))!,
    );
    expect(subject.canOperateGate).toBe(false);
    for (let tick = 0; tick < 6; tick++) subject.tick(Heading.of(Direction.Up));
    expect(subject.hero.position).toEqual(at(4, 2));
    expect(subject.canOperateGate).toBe(true);
    const open = subject.outlines;
    expect(subject.operateGate()).toEqual([new SwingGateClosingStarted(LevelId.of('test'), at(3, 3))]);
    expect(subject.gate?.state).toBe('closing');
    expect(subject.outlines).not.toEqual(open);
    expect(subject.canOperateGate).toBe(false);
    expect(subject.operateGate()).toEqual([]);
    expect(subject.finishGate()).toEqual([new SwingGateClosed(LevelId.of('test'), at(3, 3))]);
    expect(subject.gate?.state).toBe('closed');
    expect(pathTo(subject, (tile) => tile.equals(at(3, 5)))).toBeUndefined();
    expect(subject.operateGate()).toEqual([new SwingGateOpeningStarted(LevelId.of('test'), at(3, 3))]);
  });

  test('cannot be closed while her feet reach into its passage from a tile beside it', () => {
    const subject = opened(gated());
    for (let tick = 0; tick < 13; tick++) subject.tick(Heading.of(Direction.Up));
    expect(subject.hero.position).toEqual(at(3, 4));
    expect(subject.canOperateGate).toBe(false);
    subject.tick(Heading.of(Direction.Down));
    expect(subject.canOperateGate).toBe(true);
  });

  test('may start on the far side, where she can still reach a tile beside it', () => {
    const farSide = ['..DDD..', '.......', '.......', 'WWFGFWW', '.......', '.......'];
    expect(gated(at(3, 1), Direction.Down, at(0, 5), farSide).canOperateGate).toBe(false);
    expect(() => gated(at(3, 1), Direction.Down, at(0, 5), farSide)).not.toThrow();
  });

  test('cannot be closed while the hero stands in its passage', () => {
    const subject = opened(gated());
    follow(
      subject,
      pathTo(subject, (tile) => tile.equals(at(3, 3)))!,
    );
    expect(subject.canOperateGate).toBe(false);
    expect(subject.operateGate()).toEqual([]);
    expect(subject.gate?.state).toBe('open');
  });

  test('stays open when the key is collected and the door opens', () => {
    const subject = opened(gated());
    const events = follow(
      subject,
      pathTo(subject, (tile) => tile.equals(at(0, 0)))!,
    );
    expect(events.some((event) => event instanceof KeyCollected)).toBe(true);
    subject.openDoor();
    expect(subject.gate?.state).toBe('open');
  });

  test('a new level starts with the gate closed again', () => {
    opened(gated());
    expect(gated().gate?.state).toBe('closed');
  });

  test('must be operable from where the hero starts', () => {
    const pocket = ['..DDD..', '.......', '.......', 'WWFGFWW', 'WW.....', '.W.....'];
    expect(() => gated(at(0, 5), Direction.Up, at(0, 0), pocket)).toThrow('The gate must be operable');
  });

  test('does not excuse a key that stays out of reach with the gate open', () => {
    const walledOff = ['..DDDW.', '.....W.', '.....W.', 'WWFGFWW', '.......', '.......'];
    expect(() => gated(at(3, 4), Direction.Up, at(6, 0), walledOff)).toThrow('Every key must lie');
  });

  test('needs open ground on both sides of it', () => {
    const blocked = ['..DDD..', '.......', '...W...', 'WWFGFWW', '.......', '.......'];
    expect(() => gated(at(3, 4), Direction.Up, at(0, 0), blocked)).toThrow('The gate needs open ground');
  });

  test('keeps stars off the gate tile and the tile its leaf swings over', () => {
    const { scenery, where } = parse(fenced);
    const definition = {
      id: LevelId.of('test'),
      scenery,
      stones: [],
      keys: [Key.at(at(0, 0), everywhere)],
      door: Door.closedAt(where('D')[0]!),
      hero: { position: at(3, 4), facing: Direction.Up },
      gate: SwingGate.closedAt(where('G')[0]!),
      obstacles: check2dObstacles,
    };
    for (const spot of [at(3, 3), at(3, 2)])
      expect(() => Level.create({ ...definition, stars: [Star.at(spot)] })).toThrow('A star must stay visible');
    const scattered = Level.withScatteredStars(definition, StarCount.of(1), (positions) => {
      expect(positions.some((tile) => tile.equals(at(3, 3)) || tile.equals(at(3, 2)))).toBe(false);
      return positions;
    });
    expect(scattered.stars).toHaveLength(1);
  });
});

describe('a boulder', () => {
  const open = ['.....', '.....', '..O..', '.....', '.....'];

  function bouldered(
    given: readonly string[] = open,
    start = at(2, 3),
    facing = Direction.Up,
    key = at(0, 0),
    stars: readonly TilePosition[] = [],
  ): Level {
    const { scenery, where } = parse(given);
    return Level.create({
      id: LevelId.of('test'),
      scenery,
      stones: where('o').map(Stone.at),
      keys: [Key.at(key, everywhere)],
      door: Door.closedAt(where('D')[0]!),
      hero: { position: start, facing },
      boulders: where('O').map(Boulder.at),
      stars: stars.map(Star.at),
      obstacles: check2dObstacles,
    });
  }

  function slide(subject: Level): void {
    for (let tick = 0; tick < 16; tick++) subject.tick(null);
  }

  function move(subject: Level, direction: Direction): readonly LevelEvent[] {
    subject.grip();
    return [...subject.tick(Heading.of(direction)), ...Array.from({ length: 16 }, () => subject.tick(null)).flat()];
  }

  test('moves nothing while she only grips it', () => {
    const subject = bouldered();
    expect(subject.canGrip).toBe(true);
    subject.grip();
    expect(subject.isGripping).toBe(true);
    expect(subject.canGrip).toBe(false);
    slide(subject);
    expect(subject.boulders).toEqual([Boulder.at(at(2, 2))]);
    expect(subject.hero.position).toEqual(at(2, 3));
  });

  test('slides one tile away from her when she walks into it while gripping, with her following', () => {
    const subject = bouldered();
    subject.grip();
    subject.tick(Heading.of(Direction.Up));
    expect(subject.boulders[0]?.isSliding).toBe(true);
    slide(subject);
    expect(subject.boulders).toEqual([Boulder.at(at(2, 1))]);
    expect(subject.hero.feet).toEqual(Hero.feetOn(at(2, 2)));
    expect(subject.hero.facing).toBe(Direction.Up);
  });

  test('follows her one tile when she walks away from it while gripping', () => {
    const subject = bouldered();
    move(subject, Direction.Down);
    expect(subject.boulders).toEqual([Boulder.at(at(2, 3))]);
    expect(subject.hero.feet).toEqual(Hero.feetOn(at(2, 4)));
    expect(subject.hero.facing).toBe(Direction.Up);
  });

  test('moves sideways with her when she walks sideways while gripping, and she keeps facing it', () => {
    const subject = bouldered();
    move(subject, Direction.Left);
    expect(subject.boulders).toEqual([Boulder.at(at(1, 2))]);
    expect(subject.hero.feet).toEqual(Hero.feetOn(at(1, 3)));
    expect(subject.hero.facing).toBe(Direction.Up);
    move(subject, Direction.Right);
    expect(subject.boulders).toEqual([Boulder.at(at(2, 2))]);
  });

  test('keeps moving one tile at a time while she keeps walking and gripping', () => {
    const subject = bouldered();
    move(subject, Direction.Up);
    move(subject, Direction.Up);
    expect(subject.boulders).toEqual([Boulder.at(at(2, 0))]);
  });

  test('lets her walk freely again once she lets go', () => {
    const subject = bouldered();
    subject.grip();
    subject.release();
    for (let tick = 0; tick < 40; tick++) subject.tick(Heading.of(Direction.Left));
    expect(subject.boulders).toEqual([Boulder.at(at(2, 2))]);
    expect(subject.hero.position).toEqual(at(0, 3));
  });

  test('can be gripped at every moment she presses against it, from every side', () => {
    for (const [start, facing, moved] of [
      [at(2, 0), Direction.Down, at(2, 3)],
      [at(2, 4), Direction.Up, at(2, 1)],
      [at(0, 2), Direction.Right, at(3, 2)],
      [at(4, 2), Direction.Left, at(1, 2)],
    ] as const) {
      const boulder = at(2, 2);
      const subject = bouldered(open, start, facing);
      subject.tick(Heading.of(facing));
      subject.tick(Heading.of(facing));
      const pressing: boolean[] = [];
      for (let tick = 0; tick < 60; tick++) {
        const before = subject.hero.feet;
        subject.tick(Heading.of(facing));
        const progress =
          (subject.hero.feet.x - before.x) * facing.columnStep + (subject.hero.feet.y - before.y) * facing.rowStep;
        const near = [boulder, boulder.neighbor(facing.opposite)].some((tile) => tile.equals(subject.hero.position));
        if (progress < 2 && near) pressing.push(subject.canGrip);
      }
      expect(pressing.length, `she must press against it walking ${facing.name}`).toBeGreaterThan(0);
      expect(pressing.every(Boolean), `walking ${facing.name}, every tick she presses against it`).toBe(true);
      const touching = bouldered(open, start, facing);
      for (let tick = 0; tick < 60 && !touching.canGrip; tick++) touching.tick(Heading.of(facing));
      for (let tick = 0; tick < 3; tick++) touching.tick(Heading.of(facing));
      move(touching, facing);
      expect(touching.boulders, `moved walking ${facing.name}`).toEqual([Boulder.at(moved)]);
    }
  });

  test('cannot be gripped while she walks past it along the open edge of its tile, facing sideways', () => {
    for (const [start, facing] of [
      [at(0, 1), Direction.Right],
      [at(4, 1), Direction.Left],
    ] as const) {
      const subject = bouldered(open, start, facing);
      // Her feet sit low in her tile, so she steps down until they cross into the top strip of the boulder's row.
      for (let tick = 0; tick < 10 && subject.hero.position.row < 2; tick++) subject.tick(Heading.of(Direction.Down));
      expect(subject.hero.position.row).toBe(2);
      const inRow: number[] = [];
      const gripped: string[] = [];
      for (let tick = 0; tick < 60; tick++) {
        subject.tick(Heading.of(facing));
        if (subject.hero.position.equals(at(2, 2))) inRow.push(subject.hero.feet.x);
        if (subject.hero.position.equals(at(2, 2)) && subject.canGrip)
          gripped.push(`${subject.hero.feet.x}, ${subject.hero.feet.y}`);
      }
      expect(inRow.length, `walking ${facing.name}, she must pass through the top strip of its tile`).toBeGreaterThan(
        0,
      );
      expect(gripped, `walking ${facing.name} along its top`).toEqual([]);
    }
  });

  test('cannot be gripped unless she faces it from the next tile', () => {
    expect(bouldered(open, at(2, 3), Direction.Left).canGrip).toBe(false);
    expect(bouldered(open, at(2, 4)).canGrip).toBe(false);
    const subject = bouldered(open, at(2, 4));
    subject.grip();
    expect(subject.isGripping).toBe(false);
  });

  test('stays put when it or she would move into something blocked', () => {
    const stoneAhead = bouldered(['.....', '..o..', '..O..', '.....', '.....']);
    move(stoneAhead, Direction.Up);
    expect(stoneAhead.boulders).toEqual([Boulder.at(at(2, 2))]);
    const stoneBehind = bouldered(['.....', '.....', '..O..', '.....', '..o..']);
    move(stoneBehind, Direction.Down);
    expect(stoneBehind.boulders).toEqual([Boulder.at(at(2, 2))]);
    expect(stoneBehind.hero.position).toEqual(at(2, 3));
    const stoneBeside = bouldered(['.....', '.....', '.oO..', '.....', '.....']);
    move(stoneBeside, Direction.Left);
    expect(stoneBeside.boulders).toEqual([Boulder.at(at(2, 2))]);
  });

  test('rolls over a star, which she collects as she follows it', () => {
    const subject = bouldered(open, at(2, 3), Direction.Up, at(2, 0), [at(2, 1)]);
    const events = [...move(subject, Direction.Up), ...move(subject, Direction.Up)];
    expect(events.some((event) => event instanceof StarCollected)).toBe(true);
  });

  test('lets her collect a key she steps back onto', () => {
    const subject = bouldered(open, at(2, 3), Direction.Up, at(2, 4));
    expect(move(subject, Direction.Down).some((event) => event instanceof KeyCollected)).toBe(true);
  });

  test('blocks her on the tile it moved to', () => {
    const subject = bouldered();
    move(subject, Direction.Up);
    subject.release();
    for (let tick = 0; tick < 40; tick++) subject.tick(Heading.of(Direction.Up));
    expect(subject.hero.position).toEqual(at(2, 2));
  });

  test('lets a key lie behind it, out of reach until it moves', () => {
    const pocket = ['.....', '~~~..', '...O.', '~~~..', '.....'];
    const subject = bouldered(pocket, at(3, 3), Direction.Up, at(0, 2));
    expect(pathTo(subject, (tile) => tile.equals(at(0, 2)))).toBeUndefined();
    move(subject, Direction.Up);
    subject.release();
    expect(pathTo(subject, (tile) => tile.equals(at(0, 2)))).toBeDefined();
  });

  test('needs open ground of its own', () => {
    expect(() => bouldered(open, at(2, 3), Direction.Up, at(2, 2))).toThrow('Every key must lie');
    expect(() => bouldered(open, at(2, 3), Direction.Up, at(0, 0), [at(2, 2)])).toThrow('A star needs a tile');
  });
});

describe('a pressure plate', () => {
  const plated = [
    '..DDD....',
    '.....FFFF',
    '.....F...',
    '.....G.K.',
    '.....F...',
    '..P..F...',
    '..O..FFFF',
    '.........',
  ];

  function pressable(start = at(2, 7), facing = Direction.Up, plate?: TilePosition): Level {
    const { scenery, where } = parse(plated);
    return Level.create({
      id: LevelId.of('test'),
      scenery,
      stones: [],
      keys: [Key.at(where('K')[0]!, everywhere)],
      door: Door.closedAt(where('D')[0]!),
      hero: { position: start, facing },
      gate: SwingGate.closedAt(where('G')[0]!, Direction.Left),
      boulders: where('O').map(Boulder.at),
      plate: plate ?? where('P')[0]!,
      obstacles: check2dObstacles,
    });
  }

  function slide(subject: Level, direction: Direction): readonly LevelEvent[] {
    subject.grip();
    return [...subject.tick(Heading.of(direction)), ...Array.from({ length: 16 }, () => subject.tick(null)).flat()];
  }

  test('keeps the gate shut and tells her so when she tries it', () => {
    const subject = pressable(at(4, 3), Direction.Right);
    expect(subject.canOperateGate).toBe(true);
    expect(subject.operateGate()).toEqual([new SwingGateStuck(LevelId.of('test'), at(5, 3))]);
    expect(subject.gate?.state).toBe('closed');
  });

  test('opens the gate by itself once the boulder rests on it, and lets her reach the key', () => {
    const subject = pressable();
    expect(slide(subject, Direction.Up)).toEqual([
      new PlatePressed(LevelId.of('test'), at(2, 5)),
      new SwingGateOpeningStarted(LevelId.of('test'), at(5, 3)),
    ]);
    subject.finishGate();
    expect(subject.gate?.state).toBe('open');
    expect(subject.canOperateGate).toBe(false);
    expect(pathTo(subject, (tile) => tile.equals(at(7, 3)))).toBeDefined();
  });

  test('closes the gate by itself once the boulder leaves it', () => {
    const subject = pressable();
    slide(subject, Direction.Up);
    subject.finishGate();
    expect(slide(subject, Direction.Down)).toEqual([
      new PlateReleased(LevelId.of('test'), at(2, 5)),
      new SwingGateClosingStarted(LevelId.of('test'), at(5, 3)),
    ]);
    subject.finishGate();
    expect(subject.gate?.state).toBe('closed');
  });

  test('needs a gate to open', () => {
    const { scenery, where } = parse(plated);
    expect(() =>
      Level.create({
        id: LevelId.of('test'),
        scenery,
        stones: [],
        keys: [Key.at(at(0, 7), everywhere)],
        door: Door.closedAt(where('D')[0]!),
        hero: { position: at(2, 7), facing: Direction.Up },
        plate: where('P')[0]!,
        obstacles: check2dObstacles,
      }),
    ).toThrow('needs a gate');
  });

  test('opens the gate while she stands on it and closes it once she walks off', () => {
    const subject = pressable(at(3, 5), Direction.Left);
    expect(
      follow(
        subject,
        pathTo(subject, (tile) => tile.equals(at(2, 5)))!,
      ),
    ).toEqual([
      new PlatePressed(LevelId.of('test'), at(2, 5)),
      new SwingGateOpeningStarted(LevelId.of('test'), at(5, 3)),
    ]);
    subject.finishGate();
    expect(subject.gate?.state).toBe('open');
    expect(
      follow(
        subject,
        pathTo(subject, (tile) => tile.equals(at(3, 5)))!,
      ),
    ).toEqual([
      new PlateReleased(LevelId.of('test'), at(2, 5)),
      new SwingGateClosingStarted(LevelId.of('test'), at(5, 3)),
    ]);
  });

  test('turns a swing back the moment the plate changes, so the gate never finishes opening with the plate empty', () => {
    const subject = pressable(at(3, 5), Direction.Left);
    follow(
      subject,
      pathTo(subject, (tile) => tile.equals(at(2, 5)))!,
    );
    expect(subject.gate?.state).toBe('opening');
    expect(
      follow(
        subject,
        pathTo(subject, (tile) => tile.equals(at(3, 5)))!,
      ),
    ).toEqual([
      new PlateReleased(LevelId.of('test'), at(2, 5)),
      new SwingGateClosingStarted(LevelId.of('test'), at(5, 3)),
    ]);
    expect(subject.gate?.state).toBe('closing');
    expect(
      follow(
        subject,
        pathTo(subject, (tile) => tile.equals(at(2, 5)))!,
      ),
    ).toEqual([
      new PlatePressed(LevelId.of('test'), at(2, 5)),
      new SwingGateOpeningStarted(LevelId.of('test'), at(5, 3)),
    ]);
    expect(subject.gate?.state).toBe('opening');
  });

  test('stays pressed when she pushes the boulder off it and takes its place', () => {
    const subject = pressable();
    slide(subject, Direction.Up);
    subject.finishGate();
    expect(slide(subject, Direction.Up)).toEqual([]);
    expect(subject.hero.position).toEqual(at(2, 5));
    expect(subject.gate?.state).toBe('open');
  });

  test('stands at least two tiles from the gate and from the tile it swings into', () => {
    for (const plate of [at(5, 3), at(4, 3), at(4, 4), at(7, 4)])
      expect(() => pressable(at(2, 7), Direction.Up, plate)).toThrow('pressure plate');
  });
});
