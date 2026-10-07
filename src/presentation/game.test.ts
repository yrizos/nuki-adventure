import { describe, expect, test, vi } from 'vitest';
import type { LevelView } from '../application/level-view';
import { PlayLevel } from '../application/play-level';
import { Area, Orb, OrbColor, Star } from '../domain/level/collectibles';
import { Door } from '../domain/level/door';
import { Level } from '../domain/level/level';
import { LevelId } from '../domain/level/level-id';
import { Direction, Heading, TilePosition } from '../domain/level/position';
import { Ground, LevelSize, Scenery } from '../domain/level/scenery';
import { Signpost, SignpostText } from '../domain/level/signpost';
import { check2dObstacles } from '../infrastructure/check2d-obstacles';
import { InMemoryLevelRepository } from '../infrastructure/in-memory-level-repository';
import { GameLoop } from './game-loop';
import { GameSession, messages } from './game-session';
import { Picture } from './picture';
import { closingLength } from './world-transition';

const area = (keep: (position: TilePosition) => boolean): Area =>
  Area.of(Array.from({ length: 1600 }, (_, index) => TilePosition.at(index % 40, Math.floor(index / 40))).filter(keep));
const everywhere = area(() => true);
const leftHalf = area((position) => position.column < 2);
const rightHalf = area((position) => position.column >= 2);

const hint = 'ΒΡΕΣ ΤΗ ΣΦΑΙΡΑ!';

