import { describe, expect, test, vi } from 'vitest';
import type { LevelView } from '../application/level-view';
import { PlayLevel } from '../application/play-level';
import { Area, Orb, OrbColor, Star } from '../domain/level/collectibles';
import { Door } from '../domain/level/door';
import { Level } from '../domain/level/level';
import { Playthrough, PlayTime } from '../domain/progress/playthrough';
import { LevelId } from '../domain/shared/level-id';
import { StarCount } from '../domain/shared/star-count';
import { Direction, Heading, TilePosition } from '../domain/level/position';
import { Ground, LevelSize, Scenery } from '../domain/level/scenery';
import { Signpost, SignpostText } from '../domain/level/signpost';
import { check2dObstacles } from '../infrastructure/check2d-obstacles';
import { InMemoryLevelRepository } from '../infrastructure/in-memory-level-repository';
import { pixelDifference } from '../test-support/pictures';
import { GameLoop } from './game-loop';
import { GameSession, messages } from './game-session';
import { HeroAnimator } from './hero-animator';
import { MessageBox } from './message-box';
import { neutralCode, palette } from './palette';
import { lighten, Picture } from './picture';
import { cameraPosition, heroPixels } from './world-geometry';
import { WorldPainter } from './world-painter';
import { closingLength, doorOpeningLength, restorationLength } from './world-transition';

const area = (keep: (position: TilePosition) => boolean): Area =>
  Area.of(Array.from({ length: 1600 }, (_, index) => TilePosition.at(index % 40, Math.floor(index / 40))).filter(keep));
const everywhere = area(() => true);
const leftHalf = area((position) => position.column < 2);
const rightHalf = area((position) => position.column >= 2);

const hint = 'ΒΡΕΣ ΤΗ ΣΦΑΙΡΑ!';

function gameSession(
  orbs: readonly Orb[] = [Orb.at(TilePosition.at(1, 0), OrbColor.Violet, everywhere)],
  stars: readonly Star[] = [Star.at(TilePosition.at(3, 5))],
  size: LevelSize = LevelSize.of(5, 6),
) {
  const levelId = LevelId.of('session');
  const pressed = new Set<'a' | 'b'>();
  const controls = {
    takePress: vi.fn((button: 'a' | 'b') => pressed.delete(button)),
    heading: vi.fn<() => Heading | null>(() => null),
  };
  const sound = { star: vi.fn(), orb: vi.fn(), door: vi.fn(), footstep: vi.fn(), restoring: vi.fn() };
  const levelEnd = { show: vi.fn(), hide: vi.fn() };
  const progress = { reach: vi.fn<(level: LevelId) => void>(), complete: vi.fn() };
  let play: PlayLevel;
  const createPlay = vi.fn(() => {
    const scenery = Scenery.of(
      size,
      Array.from({ length: size.rows }, () => Array<Ground>(size.columns).fill(Ground.Path)),
      [],
      [],
      [],
    );
    const level = Level.create({
      id: levelId,
      scenery,
      stones: [],
      orbs: orbs.map((orb) => Orb.at(TilePosition.at(orb.position.column, 5), orb.color, orb.restores)),
      door: Door.closedAt(TilePosition.at(1, 0)),
      hero: { position: TilePosition.at(0, 5), facing: Direction.Right },
      obstacles: check2dObstacles,
      stars,
      signposts: [Signpost.at(TilePosition.at(0, 4), SignpostText.of(hint))],
    });
    play = new PlayLevel(new InMemoryLevelRepository([level]));
    return play;
  });
  const session = new GameSession([{ id: levelId, start: createPlay }], controls, sound, levelEnd, progress, levelId);
  const normalAnimator = new HeroAnimator();
  let frames = 0;
  const tick = (): void => {
    session.tick();
    normalAnimator.advance(session.level.hero);
    frames++;
  };
  const advance = (count: number): void => {
    for (let frame = 0; frame < count; frame++) tick();
  };
  // Walking one tile's width from a tile's middle ends in the middle of the next tile.
  const move = (direction: Direction): void => {
    const start = play.view(levelId).hero.feet;
    const travelled = (): number => {
      const { feet } = play.view(levelId).hero;
      return Math.hypot(feet.x - start.x, feet.y - start.y);
    };
    controls.heading.mockReturnValue(Heading.of(direction));
    for (let frame = 0; frame < 40 && travelled() < 32 && !play.view(levelId).isComplete; frame++) tick();
    controls.heading.mockReturnValue(null);
  };
  const walkUntil = (direction: Direction, done: () => boolean): void => {
    controls.heading.mockReturnValue(Heading.of(direction));
    for (let frame = 0; frame < 80 && !done(); frame++) tick();
    expect(done()).toBe(true);
    controls.heading.mockReturnValue(null);
  };
  return {
    session,
    controls,
    sound,
    levelEnd,
    progress,
    normalAnimator,
    createPlay,
    tick,
    advance,
    move,
    walkUntil,
    press(button: 'a' | 'b'): void {
      pressed.add(button);
      tick();
    },
    get level(): LevelView {
      return play.view(levelId);
    },
    get frames(): number {
      return frames;
    },
  };
}

