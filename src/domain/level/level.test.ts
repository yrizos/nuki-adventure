import { describe, expect, test } from 'vitest';
import { Hero, Step } from './hero';
import { Level, LevelId, Orb, OrbColor, Stone } from './level';
import { Direction, TilePosition } from './position';
import { Flower, Ground, LevelSize, Scenery, Tree } from './scenery';

const at = TilePosition.at;

function level(layout: readonly string[], start: TilePosition, orb: TilePosition): Level {
  const size = LevelSize.of(layout[0]!.length, layout.length);
  const ground = layout.map((line) => [...line].map((symbol) => (symbol === '~' ? Ground.Water : Ground.Grass)));
  const cells = layout.flatMap((line, row) => [...line].map((symbol, column) => ({ symbol, position: at(column, row) })));
  const where = (symbol: string): TilePosition[] => cells.filter((cell) => cell.symbol === symbol).map((cell) => cell.position);
  return new Level(
    LevelId.of('test'),
    Scenery.of(size, ground, where('T').map(Tree.at), where('*').map(Flower.at)),
    where('o').map(Stone.at),
    Orb.at(orb, OrbColor.Violet),
    new Hero(start, Direction.Right),
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

  test('completes the level by picking up the orb, which stops her there', () => {
    const subject = level(['....'], at(0, 0), at(2, 0));
    const events = Array.from({ length: 80 }, () => subject.tick(Direction.Right)).flat();
    expect(events).toHaveLength(1);
    expect(events[0]?.restorationOrigin).toEqual(at(2, 0));
    expect(events[0]?.collectedOrbColor).toBe(OrbColor.Violet);
    expect(subject.isComplete).toBe(true);
    expect(subject.orb).toBeNull();
    expect(subject.hero.position).toEqual(at(2, 0));
    expect(subject.hero.step).toBeNull();
  });
});

describe('a level', () => {
  test.each([OrbColor.Red, OrbColor.Blue, OrbColor.Violet, OrbColor.Teal])('preserves collected %s orb color in its completion event', (color) => {
    const ground = [[Ground.Grass, Ground.Grass, Ground.Grass]];
    const subject = new Level(LevelId.of('color'), Scenery.of(LevelSize.of(3, 1), ground, [], []), [],
      Orb.at(at(1, 0), color), new Hero(at(0, 0), Direction.Right));
    const events = Array.from({ length: 17 }, () => subject.tick(Direction.Right)).flat();
    expect(events[0]?.collectedOrbColor).toBe(color);
    expect(subject.orb).toBeNull();
  });

  test('rejects a hero that starts on a stone', () => {
    expect(() => level(['o..'], at(0, 0), at(2, 0))).toThrow(RangeError);
  });

  test('rejects an orb that cannot be reached', () => {
    expect(() => level(['..~'], at(0, 0), at(2, 0))).toThrow(RangeError);
  });

  test('rejects trees standing in water', () => {
    expect(() => level(['.T~'], at(0, 0), at(0, 0))).toThrow(RangeError);
  });
});
