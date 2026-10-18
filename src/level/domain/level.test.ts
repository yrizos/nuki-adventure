import { describe, expect, test } from 'vitest';
import { Boulder } from './boulder';
import { Area, Orb } from './collectibles';
import { Door } from './door';
import { Level, Stone } from './level';
import {
  LevelCompleted,
  type LevelEvent,
  OrbCollected,
  SwingGateClosed,
  SwingGateClosingStarted,
  SwingGateOpened,
  SwingGateOpeningStarted,
  PlatePressed,
  PlateReleased,
} from './level-events';
import { LevelId } from './level-id';
import { Hero } from './hero';
import { Direction, Heading, TilePosition } from './position';
import { Fence, Flower, Ground, LevelSize, Scenery, Tree, TreeVariant } from './scenery';
import { SwingGate } from './swing-gate';
import { check2dObstacles } from '../infrastructure/check2d-obstacles';
import { lowestRoll, seededRandom } from '../testing/draws';
import { follow, pathTo, settleGate } from '../testing/walk-level';

const gateSwingLength = 16;

const at = TilePosition.at;
const orb = (position: TilePosition, radius = 4): Orb => Orb.at(position, radius, LevelSize.of(40, 40));

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

function level(given: readonly string[], start: TilePosition, orbAt: TilePosition): Level {
  const { scenery, where } = parse(given);
  return Level.create({
    id: LevelId.of('test'),
    scenery,
    stones: where('o').map(Stone.at),
    orbs: [orb(orbAt)],
    door: Door.closedAt(where('D')[0]!),
    hero: { position: start, facing: Direction.Right },
    obstacles: check2dObstacles,
  });
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
    const subject = level(['DDD.', line, '.~~~'], at(0, 1), at(0, 2));
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

  test.each([
    ['water', '~~~~~', at(4, 1)],
    ['woodland', 'WWWWW', at(4, 0)],
  ])('slides along %s when pushed diagonally into it', (_, edge, key) => {
    const subject = level(['DDD..', '.....', edge], at(0, 1), key);
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

  test('picks up the last orb once her feet reach its tile, which restores the whole level but leaves the door closed', () => {
    const subject = level(['....', '....', '....'], at(0, 0), at(2, 0));
    let events = subject.tick(toward(Direction.Right));
    for (let frame = 0; frame < 80 && events.length === 0; frame++) events = subject.tick(toward(Direction.Right));
    const whole = Area.whole(subject.scenery.size);
    expect(events).toEqual([new OrbCollected(LevelId.of('test'), at(2, 0), whole, true)]);
    expect([subject.orbs, subject.restored]).toEqual([[], [whole]]);
    expect(subject.door.isOpen).toBe(false);
    expect(subject.isComplete).toBe(false);
    expect(subject.hero.position).toEqual(at(2, 0));
  });

  test('restores the circle of each orb she picks up, and opens the door only once she has picked up every orb', () => {
    const { scenery, where } = parse(
      Array.from({ length: 4 }, (_, row) => (row === 0 ? 'DDD' : '...') + '.'.repeat(13)),
    );
    const near = orb(at(1, 3));
    const far = orb(at(14, 3));
    const subject = Level.create({
      id: LevelId.of('test'),
      scenery,
      stones: [],
      orbs: [near, far],
      door: Door.closedAt(where('D')[0]!),
      hero: { position: at(0, 3), facing: Direction.Right },
      obstacles: check2dObstacles,
    });
    expect(hold(subject, Direction.Right, 16)).toEqual([
      new OrbCollected(LevelId.of('test'), at(1, 3), near.restores, false),
    ]);
    expect([subject.orbs, subject.restored]).toEqual([[far], [near.restores]]);
    expect(() => subject.openDoor()).toThrow('The door opens only once every orb is picked up');
    expect(subject.door.isOpen).toBe(false);
    hold(subject, Direction.Right, 13 * 16);
    expect([subject.orbs, subject.restored]).toEqual([[], [Area.whole(scenery.size)]]);
    expect(subject.door.isOpen).toBe(false);
    subject.openDoor();
    expect(subject.door.isOpen).toBe(true);
  });

  test('is stopped by the door after picking up every orb until the door opens', () => {
    const subject = level(['DDD', '...', '...', '...'], at(0, 3), at(1, 3));
    hold(subject, Direction.Right, 16);
    hold(subject, Direction.Up, 60);
    expect(subject.hero.position).toEqual(at(1, 1));
    expect(subject.isComplete).toBe(false);
  });

  test('completes the level by stepping into the open doorway, after which nothing moves', () => {
    const subject = level(['DDD', '...', '...', '...'], at(1, 3), at(2, 3));
    hold(subject, Direction.Right, 16);
    expect(subject.door.isOpen).toBe(false);
    subject.openDoor();
    expect(subject.door.isOpen).toBe(true);
    const events = hold(subject, Direction.Up, 80);
    expect(events).toEqual([new LevelCompleted(LevelId.of('test'))]);
    expect(subject.isComplete).toBe(true);
    expect(subject.hero.position).toEqual(at(2, 0));
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
    const subject = level(['.Tt....', '....Tt.', 'FFDDDFF', '.......', '.......'], at(0, 4), at(6, 4));
    expect(subject.door.left).toEqual(at(2, 2));
    expect(subject.scenery.trees.map((tree) => tree.base)).toEqual([at(1, 0), at(4, 1)]);
    expect(subject.orbs.map((each) => each.position)).toEqual([at(6, 4)]);
  });

  test('rejects an orb outside the fenced playable area', () => {
    expect(() => level(['.Tt....', '....Tt.', 'FFDDDFF', '.......', '.......'], at(0, 4), at(0, 0))).toThrow(
      new RangeError('Every orb must lie where the hero can reach it'),
    );
  });

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
        orbs: [orb(at(2, 0)), orb(at(2, 0), 5)],
        door: Door.closedAt(where('D')[0]!),
        hero: { position: at(0, 0), facing: Direction.Right },
        obstacles: check2dObstacles,
      }),
    ).toThrow(RangeError);
  });

  test.each([
    [at(13, 1), false],
    [at(14, 1), true],
  ])('with the second orb at %s, accepts two circles only with three faded tiles between them: %s', (second, apart) => {
    const { scenery, where } = parse(['.'.repeat(18), '.'.repeat(18), '.'.repeat(18)]);
    const create = () =>
      Level.create({
        id: LevelId.of('test'),
        scenery,
        stones: [],
        orbs: [orb(at(2, 1)), orb(second)],
        door: Door.closedAt(where('D')[0]!),
        hero: { position: at(0, 2), facing: Direction.Right },
        obstacles: check2dObstacles,
      });
    if (apart) expect(create().orbs).toHaveLength(2);
    else expect(create).toThrow('The circles of two orbs must stay apart');
  });

  test('rejects a hero that starts on a stone', () => {
    expect(() => level(['o..'], at(0, 0), at(2, 0))).toThrow(RangeError);
  });

  test('rejects an orb that cannot be reached', () => {
    expect(() => level(['..~'], at(0, 0), at(2, 0))).toThrow(RangeError);
  });

  test('rejects an orb on open ground that fences cut off from the hero', () => {
    expect(() => level(['..F..', '..F..'], at(0, 0), at(4, 0))).toThrow(RangeError);
  });

  test('rejects an orb on the hero start', () => {
    expect(() => level(['...'], at(0, 0), at(0, 0))).toThrow('An orb needs a tile of its own');
  });

  test('rejects an orb behind woodland', () => {
    expect(() => level(['...', '..W', '...'], at(0, 0), at(2, 0))).toThrow(RangeError);
  });

  test('rejects an orb that woodland cuts off from the hero', () => {
    expect(() => level(['.W..', '.W..'], at(0, 0), at(3, 1))).toThrow(RangeError);
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
});