describe('the game session', () => {
  test.each(['a', 'b'] as const)('keeps a signpost message until button %s dismisses it', (button) => {
    const subject = gameSession();
    subject.press(button);
    expect(subject.session.messageText).toBe(hint);
    subject.advance(600);
    expect(subject.session.messageText).toBe(hint);
    subject.press(button);
    expect(subject.session.messageText).toBe('');
    subject.press(button);
    expect(subject.session.messageText).toBe(hint);
  });

  test('dismisses the signpost message when walking away', () => {
    const subject = gameSession();
    subject.press('a');
    subject.controls.heading.mockReturnValue(Heading.of(Direction.Right));
    for (let frame = 0; frame < 40 && subject.session.messageText === hint; frame++) subject.tick();
    expect(subject.session.messageText).not.toBe(hint);
    expect(subject.level.hero.isWalking).toBe(true);
  });

  test('starts the restoration sound on the orb pickup tick', () => {
    const subject = gameSession();
    subject.walkUntil(Direction.Right, () => subject.level.orbs.length === 0);
    expect(subject.sound.orb).toHaveBeenCalledOnce();
    expect(subject.sound.restoring).toHaveBeenCalledOnce();
  });

  test('starts painting restored world colors on the orb pickup tick', () => {
    const subject = gameSession();
    const orb = subject.level.orbs[0]!;
    subject.walkUntil(Direction.Right, () => subject.level.orbs.length === 0);
    const actual = new Picture(224, 448);
    const expected = new Picture(224, 448);
    const faded = new Picture(224, 448);
    const scene = {
      level: subject.session.level,
      frame: subject.frames,
      hero: subject.normalAnimator.pose(subject.session.level.hero, subject.frames, false),
      heldOrb: null,
    };
    const painter = new WorldPainter(scene.level);
    painter.paintRestoring(expected, scene, orb.position, 1, [], [orb.restores]);
    painter.paint(faded, scene, []);
    subject.session.paint(actual);
    const camera = cameraPosition(scene.level, actual.width, actual.height);
    const offset =
      ((orb.position.row * 32 + 16 - camera.y) * actual.width + orb.position.column * 32 + 20 - camera.x) * 4;
    const pixel = (picture: Picture) => [...picture.pixels.subarray(offset, offset + 4)];
    expect(pixel(expected)).not.toEqual(pixel(faded));
    expect(pixel(actual)).toEqual(pixel(expected));
  });

  test('walks through orb pickup and restoration just as through a star pickup', () => {
    const subject = gameSession();
    const starPickup = gameSession(
      [Orb.at(TilePosition.at(4, 0), OrbColor.Violet, everywhere)],
      [Star.at(TilePosition.at(1, 5))],
    );
    subject.controls.heading.mockReturnValue(Heading.of(Direction.Right));
    starPickup.controls.heading.mockReturnValue(Heading.of(Direction.Right));
    for (let frame = 0; frame < 40 && subject.level.orbs.length > 0; frame++) {
      subject.tick();
      starPickup.tick();
      expect(subject.session.level.hero.feet).toEqual(starPickup.session.level.hero.feet);
      expect(subject.session.level.hero.isWalking).toBe(true);
    }
    expect(subject.session.level.orbs).toHaveLength(0);
    expect(starPickup.session.level.stars).toHaveLength(0);
    for (let frame = 0; frame < 40; frame++) {
      subject.tick();
      starPickup.tick();
      expect(subject.session.level.hero.feet).toEqual(starPickup.session.level.hero.feet);
      expect(subject.session.level.hero.isWalking).toBe(true);
    }
  });

  test.each([1, 2])(
    'congratulates an orb pickup with %s orbs in the level without claiming the door is open',
    (count) => {
      const subject = gameSession([
        Orb.at(TilePosition.at(1, 0), OrbColor.Red, count === 1 ? everywhere : leftHalf),
        ...Array.from({ length: count - 1 }, () => Orb.at(TilePosition.at(2, 0), OrbColor.Blue, rightHalf)),
      ]);
      subject.walkUntil(Direction.Right, () => subject.level.orbs.length < count);
      expect(subject.session.messageText).toContain('ΜΠΡΑΒΟ!');
      expect(subject.session.messageText).not.toContain('Η ΠΟΡΤΑ');
      expect(subject.session.level.door.isOpen).toBe(false);
    },
  );

  test('keeps walking and collecting stars while colors spread', () => {
    const subject = gameSession();
    subject.move(Direction.Right);
    expect(subject.sound.orb).toHaveBeenCalledOnce();
    expect(subject.session.messageText).toBe(messages.colorsBack);
    subject.move(Direction.Right);
    subject.move(Direction.Right);
    expect(subject.level.hero.position).toEqual(TilePosition.at(3, 5));
    expect(subject.sound.star).toHaveBeenCalledOnce();
    expect(subject.sound.restoring).toHaveBeenCalledOnce();
    expect(subject.sound.footstep).toHaveBeenCalledTimes(3);
  });

  test('distinguishes ordinary star pickups from the final star', () => {
    const subject = gameSession(undefined, [Star.at(TilePosition.at(2, 5)), Star.at(TilePosition.at(3, 5))]);
    subject.move(Direction.Right);
    subject.move(Direction.Right);
    expect(subject.level.stars).toHaveLength(1);
    subject.move(Direction.Right);
    expect(subject.level.stars).toHaveLength(0);
    expect(subject.sound.star.mock.calls).toEqual([[false], [true]]);
  });

  test('sounds the sole star as final only once across later ticks and revisits', () => {
    const subject = gameSession();
    for (let tile = 0; tile < 3; tile++) subject.move(Direction.Right);
    expect(subject.level.stars).toHaveLength(0);
    subject.advance(60);
    subject.move(Direction.Left);
    subject.move(Direction.Right);
    expect(subject.sound.star).toHaveBeenCalledExactlyOnceWith(true);
  });

  test('tells her to find the other orb until she has both', () => {
    const subject = gameSession([
      Orb.at(TilePosition.at(1, 0), OrbColor.Red, leftHalf),
      Orb.at(TilePosition.at(2, 0), OrbColor.Blue, rightHalf),
    ]);
    subject.move(Direction.Right);
    expect(subject.session.messageText).toBe(messages.someColorsBack);
    expect(subject.level.door.isOpen).toBe(false);
    subject.move(Direction.Right);
    expect(subject.session.messageText).toBe(messages.colorsBack);
    expect(subject.level.door.isOpen).toBe(false);
    expect(subject.sound.orb).toHaveBeenCalledTimes(2);
  });

  test('opens the door only once color has drawn it open from the last orb, however long ago the first was taken', () => {
    const subject = gameSession([
      Orb.at(TilePosition.at(1, 0), OrbColor.Red, leftHalf),
      Orb.at(TilePosition.at(2, 0), OrbColor.Blue, rightHalf),
    ]);
    const { door, scenery } = subject.level;
    const [first, second] = subject.level.orbs;
    subject.walkUntil(Direction.Right, () => subject.level.orbs.length === 1);
    subject.advance(restorationLength(scenery.size, first!.position));
    expect(subject.level.door.isOpen).toBe(false);
    subject.walkUntil(Direction.Right, () => subject.level.orbs.length === 0);
    subject.advance(doorOpeningLength(door, scenery.size, second!.position) - 1);
    expect(subject.level.door.isOpen).toBe(false);
    subject.advance(1);
    expect(subject.level.door.isOpen).toBe(true);
  });

  test('keeps the door shut until the spreading color has drawn all of it open', () => {
    const subject = gameSession();
    const opening = doorOpeningLength(subject.level.door, subject.level.scenery.size, subject.level.orbs[0]!.position);
    subject.walkUntil(Direction.Right, () => subject.sound.orb.mock.calls.length > 0);
    expect(subject.sound.restoring).toHaveBeenCalledOnce();
    subject.advance(opening - 1);
    expect(subject.level.door.isOpen).toBe(false);
    subject.advance(1);
    expect(subject.level.door.isOpen).toBe(true);
  });

  test('keeps the restoration message until movement resumes', () => {
    const subject = gameSession();
    subject.move(Direction.Right);
    subject.advance(600);
    expect(subject.session.messageText).toBe(messages.colorsBack);
    subject.move(Direction.Right);
    expect(subject.session.messageText).toBe('');
  });

  test('does not restart a level before it ends', () => {
    const subject = gameSession();
    subject.session.continuePlaying();
    expect(subject.createPlay).toHaveBeenCalledOnce();
    expect(subject.levelEnd.hide).not.toHaveBeenCalled();
  });

  test.each(['level-end button', 'a', 'b'] as const)(
    'shows completion after the closing transition and continues with %s',
    (button) => {
      const subject = gameSession();
      const continuePlaying = (): void => {
        if (button === 'level-end button') subject.session.continuePlaying();
        else subject.press(button);
      };
      continuePlaying();
      expect(subject.createPlay).toHaveBeenCalledOnce();
      expect(subject.levelEnd.hide).not.toHaveBeenCalled();
      for (let tile = 0; tile < 3; tile++) subject.move(Direction.Right);
      for (let tile = 0; tile < 5; tile++) subject.move(Direction.Up);
      const completedAt = subject.frames;
      expect(subject.sound.door).toHaveBeenCalledOnce();
      expect(subject.levelEnd.show).not.toHaveBeenCalled();
      continuePlaying();
      expect(subject.createPlay).toHaveBeenCalledOnce();
      expect(subject.levelEnd.hide).not.toHaveBeenCalled();
      subject.advance(closingLength - 1 - (button === 'level-end button' ? 0 : 1));
      expect(subject.levelEnd.show).not.toHaveBeenCalled();
      subject.advance(1);
      const playthrough = Playthrough.of(PlayTime.ofFrames(completedAt - 1), StarCount.of(1), StarCount.of(1));
      expect(subject.levelEnd.show).toHaveBeenCalledExactlyOnceWith(playthrough);
      expect(subject.progress.complete).toHaveBeenCalledExactlyOnceWith(subject.level.id, playthrough);
      const picture = new Picture(224, 224);
      subject.session.paint(picture);
      expect(new Set(picture.pixels.filter((_, index) => index % 4 === 3))).toEqual(new Set([255]));
      continuePlaying();
      expect(subject.levelEnd.hide).toHaveBeenCalledOnce();
      expect(subject.createPlay).toHaveBeenCalledTimes(2);
      expect(subject.level.hero.position).toEqual(TilePosition.at(0, 5));
      expect(subject.session.messageText).toBe('');
      expect(subject.level.orbs).toHaveLength(1);
      expect(subject.level.stars).toHaveLength(1);
      expect(subject.level.door.isOpen).toBe(false);
      expect(subject.level.isComplete).toBe(false);
      const freshAnimator = new HeroAnimator();
      for (const walking of [false, true]) {
        if (walking) {
          subject.controls.heading.mockReturnValue(Heading.of(Direction.Right));
          subject.tick();
          freshAnimator.advance(subject.session.level.hero);
        }
        const actual = new Picture(224, 224);
        const expected = new Picture(224, 224);
        const level = subject.session.level;
        new WorldPainter(level).paint(
          expected,
          { level, frame: subject.frames, hero: freshAnimator.pose(level.hero, subject.frames, false), heldOrb: null },
          [],
        );
        subject.session.paint(actual);
        expect(pixelDifference(actual, expected)).toBeUndefined();
      }
      subject.controls.heading.mockReturnValue(null);
      continuePlaying();
      expect(subject.levelEnd.hide).toHaveBeenCalledOnce();
      expect(subject.createPlay).toHaveBeenCalledTimes(2);
      expect(subject.progress.complete).toHaveBeenCalledOnce();
    },
  );
});