function gameSession(orbs: readonly Orb[] = [Orb.at(TilePosition.at(1, 0), OrbColor.Violet, everywhere)]) {
  const levelId = LevelId.of('session');
  const pressed = new Set<'a' | 'b'>();
  const controls = {
    takePress: vi.fn((button: 'a' | 'b') => pressed.delete(button)),
    heading: vi.fn<() => Heading | null>(() => null),
  };
  const sound = { star: vi.fn(), orb: vi.fn(), door: vi.fn(), footstep: vi.fn(), restoring: vi.fn() };
  const levelEnd = { show: vi.fn(), hide: vi.fn() };
  let play: PlayLevel;
  const createPlay = vi.fn(() => {
    const scenery = Scenery.of(
      LevelSize.of(5, 6),
      Array.from({ length: 6 }, () => Array<Ground>(5).fill(Ground.Path)),
      [],
      [],
      [],
    );
    const level = Level.create({
      id: levelId,
      scenery,
      stones: [],
      orbs,
      door: Door.closedAt(TilePosition.at(1, 5)),
      hero: { position: TilePosition.at(0, 0), facing: Direction.Right },
      obstacles: check2dObstacles,
      stars: [Star.at(TilePosition.at(3, 0))],
      signposts: [Signpost.at(TilePosition.at(0, 1), SignpostText.of(hint))],
    });
    play = new PlayLevel(new InMemoryLevelRepository([level]));
    return play;
  });
  const session = new GameSession([{ id: levelId, start: createPlay }], controls, sound, levelEnd);
  let frames = 0;
  const tick = (): void => {
    session.tick();
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

  test('keeps walking and collecting stars while the orb is held and colors spread', () => {
    const subject = gameSession();
    subject.move(Direction.Right);
    expect(subject.sound.orb).toHaveBeenCalledOnce();
    expect(subject.session.messageText).toBe(messages.colorsBack);
    subject.move(Direction.Right);
    subject.move(Direction.Right);
    expect(subject.level.hero.position).toEqual(TilePosition.at(3, 0));
    expect(subject.sound.star).toHaveBeenCalledOnce();
    expect(subject.sound.restoring).toHaveBeenCalledOnce();
    expect(subject.sound.footstep).toHaveBeenCalledTimes(3);
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

  test('keeps the door shut until the spreading color has drawn all of it open', () => {
    const subject = gameSession();
    subject.walkUntil(Direction.Right, () => subject.sound.orb.mock.calls.length > 0);
    subject.advance(30);
    expect(subject.sound.restoring).toHaveBeenCalledOnce();
    // The door art reaches row 3 to row 5, five rings below the orb, so color covers it after 5 * 4 + 16 frames.
    subject.advance(35);
    expect(subject.level.door.isOpen).toBe(false);
    subject.advance(1);
    expect(subject.level.door.isOpen).toBe(true);
  });

  test('starts restoration exactly thirty frames after collecting the orb', () => {
    const subject = gameSession();
    subject.walkUntil(Direction.Right, () => subject.sound.orb.mock.calls.length > 0);
    subject.advance(29);
    expect(subject.sound.restoring).not.toHaveBeenCalled();
    subject.advance(1);
    expect(subject.sound.restoring).toHaveBeenCalledOnce();
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

  test.each(['a', 'b'] as const)('shows completion after the closing transition and continues with %s', (button) => {
    const subject = gameSession();
    for (let tile = 0; tile < 3; tile++) subject.move(Direction.Right);
    for (let tile = 0; tile < 5; tile++) subject.move(Direction.Down);
    const completedAt = subject.frames;
    expect(subject.sound.door).toHaveBeenCalledOnce();
    expect(subject.levelEnd.show).not.toHaveBeenCalled();
    subject.advance(closingLength - 1);
    expect(subject.levelEnd.show).not.toHaveBeenCalled();
    subject.advance(1);
    expect(subject.levelEnd.show).toHaveBeenCalledExactlyOnceWith({
      frames: completedAt - 1,
      collectedStars: 1,
      starCount: 1,
    });
    const picture = new Picture(224, 224);
    subject.session.paint(picture);
    expect(new Set(picture.pixels.filter((_, index) => index % 4 === 3))).toEqual(new Set([255]));
    subject.press(button);
    expect(subject.levelEnd.hide).toHaveBeenCalledOnce();
    expect(subject.createPlay).toHaveBeenCalledTimes(2);
    expect(subject.level.hero.position).toEqual(TilePosition.at(0, 0));
    expect(subject.session.messageText).toBe('');
  });
});

describe('the level sequence', () => {
  function sequence() {
    const pressed = new Set<'a' | 'b'>();
    let heading: Heading | null = null;
    const controls = { takePress: (button: 'a' | 'b') => pressed.delete(button), heading: () => heading };
    const sound = { star: vi.fn(), orb: vi.fn(), door: vi.fn(), footstep: vi.fn(), restoring: vi.fn() };
    const levelEnd = { show: vi.fn(), hide: vi.fn() };
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
              LevelSize.of(3, 3),
              Array.from({ length: 3 }, () => Array<Ground>(3).fill(Ground.Path)),
              [],
              [],
            ),
            stones: [],
            orbs: [Orb.at(TilePosition.at(1, 1), OrbColor.Violet, everywhere)],
            door: Door.closedAt(TilePosition.at(0, 2)),
            hero: { position: TilePosition.at(1, 0), facing: Direction.Down },
            obstacles: check2dObstacles,
          });
          const play = new PlayLevel(new InMemoryLevelRepository([level]));
          plays.push({ id, play });
          return play;
        },
      };
    };
    const levels = [playable('one'), playable('two')];
    const session = new GameSession(levels, controls, sound, levelEnd);
    const complete = (): void => {
      heading = Heading.of(Direction.Down);
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
    return { session, started, plays, complete, continueWith, current };
  }

  test('starts with the first level', () => {
    const subject = sequence();
    expect(subject.started).toEqual(['one']);
  });

  test('moves on to the second level, then returns to the first after the last', () => {
    const subject = sequence();
    subject.complete();
    subject.continueWith('a');
    expect(subject.started).toEqual(['one', 'two']);
    subject.complete();
    subject.continueWith('b');
    expect(subject.started).toEqual(['one', 'two', 'one']);
  });

  test('starts every level afresh', () => {
    const subject = sequence();
    subject.complete();
    subject.continueWith('a');
    subject.complete();
    subject.continueWith('a');
    const level = subject.current();
    expect(subject.plays[2]!.play).not.toBe(subject.plays[0]!.play);
    expect(level.hero.position).toEqual(TilePosition.at(1, 0));
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

async function checksum(picture: Picture): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', picture.pixels.slice());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function paintedChecksum(subject: ReturnType<typeof gameSession>): Promise<string> {
  const picture = new Picture(224, 224);
  subject.session.paint(picture);
  return checksum(picture);
}

describe('whole frames of the game session', () => {
  test('paints the current signpost message fixture unchanged', async () => {
    const subject = gameSession();
    subject.press('a');
    expect(await paintedChecksum(subject)).toBe('d143aa2dfa4af5a544fff0a3ff0528cbb43702e7f151147decd88f7abdbffaa8');
  });

  test('paints the current held orb fixture unchanged', async () => {
    const subject = gameSession();
    subject.move(Direction.Right);
    expect(await paintedChecksum(subject)).toBe('d9f79fa42e3268ad98ed3f06c4073611e684d90279ff5c863259c5bf5cea2705');
  });

  test('paints the current spreading color fixture unchanged', async () => {
    const subject = gameSession();
    subject.move(Direction.Right);
    subject.advance(50);
    expect(await paintedChecksum(subject)).toBe('307bbce0f6b87d06157f9e9e2b6a64e028b9eef64996ac7732163b2981d0716d');
  });

  test('paints the current closing fixture unchanged', async () => {
    const subject = gameSession();
    for (let tile = 0; tile < 3; tile++) subject.move(Direction.Right);
    for (let tile = 0; tile < 5; tile++) subject.move(Direction.Down);
    subject.advance(closingLength / 2);
    expect(await paintedChecksum(subject)).toBe('2864691947c76a403eb2544a843dc5924c18e948834873afa23495c27bf0bf78');
  });

  test('paints the current ended fixture unchanged', async () => {
    const subject = gameSession();
    for (let tile = 0; tile < 3; tile++) subject.move(Direction.Right);
    for (let tile = 0; tile < 5; tile++) subject.move(Direction.Down);
    subject.advance(closingLength);
    expect(await paintedChecksum(subject)).toBe('b0e49ba2a219b20e3667492745d5a2c174cd71b7e40425753260c1d6e7cfbdb3');
  });
});