describe('orbs placed in a level', () => {
  const open = Array.from({ length: 25 }, (_, row) => (row === 0 ? 'DDD' : '...') + '.'.repeat(22));
  const placed = (
    random: () => number,
    permanent: readonly TilePosition[] = [at(20, 20)],
    given = open,
    hero = at(1, 24),
  ): Level => {
    const { scenery, where } = parse(given);
    return Level.withOrbs(
      {
        id: LevelId.of('test'),
        scenery,
        stones: [],
        door: Door.closedAt(where('D')[0]!),
        hero: { position: hero, facing: Direction.Up },
        obstacles: check2dObstacles,
      },
      permanent,
      random,
    );
  };
  const seeds = Array.from({ length: 40 }, (_, seed) => seed);

  test('hold every permanent orb and three to nine orbs in all, with circles of two to four tiles that never touch', () => {
    const violations = seeds.flatMap((seed) => {
      const { orbs, permanentOrbs } = placed(seededRandom(seed));
      return [
        ...(orbs.length < 3 || orbs.length > 9 ? [`seed ${seed}: ${orbs.length} orbs`] : []),
        ...(orbs[0]!.position.equals(at(20, 20)) ? [] : [`seed ${seed}: no permanent orb first`]),
        ...(permanentOrbs.length === 1 && permanentOrbs[0]!.equals(at(20, 20)) ? [] : [`seed ${seed}: lost permanent`]),
        ...orbs.flatMap((each) => (each.radius < 4 || each.radius > 6 ? [`seed ${seed}: radius ${each.radius}`] : [])),
        ...orbs.flatMap((each, index) =>
          orbs.slice(index + 1).some((other) => other.touches(each)) ? [`seed ${seed}: touching circles`] : [],
        ),
      ];
    });
    expect(violations).toEqual([]);
  });

  test('roll other counts and every radius over many plays', () => {
    const plays = Array.from({ length: 300 }, (_, seed) => placed(seededRandom(seed)).orbs);
    expect(new Set(plays.map((orbs) => orbs.length)).size).toBeGreaterThan(1);
    expect(new Set(plays.flat().map((each) => each.radius))).toEqual(new Set([4, 5, 6]));
  });

  test('land on other tiles in other plays', () => {
    const places = (seed: number) =>
      placed(seededRandom(seed)).orbs.map((each) => `${each.position.column},${each.position.row}`);
    expect(places(1)).not.toEqual(places(2));
  });

  // Later orbs go wherever their circles still fit, so only the first random orb shows the preference on its own.
  test('favor tiles far from the shortest walk between the start and the door', () => {
    const first = seeds.map((seed) => placed(seededRandom(seed), []).orbs[0]!);
    expect(first.filter((each) => each.position.column >= 12).length).toBeGreaterThan(seeds.length * 0.75);
  });

  test('shrink a circle that does not fit, so the fewest rolls still give three orbs', () => {
    const { orbs } = placed(lowestRoll);
    expect(orbs.map((each) => each.radius)).toEqual([4, 4, 4]);
  });

  test('place only as many orbs as fit with their circles apart in a small level', () => {
    const cramped = ['.......', '.......', '.......'];
    expect(placed(seededRandom(3), [], cramped, at(0, 2)).orbs).toHaveLength(1);
  });

  test('reject permanent orbs that stand too close for their circles to stay apart', () => {
    expect(() => placed(lowestRoll, [at(10, 10), at(14, 10)])).toThrow('A permanent orb stands too close');
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

  function gated(start = at(3, 4), facing = Direction.Up, orbAt = at(0, 0), given: readonly string[] = fenced): Level {
    const { scenery, where } = parse(given);
    return Level.create({
      id: LevelId.of('test'),
      scenery,
      stones: [],
      orbs: [orb(orbAt)],
      door: Door.closedAt(where('D')[0]!),
      hero: { position: start, facing },
      gates: [SwingGate.closedAt(where('G')[0]!)],
      obstacles: check2dObstacles,
    });
  }

  function opened(subject: Level): Level {
    subject.operateGate();
    settleGate(subject);
    return subject;
  }

  test('holds her still while she swings it by hand', () => {
    const subject = gated();
    subject.operateGate();
    const { feet } = subject.hero;
    for (let tick = 1; tick < gateSwingLength; tick++) subject.tick(Heading.of(Direction.Down));
    expect(subject.hero.feet).toEqual(feet);
    expect(subject.gates[0]?.state).toBe('opening');
    subject.tick(Heading.of(Direction.Down));
    expect(subject.gates[0]?.state).toBe('open');
    for (let tick = 0; tick < 4; tick++) subject.tick(Heading.of(Direction.Down));
    expect(subject.hero.feet).not.toEqual(feet);
  });

  test('lets an orb lie behind it, out of reach until it opens', () => {
    const subject = gated();
    expect(pathTo(subject, (tile) => tile.equals(at(0, 0)))).toBeUndefined();
    expect(pathTo(opened(subject), (tile) => tile.equals(at(0, 0)))).toBeDefined();
  });

  test('lets the hero through both ways once it finishes opening', () => {
    const subject = gated();
    expect(settleGate(subject)).toEqual([]);
    subject.operateGate();
    const before = subject.outlines;
    for (let tick = 1; tick < gateSwingLength; tick++) expect(subject.tick(null)).toEqual([]);
    expect(subject.outlines).toEqual(before);
    expect(subject.tick(null)).toEqual([new SwingGateOpened(LevelId.of('test'), at(3, 3))]);
    expect(subject.outlines).not.toEqual(before);
    expect(settleGate(subject)).toEqual([]);
    follow(
      subject,
      pathTo(subject, (tile) => tile.equals(at(3, 2)))!,
    );
    follow(
      subject,
      pathTo(subject, (tile) => tile.equals(at(3, 5)))!,
    );
    expect(subject.gates[0]?.state).toBe('open');
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
    expect(subject.gates[0]?.state).toBe('closing');
    expect(subject.outlines).not.toEqual(open);
    expect(subject.canOperateGate).toBe(false);
    expect(subject.operateGate()).toEqual([]);
    expect(settleGate(subject)).toEqual([new SwingGateClosed(LevelId.of('test'), at(3, 3))]);
    expect(subject.gates[0]?.state).toBe('closed');
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
    expect(subject.gates[0]?.state).toBe('open');
  });

  test('stays open when the orb is collected and the door opens', () => {
    const subject = opened(gated());
    const events = follow(
      subject,
      pathTo(subject, (tile) => tile.equals(at(0, 0)))!,
    );
    expect(events.some((event) => event instanceof OrbCollected)).toBe(true);
    subject.openDoor();
    expect(subject.gates[0]?.state).toBe('open');
  });

  test('must be operable from where the hero starts', () => {
    const pocket = ['..DDD..', '.......', '.......', 'WWFGFWW', 'WW.....', '.W.....'];
    expect(() => gated(at(0, 5), Direction.Up, at(0, 0), pocket)).toThrow('The gate must be operable');
  });

  test('does not excuse an orb that stays out of reach with the gate open', () => {
    const walledOff = ['..DDDW.', '.....W.', '.....W.', 'WWFGFWW', '.......', '.......'];
    expect(() => gated(at(3, 4), Direction.Up, at(6, 0), walledOff)).toThrow('Every orb must lie');
  });

  test('needs open ground on both sides of it', () => {
    const blocked = ['..DDD..', '.......', '...W...', 'WWFGFWW', '.......', '.......'];
    expect(() => gated(at(3, 4), Direction.Up, at(0, 0), blocked)).toThrow('The gate needs open ground');
  });

  test('keeps orbs off the gate tile and the tile its leaf swings over', () => {
    for (const spot of [at(3, 3), at(3, 2)]) expect(() => gated(at(3, 4), Direction.Up, spot)).toThrow(RangeError);
  });
});

describe('a boulder', () => {
  const open = ['.....', '.....', '..O..', '.....', '.....'];

  function bouldered(
    given: readonly string[] = open,
    start = at(2, 3),
    facing = Direction.Up,
    orbAt = at(0, 0),
  ): Level {
    const { scenery, where } = parse(given);
    return Level.create({
      id: LevelId.of('test'),
      scenery,
      stones: where('o').map(Stone.at),
      orbs: [orb(orbAt)],
      door: Door.closedAt(where('D')[0]!),
      hero: { position: start, facing },
      boulders: where('O').map(Boulder.at),
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

  test('rolls over an orb, which she collects as she follows it', () => {
    const subject = bouldered(open, at(2, 3), Direction.Up, at(2, 1));
    const events = [...move(subject, Direction.Up), ...move(subject, Direction.Up)];
    expect(events.some((event) => event instanceof OrbCollected)).toBe(true);
  });

  test('lets her collect an orb she steps back onto', () => {
    const subject = bouldered(open, at(2, 3), Direction.Up, at(2, 4));
    expect(move(subject, Direction.Down).some((event) => event instanceof OrbCollected)).toBe(true);
  });

  test('blocks her on the tile it moved to', () => {
    const subject = bouldered();
    move(subject, Direction.Up);
    subject.release();
    for (let tick = 0; tick < 40; tick++) subject.tick(Heading.of(Direction.Up));
    expect(subject.hero.position).toEqual(at(2, 2));
  });

  test('lets an orb lie behind it, out of reach until it moves', () => {
    const pocket = ['.....', '~~~..', '...O.', '~~~..', '.....'];
    const subject = bouldered(pocket, at(3, 3), Direction.Up, at(0, 2));
    expect(pathTo(subject, (tile) => tile.equals(at(0, 2)))).toBeUndefined();
    move(subject, Direction.Up);
    subject.release();
    expect(pathTo(subject, (tile) => tile.equals(at(0, 2)))).toBeDefined();
  });

  test('needs open ground of its own', () => {
    expect(() => bouldered(open, at(2, 3), Direction.Up, at(2, 2))).toThrow('An orb needs a tile of its own');
  });
});

describe('two swing gates', () => {
  const enclosed = ['.DDD....', '........', 'FFFFGFF.', 'F.....F.', 'F.....F.', 'FFGFFFF.', '........', '..H.....'];

  function twoGated(
    given: readonly string[] = enclosed,
    start = at(2, 7),
    plate?: TilePosition,
    orbAt = at(5, 4),
  ): Level {
    const { scenery, where } = parse(given);
    return Level.create({
      id: LevelId.of('test'),
      scenery,
      stones: [],
      orbs: [orb(orbAt)],
      door: Door.closedAt(where('D')[0]!),
      hero: { position: start, facing: Direction.Up },
      gates: where('G').map((gate) => SwingGate.closedAt(gate)),
      ...(plate ? { plate } : {}),
      obstacles: check2dObstacles,
    });
  }

  test('swings only the gate she stands beside', () => {
    const subject = twoGated();
    follow(
      subject,
      pathTo(subject, (tile) => tile.equals(at(2, 6)))!,
    );
    expect(subject.operateGate()).toEqual([new SwingGateOpeningStarted(LevelId.of('test'), at(2, 5))]);
    settleGate(subject);
    expect(subject.gates.map((gate) => gate.state)).toEqual(['closed', 'open']);
    follow(
      subject,
      pathTo(subject, (tile) => tile.equals(at(4, 3)))!,
    );
    expect(subject.operateGate()).toEqual([new SwingGateOpeningStarted(LevelId.of('test'), at(4, 2))]);
    settleGate(subject);
    expect(subject.gates.map((gate) => gate.state)).toEqual(['open', 'open']);
  });

  test('rejects a pressure plate, because one plate holds one gate', () => {
    expect(() => twoGated(enclosed, at(2, 7), at(0, 7))).toThrow('needs exactly one gate');
  });

  test('rejects a gate she cannot reach even with the other gate open', () => {
    const sealed = [
      '.DDD.....',
      '.........',
      '.FFFFF...',
      '.F...F...',
      '.FFGFF...',
      '.F...F...',
      '.FFFFF...',
      'FFFFFFGFF',
      '.........',
      '...H.....',
    ];
    expect(() => twoGated(sealed, at(3, 9), undefined, at(0, 0))).toThrow('The gate must be operable');
  });

  test.each([
    ['one swinging into the other', ['.DDD...', '.......', 'FFGFF..', 'FFGFF..', '.......', '..H....']],
    ['one tile beside both', ['.DDD.', '.....', 'FGFGF', '.....', '..H..']],
  ])('rejects two gates with %s', (_, given) => {
    expect(() => twoGated(given, at(2, given.length - 1))).toThrow('Two gates need room of their own');
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
      orbs: [orb(where('K')[0]!)],
      door: Door.closedAt(where('D')[0]!),
      hero: { position: start, facing },
      gates: [SwingGate.closedAt(where('G')[0]!, Direction.Left)],
      boulders: where('O').map(Boulder.at),
      plate: plate ?? where('P')[0]!,
      obstacles: check2dObstacles,
    });
  }

  function slide(subject: Level, direction: Direction): readonly LevelEvent[] {
    subject.grip();
    return [...subject.tick(Heading.of(direction)), ...Array.from({ length: 16 }, () => subject.tick(null)).flat()];
  }

  test('opens the gate by itself once the boulder rests on it, and lets her reach the orb', () => {
    const subject = pressable();
    expect(slide(subject, Direction.Up)).toEqual([
      new PlatePressed(LevelId.of('test'), at(2, 5)),
      new SwingGateOpeningStarted(LevelId.of('test'), at(5, 3)),
      new SwingGateOpened(LevelId.of('test'), at(5, 3)),
    ]);
    expect(subject.gates[0]?.state).toBe('open');
    expect(subject.canOperateGate).toBe(false);
    expect(pathTo(subject, (tile) => tile.equals(at(7, 3)))).toBeDefined();
  });

  test('closes the gate by itself once the boulder leaves it', () => {
    const subject = pressable();
    slide(subject, Direction.Up);
    settleGate(subject);
    expect(slide(subject, Direction.Down)).toEqual([
      new PlateReleased(LevelId.of('test'), at(2, 5)),
      new SwingGateClosingStarted(LevelId.of('test'), at(5, 3)),
    ]);
    settleGate(subject);
    expect(subject.gates[0]?.state).toBe('closed');
  });

  test('needs exactly one gate to open', () => {
    const { scenery, where } = parse(plated);
    expect(() =>
      Level.create({
        id: LevelId.of('test'),
        scenery,
        stones: [],
        orbs: [orb(at(0, 7))],
        door: Door.closedAt(where('D')[0]!),
        hero: { position: at(2, 7), facing: Direction.Up },
        plate: where('P')[0]!,
        obstacles: check2dObstacles,
      }),
    ).toThrow('needs exactly one gate');
  });

  test('turns a swing back the moment the plate changes, so the gate never finishes opening with the plate empty', () => {
    const subject = pressable(at(3, 5), Direction.Left);
    follow(
      subject,
      pathTo(subject, (tile) => tile.equals(at(2, 5)))!,
    );
    expect(subject.gates[0]?.state).toBe('opening');
    expect(
      follow(
        subject,
        pathTo(subject, (tile) => tile.equals(at(3, 5)))!,
      ),
    ).toEqual([
      new PlateReleased(LevelId.of('test'), at(2, 5)),
      new SwingGateClosingStarted(LevelId.of('test'), at(5, 3)),
    ]);
    expect(subject.gates[0]?.state).toBe('closing');
    expect(
      follow(
        subject,
        pathTo(subject, (tile) => tile.equals(at(2, 5)))!,
      ),
    ).toEqual([
      new PlatePressed(LevelId.of('test'), at(2, 5)),
      new SwingGateOpeningStarted(LevelId.of('test'), at(5, 3)),
    ]);
    expect(subject.gates[0]?.state).toBe('opening');
  });

  test('stays pressed when she pushes the boulder off it and takes its place', () => {
    const subject = pressable();
    slide(subject, Direction.Up);
    settleGate(subject);
    expect(slide(subject, Direction.Up)).toEqual([]);
    expect(subject.hero.position).toEqual(at(2, 5));
    expect(subject.gates[0]?.state).toBe('open');
  });

  test('stands at least two tiles from the gate and from the tile it swings into', () => {
    for (const plate of [at(5, 3), at(4, 3), at(4, 4), at(7, 4)])
      expect(() => pressable(at(2, 7), Direction.Up, plate)).toThrow('pressure plate');
  });
});

describe('a snapshot of a level', () => {
  const plated = [
    '..DDD....',
    '.....FFFF',
    '.....F...',
    '.....G.K.',
    '.....F...',
    '..P..F...',
    '..O..FFFF',
    '.........',
    ...Array.from({ length: 16 }, () => '.........'),
  ];
  const near = { position: at(1, 6), radius: 4 };
  const far = { position: at(7, 20), radius: 5 };

  function pressable(orbs: readonly { position: TilePosition; radius: number }[] = [near, far]): Level {
    const { scenery, where } = parse(plated);
    return Level.create({
      id: LevelId.of('test'),
      scenery,
      stones: [],
      orbs: orbs.map(({ position, radius }) => orb(position, radius)),
      door: Door.closedAt(where('D')[0]!),
      hero: { position: at(2, 7), facing: Direction.Up },
      gates: [SwingGate.closedAt(where('G')[0]!, Direction.Left)],
      boulders: where('O').map(Boulder.at),
      plate: where('P')[0]!,
      obstacles: check2dObstacles,
    });
  }

  // She pushes the boulder onto the plate, which opens the gate, and walks left to the near orb.
  function played(): Level {
    const subject = pressable();
    subject.grip();
    hold(subject, Direction.Up, 1);
    hold(subject, null, 16);
    subject.release();
    settleGate(subject);
    hold(subject, Direction.Left, 20);
    hold(subject, null, 1);
    return subject;
  }

  const snapshotOf = (subject: Level) => subject.snapshot!;

  test('holds where she stands, the orbs, the gates and the boulders', () => {
    const subject = played();
    expect(subject.snapshot).toEqual({
      hero: { feet: subject.hero.feet, facing: Direction.Left },
      orbs: [far],
      collectedOrbs: [near],
      gates: ['open'],
      boulders: [at(2, 5)],
    });
  });

  test('resumes a fresh level exactly as it was left, and plays on from there', () => {
    const subject = played();
    const resumed = pressable().resumed(snapshotOf(subject));
    expect(resumed.snapshot).toEqual(subject.snapshot);
    expect([resumed.hero, resumed.isPlateDown, resumed.outlines]).toEqual([
      subject.hero,
      subject.isPlateDown,
      subject.outlines,
    ]);
    expect(hold(resumed, Direction.Left, 20)).toEqual(hold(subject, Direction.Left, 20));
    expect(resumed.hero).toEqual(subject.hero);
  });

  test('keeps the orbs placed where they were, with their circles, not where a new start would put them', () => {
    const resumed = pressable([{ position: at(7, 3), radius: 4 }]).resumed(snapshotOf(played()));
    const { size } = resumed.scenery;
    expect([resumed.orbs, resumed.restored]).toEqual([
      [Orb.at(far.position, far.radius, size)],
      [Orb.at(near.position, near.radius, size).restores],
    ]);
  });

  test('opens the door and restores the whole level once every orb was collected', () => {
    const resumed = pressable().resumed({ ...snapshotOf(played()), orbs: [], collectedOrbs: [near, far] });
    expect([resumed.orbs, resumed.door.isOpen, resumed.restored]).toEqual([
      [],
      true,
      [Area.whole(resumed.scenery.size)],
    ]);
  });

  test('presses the plate under her feet without a sound on the next tick', () => {
    const fresh = pressable();
    const onPlate = {
      ...snapshotOf(fresh),
      hero: { feet: Hero.feetOn(at(2, 5)), facing: Direction.Up },
      gates: ['open' as const],
    };
    const resumed = fresh.resumed(onPlate);
    expect(resumed.isPlateDown).toBe(true);
    expect(resumed.tick(null)).toEqual([]);
  });

  test('is not taken while a boulder slides, while a gate swings or once the level is complete', () => {
    const pushed = pressable();
    pushed.grip();
    hold(pushed, Direction.Up, 1);
    expect(pushed.boulders[0]?.isSliding).toBe(true);
    expect(pushed.snapshot).toBeNull();
    const stepping = pressable().resumed({
      ...snapshotOf(pressable()),
      hero: { feet: Hero.feetOn(at(2, 4)), facing: Direction.Down },
    });
    hold(stepping, Direction.Down, 4);
    expect(stepping.gates[0]?.isSwinging).toBe(true);
    expect(stepping.snapshot).toBeNull();
    settleGate(stepping);
    expect(stepping.snapshot).not.toBeNull();
    const done = pressable().resumed({
      ...snapshotOf(pressable()),
      orbs: [],
      collectedOrbs: [near, far],
      hero: { feet: Hero.feetOn(at(2, 1)), facing: Direction.Up },
    });
    hold(done, Direction.Up, 32);
    expect(done.isComplete).toBe(true);
    expect(done.snapshot).toBeNull();
  });

  test.each([
    ['no orbs', { orbs: [], collectedOrbs: [] }],
    ['the same orb twice', { orbs: [far], collectedOrbs: [far] }],
    ['orbs whose circles touch', { orbs: [{ position: at(3, 12), radius: 4 }] }],
    ['an orb circle too wide', { orbs: [{ ...far, radius: 7 }] }],
    ['another number of gates', { gates: [] }],
    ['another number of boulders', { boulders: [] }],
    ['a boulder in the fence', { boulders: [at(5, 4)] }],
    ['a boulder on the gate', { boulders: [at(5, 3)] }],
    ['a boulder over her feet', { boulders: [at(1, 6)] }],
    ['an orb she cannot reach', { orbs: [{ position: at(8, 0), radius: 4 }] }],
    ['an orb under her feet', { orbs: [near], collectedOrbs: [far] }],
    ['a hero in the fence', { hero: { feet: Hero.feetOn(at(5, 5)), facing: Direction.Up } }],
    [
      'a hero on the closed gate',
      { gates: ['closed' as const], boulders: [at(2, 6)], hero: { feet: Hero.feetOn(at(5, 3)), facing: Direction.Up } },
    ],
    ['a hero facing a diagonal', { hero: { feet: Hero.feetOn(at(1, 7)), facing: Direction.UpLeft } }],
    ['a gate open with nothing on the plate', { boulders: [at(2, 6)] }],
    ['a gate closed with the boulder on the plate', { gates: ['closed' as const] }],
  ])('refuses %s', (_, change) => {
    const snapshot = { ...snapshotOf(played()), ...change };
    expect(() => pressable().resumed(snapshot)).toThrow(RangeError);
  });

  test('resumes her pressed against a boulder from above, where her feet stand inside its tile', () => {
    const stepping = pressable().resumed({
      ...snapshotOf(pressable()),
      hero: { feet: Hero.feetOn(at(2, 4)), facing: Direction.Down },
    });
    hold(stepping, Direction.Down, 40);
    settleGate(stepping);
    expect(stepping.hero.position).toEqual(at(2, 6));
    expect(pressable().resumed(snapshotOf(stepping)).snapshot).toEqual(stepping.snapshot);
  });

  test('every calm frame of a play through pushes, the plate and the gate resumes exactly as it was', () => {
    const subject = pressable();
    const script: readonly [Direction | null, number, boolean][] = [
      [Direction.Up, 1, true],
      [null, 16, true],
      [null, 16, false],
      [Direction.Left, 20, false],
      [Direction.Up, 40, false],
      [Direction.Right, 20, false],
      [Direction.Down, 40, false],
      [Direction.Up, 10, false],
      [Direction.Down, 10, true],
      [null, 40, false],
      [Direction.Right, 40, false],
      [Direction.Up, 60, false],
    ];
    const violations: string[] = [];
    let frame = 0;
    for (const [direction, frames, gripping] of script) {
      for (let step = 0; step < frames; step++, frame++) {
        if (gripping) subject.grip();
        else subject.release();
        subject.tick(toward(direction));
        const snapshot = subject.snapshot;
        if (!snapshot) continue;
        try {
          const resumed = pressable().resumed(snapshot);
          if (JSON.stringify(resumed.snapshot) !== JSON.stringify(snapshot)) violations.push(`frame ${frame}: changed`);
        } catch (error) {
          violations.push(`frame ${frame}: ${(error as Error).message}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