describe('the level sequence', () => {
  function sequence(first = 'one') {
    const pressed = new Set<'a' | 'b'>();
    let heading: Heading | null = null;
    const controls = { takePress: (button: 'a' | 'b') => pressed.delete(button), heading: () => heading };
    const sound = { star: vi.fn(), orb: vi.fn(), door: vi.fn(), footstep: vi.fn(), restoring: vi.fn() };
    const levelEnd = { show: vi.fn(), hide: vi.fn() };
    const progress = { reach: vi.fn<(level: LevelId) => void>(), complete: vi.fn() };
    const started: string[] = [];
    const plays: { id: LevelId; play: PlayLevel }[] = [];
    const playable = (name: string) => {
      const id = LevelId.of(name);
      return {
        id,
        start: () => {
          started.push(name);
          const level = Level.create({
            id,
            scenery: Scenery.of(
              LevelSize.of(3, 5),
              Array.from({ length: 5 }, () => Array<Ground>(3).fill(Ground.Path)),
              [],
              [],
            ),
            stones: [],
            orbs: [Orb.at(TilePosition.at(1, 3), OrbColor.Violet, everywhere)],
            door: Door.closedAt(TilePosition.at(0, 0)),
            hero: { position: TilePosition.at(1, 4), facing: Direction.Up },
            obstacles: check2dObstacles,
          });
          const play = new PlayLevel(new InMemoryLevelRepository([level]));
          plays.push({ id, play });
          return play;
        },
      };
    };
    const levels = [playable('one'), playable('two')];
    const session = new GameSession(levels, controls, sound, levelEnd, progress, LevelId.of(first));
    const complete = (): void => {
      heading = Heading.of(Direction.Up);
      for (let frame = 0; frame < 120 && levelEnd.show.mock.calls.length === plays.length - 1; frame++) session.tick();
      heading = null;
      for (let frame = 0; frame <= closingLength && levelEnd.show.mock.calls.length < plays.length; frame++)
        session.tick();
      expect(levelEnd.show).toHaveBeenCalledTimes(plays.length);
    };
    const continueWith = (button: 'a' | 'b'): void => {
      pressed.add(button);
      session.tick();
    };
    const current = (): LevelView => {
      const { id, play } = plays.at(-1)!;
      return play.view(id);
    };
    return { session, started, plays, progress, complete, continueWith, current };
  }

  test('starts with the first level', () => {
    const subject = sequence();
    expect(subject.started).toEqual(['one']);
  });

  test.each(['level-end button', 'a', 'b'] as const)(
    'advances once and wraps after the last level with %s',
    (button) => {
      const subject = sequence();
      const continuePlaying = (): void => {
        if (button === 'level-end button') subject.session.continuePlaying();
        else subject.continueWith(button);
      };
      continuePlaying();
      expect(subject.started).toEqual(['one']);
      subject.complete();
      continuePlaying();
      continuePlaying();
      expect(subject.started).toEqual(['one', 'two']);
      expect(subject.current().isComplete).toBe(false);
      subject.complete();
      continuePlaying();
      continuePlaying();
      expect(subject.started).toEqual(['one', 'two', 'one']);
      expect(subject.progress.reach.mock.calls.map(([id]) => id.value)).toEqual(['one', 'two', 'one']);
      expect(subject.progress.complete).toHaveBeenCalledTimes(2);
    },
  );

  test.each(['before', 'after'] as const)(
    'continues once when the level-end button is used %s a pending action press',
    (order) => {
      const subject = sequence();
      subject.complete();
      if (order === 'before') subject.session.continuePlaying();
      subject.continueWith('a');
      if (order === 'after') subject.session.continuePlaying();
      expect(subject.started).toEqual(['one', 'two']);
      const level = subject.current();
      expect(level.id.value).toBe('two');
      expect(level.hero.position).toEqual(TilePosition.at(1, 4));
      expect(level.orbs).toHaveLength(1);
      expect(level.isComplete).toBe(false);
      expect(subject.session.messageText).toBe('');
    },
  );

  test('starts with the level it is given and moves on from there', () => {
    const subject = sequence('two');
    expect(subject.started).toEqual(['two']);
    subject.complete();
    subject.continueWith('a');
    expect(subject.started).toEqual(['two', 'one']);
  });

  test('saves every level it reaches as the continue level', () => {
    const subject = sequence();
    subject.complete();
    subject.continueWith('a');
    expect(subject.progress.reach.mock.calls.map(([id]) => id.value)).toEqual(['one', 'two']);
  });

  test('starts every level afresh', () => {
    const subject = sequence();
    subject.complete();
    subject.continueWith('a');
    subject.complete();
    subject.continueWith('a');
    const level = subject.current();
    expect(subject.plays[2]!.play).not.toBe(subject.plays[0]!.play);
    expect(level.hero.position).toEqual(TilePosition.at(1, 4));
    expect(level.orbs).toHaveLength(1);
    expect(level.door.isOpen).toBe(false);
    expect(level.isComplete).toBe(false);
    expect(subject.session.messageText).toBe('');
  });
});

