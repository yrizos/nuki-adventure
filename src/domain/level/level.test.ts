import { describe, expect, test } from 'vitest';
import { Area, Orb, OrbColor, Star } from './collectibles';
import { StarCount } from '../shared/star-count';
import { Door } from './door';
import { Level, Stone } from './level';
import {
  LevelCompleted,
  type LevelEvent,
  OrbCollected,
  SignpostLeft,
  SignpostRead,
  StarCollected,
} from './level-events';
import { LevelId } from '../shared/level-id';
import { Direction, Heading, TilePosition } from './position';
import { Fence, Flower, Ground, LevelSize, Scenery, Tree, TreeVariant } from './scenery';
import { check2dObstacles } from '../../infrastructure/check2d-obstacles';
import { Signpost, SignpostText } from './signpost';

const at = TilePosition.at;
const area = (keep: (position: TilePosition) => boolean): Area =>
  Area.of(Array.from({ length: 1600 }, (_, index) => TilePosition.at(index % 40, Math.floor(index / 40))).filter(keep));
const everywhere = area(() => true);
const leftHalf = area((position) => position.column < 2);
const rightHalf = area((position) => position.column >= 2);
const hint = SignpostText.of('ΔΙΑΒΑΣΕ ΜΕ');
const signpostAt = (position: TilePosition): Signpost => Signpost.at(position, hint);

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
    ),
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
    obstacles: check2dObstacles,
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
      obstacles: check2dObstacles,
      signposts: where('P').map(signpostAt),
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
    ['a signpost', '.P..', 45, 45],
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

  test('picks up the orb once her feet reach its tile, leaving the door closed', () => {
    const subject = level(['....', '....', '....'], at(0, 0), at(2, 0));
    let events = subject.tick(toward(Direction.Right));
    for (let frame = 0; frame < 80 && events.length === 0; frame++) events = subject.tick(toward(Direction.Right));
    expect(events).toEqual([new OrbCollected(LevelId.of('test'), at(2, 0), OrbColor.Violet, everywhere)]);
    expect(subject.orbs).toEqual([]);
    expect(subject.door.isOpen).toBe(false);
    expect(subject.isComplete).toBe(false);
    expect(subject.hero.position).toEqual(at(2, 0));
  });

  test('opens the door only once she has picked up every orb', () => {
    const { scenery, where } = parse(['DDD', '...', '...', '...']);
    const subject = Level.create({
      id: LevelId.of('test'),
      scenery,
      stones: [],
      orbs: [Orb.at(at(1, 3), OrbColor.Red, leftHalf), Orb.at(at(2, 3), OrbColor.Blue, rightHalf)],
      door: Door.closedAt(where('D')[0]!),
      hero: { position: at(0, 3), facing: Direction.Right },
      obstacles: check2dObstacles,
    });
    hold(subject, Direction.Right, 16);
    expect(subject.orbs).toEqual([Orb.at(at(2, 3), OrbColor.Blue, rightHalf)]);
    expect(() => subject.openDoor()).toThrow('The door opens only once every orb is picked up');
    expect(subject.door.isOpen).toBe(false);
    hold(subject, Direction.Right, 16);
    expect(subject.orbs).toEqual([]);
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

  test('is stopped by the door after picking up every orb until the door opens', () => {
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

describe('the hero beside a signpost', () => {
  test.each([at(1, 0), at(0, 1), at(2, 1), at(1, 2)])('reads it from %j', (start) => {
    const subject = level(['...', '.P.', '...'], start, at(0, 0).equals(start) ? at(2, 2) : at(0, 0));
    expect(subject.read()).toEqual([new SignpostRead(LevelId.of('test'), at(1, 1), hint)]);
  });

  test('reads it while her feet stand on its tile beside the post', () => {
    const subject = level(['.P..', '....'], at(0, 0), at(3, 1));
    hold(subject, Direction.Right, 40);
    hold(subject, null, 1);
    expect(subject.hero.position).toEqual(at(1, 0));
    expect(subject.read()).toEqual([new SignpostRead(LevelId.of('test'), at(1, 0), hint)]);
  });

  test('reads the words of whichever signpost she stands beside', () => {
    const { scenery, where } = parse(['DDD.', 'P..P', '....']);
    const left = SignpostText.of('ΑΡΙΣΤΕΡΑ');
    const right = SignpostText.of('ΔΕΞΙΑ');
    const subject = Level.create({
      id: LevelId.of('test'),
      scenery,
      stones: [],
      orbs: [Orb.at(at(3, 2), OrbColor.Violet, everywhere)],
      door: Door.closedAt(where('D')[0]!),
      hero: { position: at(1, 1), facing: Direction.Right },
      obstacles: check2dObstacles,
      stars: [],
      signposts: [Signpost.at(at(0, 1), left), Signpost.at(at(3, 1), right)],
    });
    expect(subject.read()).toEqual([new SignpostRead(LevelId.of('test'), at(0, 1), left)]);
    hold(subject, Direction.Right, 16);
    hold(subject, null, 1);
    expect(subject.read()).toEqual([new SignpostRead(LevelId.of('test'), at(3, 1), right)]);
  });

  test('reads nothing from a diagonal tile', () => {
    const subject = level(['....', '.P..', '....'], at(0, 0), at(3, 2));
    expect(subject.read()).toEqual([]);
  });

  test('reads nothing while walking', () => {
    const subject = level(['....', '.P..', '....'], at(1, 0), at(3, 2));
    hold(subject, Direction.Right, 3);
    expect(subject.read()).toEqual([]);
  });

  test('keeps reading while she turns in place and stops once she walks off the reading tiles', () => {
    const subject = level(['....', '.P..', '....'], at(1, 0), at(3, 2));
    subject.read();
    expect(hold(subject, Direction.Left, 2)).toEqual([]);
    expect(subject.hero.facing).toBe(Direction.Left);
    expect(hold(subject, Direction.Left, 40)).toEqual([new SignpostLeft(LevelId.of('test'))]);
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
    expect(subject.orbs.map((orb) => orb.position)).toEqual([at(6, 4)]);
    expect(subject.stars.map((star) => star.position)).toEqual([at(3, 4)]);
  });

  test('rejects an orb outside the fenced playable area', () => {
    expect(() => level(['.Tt....', '....Tt.', 'FFDDDFF', '.......', '...S...'], at(0, 4), at(0, 0))).toThrow(
      new RangeError('Every orb must lie where the hero can reach it'),
    );
  });

  test('rejects a signpost in water', () => {
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
        orbs: [Orb.at(at(1, 2), OrbColor.Violet, everywhere)],
        door: Door.closedAt(at(0, 0)),
        hero: { position: at(0, 2), facing: Direction.Right },
        obstacles: check2dObstacles,
        stars: [],
        signposts: [signpostAt(at(2, 1))],
      }),
    ).toThrow('A signpost needs open ground of its own, at 2, 1');
  });

  test.each([OrbColor.Red, OrbColor.Blue, OrbColor.Violet, OrbColor.Teal])(
    'preserves collected %s orb color in its collection event',
    (color) => {
      const ground = Array.from({ length: 4 }, () => [Ground.Grass, Ground.Grass, Ground.Grass]);
      const subject = Level.create({
        id: LevelId.of('color'),
        scenery: Scenery.of(LevelSize.of(3, 4), ground, [], []),
        stones: [],
        orbs: [Orb.at(at(1, 3), color, everywhere)],
        door: Door.closedAt(at(0, 0)),
        hero: { position: at(0, 3), facing: Direction.Right },
        obstacles: check2dObstacles,
      });
      const events = Array.from({ length: 17 }, () => subject.tick(Heading.of(Direction.Right))).flat();
      expect(events).toEqual([new OrbCollected(LevelId.of('color'), at(1, 3), color, everywhere)]);
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
        obstacles: check2dObstacles,
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
        obstacles: check2dObstacles,
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
        obstacles: check2dObstacles,
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
        orbs: [Orb.at(at(1, 2), OrbColor.Violet, everywhere)],
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

  test('rejects a star on the orb', () => {
    expect(() => level(['S..'], at(1, 0), at(0, 0))).toThrow(RangeError);
  });

  test('rejects a star on the hero start', () => {
    expect(() => level(['S..'], at(0, 0), at(2, 0))).toThrow(RangeError);
  });

  test('rejects an orb behind a tree', () => {
    expect(() => level(['...', '.Tt'], at(0, 0), at(2, 0))).toThrow(RangeError);
  });

  test('rejects a door that fences cut off from the hero', () => {
    expect(() => level(['DDD', 'FFF', '...'], at(0, 2), at(2, 2))).toThrow(
      'The door must open beside a tile the hero can reach',
    );
  });

  test('rejects an orb on the closed door', () => {
    expect(() => level(['DDD', '...'], at(0, 1), at(1, 0))).toThrow('Every orb must lie where the hero can reach it');
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
  const orb = at(5, 3);
  const free = Array.from({ length: 24 }, (_, index) => at(index % 6, Math.floor(index / 6))).filter(
    (tile) => !tile.equals(hero) && !tile.equals(orb),
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
        orbs: [Orb.at(orb, OrbColor.Violet, everywhere)],
        door: Door.closedAt(where('D')[0]!),
        hero: { position: hero, facing: Direction.Right },
        obstacles: check2dObstacles,
        signposts: [],
      },
      spots,
      shuffle,
    );
  };

  test.each([14, 16])('rejects %s spots', (count) => {
    expect(() => among(free.slice(0, count))).toThrow(RangeError);
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