describe('the game loop', () => {
  test('carries partial frames between renders', () => {
    const tick = vi.fn();
    const render = vi.fn();
    const loop = new GameLoop(tick, render, 0);
    loop.advance(10);
    expect(tick).not.toHaveBeenCalled();
    loop.advance(20);
    expect(tick).toHaveBeenCalledOnce();
    loop.advance(51);
    expect(tick).toHaveBeenCalledTimes(3);
    expect(render).toHaveBeenCalledTimes(3);
  });

  test('caps background catch-up without queuing the discarded time', () => {
    const tick = vi.fn();
    const render = vi.fn();
    const loop = new GameLoop(tick, render, 0);
    loop.advance(1000);
    expect(tick).toHaveBeenCalledTimes(10);
    loop.advance(1000);
    expect(tick).toHaveBeenCalledTimes(10);
    loop.advance(1017);
    expect(tick).toHaveBeenCalledTimes(11);
    expect(render).toHaveBeenCalledTimes(3);
  });

  test('renders from a frame stamped before the loop started', () => {
    const render = vi.fn();
    const loop = new GameLoop(() => {}, render, 100);
    loop.advance(95);
    expect(render).toHaveBeenLastCalledWith(0);
  });

  test('tells the render how far it is toward the next tick', () => {
    const render = vi.fn();
    const loop = new GameLoop(() => {}, render, 0);
    loop.advance(25);
    expect(render).toHaveBeenLastCalledWith(expect.closeTo(0.5, 5));
    loop.advance(25 + 1000 / 120);
    expect(render).toHaveBeenLastCalledWith(expect.closeTo(0, 5));
  });

  test.each([60, 90, 120, 144])('runs the same ticks in a second shown at %s frames per second', (rate) => {
    let ticks = 0;
    const loop = new GameLoop(
      () => ticks++,
      () => {},
      0,
    );
    for (let frame = 1; frame <= rate; frame++) loop.advance((frame * 1000) / rate + 0.001);
    expect(ticks).toBe(60);
  });

  test('runs the same ticks when frames are skipped', () => {
    let ticks = 0;
    const loop = new GameLoop(
      () => ticks++,
      () => {},
      0,
    );
    for (const now of [16.7, 100, 101, 250, 400, 550, 700, 850, 1000.001]) loop.advance(now);
    expect(ticks).toBe(60);
  });

  test('runs every tick before rendering the frame', () => {
    const calls: string[] = [];
    const loop = new GameLoop(
      () => calls.push('tick'),
      () => calls.push('render'),
      0,
    );
    loop.advance(51);
    expect(calls).toEqual(['tick', 'tick', 'tick', 'render']);
  });
});

function colorAt(picture: Picture, column: number, row: number): string {
  const offset = (row * picture.width + column) * 4;
  return `#${[...picture.pixels.subarray(offset, offset + 3)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

async function checksum(picture: Picture): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', picture.pixels.slice());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function paintedChecksum(subject: ReturnType<typeof gameSession>): Promise<string> {
  const picture = new Picture(224, 224);
  subject.session.paint(picture);
  return checksum(picture);
}

function unexpectedHeroPixels(subject: ReturnType<typeof gameSession>, above: number, height: number): number {
  const actual = new Picture(224, 448);
  const faded = new Picture(224, 448);
  const colored = new Picture(224, 448);
  const level = subject.session.level;
  const pose = subject.normalAnimator.pose(level.hero, subject.frames, false);
  const scene = { level, frame: subject.frames, hero: pose, heldOrb: null };
  const painter = new WorldPainter(level);
  painter.paint(faded, scene, []);
  painter.paint(colored, scene, [everywhere]);
  subject.session.paint(actual);
  const camera = cameraPosition(level, actual.width, actual.height);
  const hero = heroPixels(level);
  let unexpected = 0;
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < 32; column++) {
      const index = (hero.y - above - camera.y + row) * actual.width + hero.x - camera.x + column;
      const shown = actual.packedPixels[index]!;
      const coloredPixel = colored.packedPixels[index]!;
      const onHero = (pose.rows[row - above]?.[column] ?? '.') !== '.';
      // Only the ground around the hero changes color, so her own pixels must never be faded or lightened.
      const allowed = onHero ? [coloredPixel] : [faded.packedPixels[index]!, coloredPixel, lighten(coloredPixel)];
      if (!allowed.includes(shown)) unexpected++;
    }
  }
  return unexpected;
}

describe('whole frames of the game session', () => {
  test.each(['walking', 'idle'] as const)('paints the normal %s hero pose after orb pickup', (motion) => {
    const subject = gameSession();
    subject.walkUntil(Direction.Right, () => subject.level.orbs.length === 0);
    if (motion === 'idle') subject.tick();
    expect(unexpectedHeroPixels(subject, 0, 32)).toBe(0);
  });

  test.each(['walking', 'idle'] as const)('paints no orb above the %s hero after pickup', (motion) => {
    const subject = gameSession();
    subject.walkUntil(Direction.Right, () => subject.level.orbs.length === 0);
    if (motion === 'idle') subject.tick();
    expect(unexpectedHeroPixels(subject, 18, 18)).toBe(0);
  });

  test('paints the current signpost message fixture unchanged', async () => {
    const subject = gameSession();
    subject.press('a');
    expect(await paintedChecksum(subject)).toBe('38eff61e9c0182f493628b78f5b2475bfbd6c103ec51e486aebe199ac4e836a1');
  });

  test.each([false, true])(
    'paints spreading colors with the normal hero and message, interrupted: %s',
    (interrupted) => {
      const subject = interrupted
        ? gameSession([
            Orb.at(TilePosition.at(1, 0), OrbColor.Red, leftHalf),
            Orb.at(TilePosition.at(2, 0), OrbColor.Blue, rightHalf),
          ])
        : gameSession();
      const orbs = subject.level.orbs;
      const orb = orbs.at(-1)!;
      const restored = interrupted ? [orbs[0]!.restores] : [];
      subject.walkUntil(Direction.Right, () => subject.level.orbs.length < orbs.length);
      const firstPickupFrame = subject.frames - 1;
      if (interrupted) {
        subject.walkUntil(Direction.Right, () => subject.level.orbs.length === 0);
        expect(subject.frames - 1 - firstPickupFrame).toBeLessThan(
          restorationLength(subject.level.scenery.size, orbs[0]!.position),
        );
      }
      const pickupFrame = subject.frames - 1;
      subject.advance(20);
      const actual = new Picture(224, 224);
      const expected = new Picture(224, 224);
      const level = { ...subject.session.level, hero: subject.session.level.hero.between(1) };
      const scene = {
        level,
        frame: subject.frames,
        hero: subject.normalAnimator.pose(level.hero, subject.frames, false),
        heldOrb: null,
      };
      new WorldPainter(level).paintRestoring(expected, scene, orb.position, subject.frames - pickupFrame, restored, [
        ...restored,
        orb.restores,
      ]);
      const congratulations = new MessageBox();
      congratulations.show(messages.colorsBack, pickupFrame);
      congratulations.paint(expected, subject.frames);
      subject.session.paint(actual);
      expect(pixelDifference(actual, expected)).toBeUndefined();
    },
  );

  test('keeps the first area colored after a second orb interrupts its restoration and finishes spreading', () => {
    const subject = gameSession([
      Orb.at(TilePosition.at(1, 0), OrbColor.Red, leftHalf),
      Orb.at(TilePosition.at(2, 0), OrbColor.Blue, rightHalf),
    ]);
    const [first, second] = subject.level.orbs;
    subject.walkUntil(Direction.Right, () => subject.level.orbs.length === 1);
    const firstPickupFrame = subject.frames - 1;
    subject.walkUntil(Direction.Right, () => subject.level.orbs.length === 0);
    const secondPickupFrame = subject.frames - 1;
    const size = subject.level.scenery.size;
    expect(secondPickupFrame - firstPickupFrame).toBeLessThan(restorationLength(size, first!.position));
    subject.advance(restorationLength(size, second!.position));
    const picture = new Picture(224, 224);
    subject.session.paint(picture);
    const camera = cameraPosition(subject.level, picture.width, picture.height);
    const colors = new Set(Object.values(palette));
    const neutrals = new Set(neutralCode.options.map((code) => palette[code]));
    const tileColors = (tile: TilePosition): string[] =>
      Array.from({ length: 32 * 32 }, (_, index) =>
        colorAt(picture, tile.column * 32 + (index % 32) - camera.x, tile.row * 32 + Math.floor(index / 32) - camera.y),
      );
    for (const tile of [TilePosition.at(0, 2), TilePosition.at(4, 2)]) {
      const painted = tileColors(tile);
      expect(painted.every((color) => colors.has(color))).toBe(true);
      expect(painted.some((color) => !neutrals.has(color))).toBe(true);
    }
    expect(subject.session.messageText).toBe(messages.colorsBack);
  });

  test('closes the colored world without a restoration message when completion interrupts spreading', () => {
    const subject = gameSession(undefined, [], LevelSize.of(22, 6));
    const orb = subject.level.orbs[0]!;
    subject.walkUntil(Direction.Right, () => subject.level.orbs.length === 0);
    const pickupFrame = subject.frames - 1;
    subject.move(Direction.Right);
    subject.walkUntil(Direction.Up, () => subject.level.isComplete);
    const completedFrame = subject.frames - 1;
    expect(completedFrame - pickupFrame).toBeLessThan(restorationLength(subject.level.scenery.size, orb.position));
    const playthrough = Playthrough.of(PlayTime.ofFrames(completedFrame), StarCount.of(0), StarCount.of(0));
    expect(subject.progress.complete).toHaveBeenCalledExactlyOnceWith(subject.level.id, playthrough);
    expect(subject.levelEnd.show).not.toHaveBeenCalled();
    for (const elapsed of [1, closingLength / 2, closingLength]) {
      subject.advance(elapsed - (subject.frames - completedFrame));
      const actual = new Picture(224, 224);
      const expected = new Picture(224, 224);
      const level = subject.session.level;
      new WorldPainter(level).paintClosing(
        expected,
        {
          level,
          frame: subject.frames,
          hero: subject.normalAnimator.pose(level.hero, subject.frames, false),
          heldOrb: null,
        },
        elapsed,
      );
      subject.session.paint(actual);
      expect(pixelDifference(actual, expected)).toBeUndefined();
      expect(subject.levelEnd.show).not.toHaveBeenCalled();
      expect(subject.progress.complete).toHaveBeenCalledOnce();
    }
    subject.tick();
    expect(subject.levelEnd.show).toHaveBeenCalledExactlyOnceWith(playthrough);
    expect(subject.progress.complete).toHaveBeenCalledOnce();
  });

  test('paints the current closing fixture unchanged', async () => {
    const subject = gameSession();
    for (let tile = 0; tile < 3; tile++) subject.move(Direction.Right);
    for (let tile = 0; tile < 5; tile++) subject.move(Direction.Up);
    subject.advance(closingLength / 2);
    expect(await paintedChecksum(subject)).toBe('d01ad9c5da9e6a897b90094076fa2278dec177b994adc0fea521b32eb608a175');
  });

  test('paints the current ended fixture unchanged', async () => {
    const subject = gameSession();
    for (let tile = 0; tile < 3; tile++) subject.move(Direction.Right);
    for (let tile = 0; tile < 5; tile++) subject.move(Direction.Up);
    subject.advance(closingLength);
    expect(await paintedChecksum(subject)).toBe('b0e49ba2a219b20e3667492745d5a2c174cd71b7e40425753260c1d6e7cfbdb3');
  });
});
