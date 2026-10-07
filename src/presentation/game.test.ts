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
import { GameLoop } from './game-loop';
import { GameSession, messages } from './game-session';
import { HeroAnimator } from './hero-animator';
import { MessageBox } from './message-box';
import { Picture } from './picture';
import { cameraPosition, heroPixels } from './world-geometry';
import { WorldPainter } from './world-painter';
import { closingLength } from './world-transition';

const area = (keep: (position: TilePosition) => boolean): Area =>
  Area.of(Array.from({ length: 1600 }, (_, index) => TilePosition.at(index % 40, Math.floor(index / 40))).filter(keep));
const everywhere = area(() => true);
const leftHalf = area((position) => position.column < 2);
const rightHalf = area((position) => position.column >= 2);

const hint = 'ΒΡΕΣ ΤΗ ΣΦΑΙΡΑ!';

function gameSession(
  orbs: readonly Orb[] = [Orb.at(TilePosition.at(1, 0), OrbColor.Violet, everywhere)],
  stars: readonly Star[] = [Star.at(TilePosition.at(3, 5))],
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
    const actual = new Picture(224, 320);
    const expected = new Picture(224, 320);
    const faded = new Picture(224, 320);
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
      ((orb.position.row * 32 + 4 - camera.y) * actual.width + orb.position.column * 32 + 28 - camera.x) * 4;
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

  test('keeps the door shut until the spreading color has drawn all of it open', () => {
    const subject = gameSession();
    subject.walkUntil(Direction.Right, () => subject.sound.orb.mock.calls.length > 0);
    expect(subject.sound.restoring).toHaveBeenCalledOnce();
    subject.advance(35);
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

  test.each(['a', 'b'] as const)('shows completion after the closing transition and continues with %s', (button) => {
    const subject = gameSession();
    for (let tile = 0; tile < 3; tile++) subject.move(Direction.Right);
    for (let tile = 0; tile < 5; tile++) subject.move(Direction.Up);
    const completedAt = subject.frames;
    expect(subject.sound.door).toHaveBeenCalledOnce();
    expect(subject.levelEnd.show).not.toHaveBeenCalled();
    subject.advance(closingLength - 1);
    expect(subject.levelEnd.show).not.toHaveBeenCalled();
    subject.advance(1);
    const playthrough = Playthrough.of(PlayTime.ofFrames(completedAt - 1), StarCount.of(1), StarCount.of(1));
    expect(subject.levelEnd.show).toHaveBeenCalledExactlyOnceWith(playthrough);
    expect(subject.progress.complete).toHaveBeenCalledExactlyOnceWith(subject.level.id, playthrough);
    const picture = new Picture(224, 224);
    subject.session.paint(picture);
    expect(new Set(picture.pixels.filter((_, index) => index % 4 === 3))).toEqual(new Set([255]));
    subject.press(button);
    expect(subject.levelEnd.hide).toHaveBeenCalledOnce();
    expect(subject.createPlay).toHaveBeenCalledTimes(2);
    expect(subject.level.hero.position).toEqual(TilePosition.at(0, 5));
    expect(subject.session.messageText).toBe('');
  });
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

  test('moves on to the second level, then returns to the first after the last', () => {
    const subject = sequence();
    subject.complete();
    subject.continueWith('a');
    expect(subject.started).toEqual(['one', 'two']);
    subject.complete();
    subject.continueWith('b');
    expect(subject.started).toEqual(['one', 'two', 'one']);
  });

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
  const scene = {
    level,
    frame: subject.frames,
    hero: subject.normalAnimator.pose(level.hero, subject.frames, false),
    heldOrb: null,
  };
  const painter = new WorldPainter(level);
  painter.paint(faded, scene, []);
  painter.paint(colored, scene, [everywhere]);
  subject.session.paint(actual);
  const camera = cameraPosition(level, actual.width, actual.height);
  const hero = heroPixels(level);
  let unexpected = 0;
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < 32; column++) {
      const offset = ((hero.y - above - camera.y + row) * actual.width + hero.x - camera.x + column) * 4;
      const matches = (picture: Picture): boolean =>
        actual.pixels
          .subarray(offset, offset + 4)
          .every((channel, index) => channel === picture.pixels[offset + index]);
      if (!matches(faded) && !matches(colored)) unexpected++;
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

  test('paints spreading colors with the normal hero and congratulations message', () => {
    const subject = gameSession();
    const orb = subject.level.orbs[0]!;
    subject.walkUntil(Direction.Right, () => subject.level.orbs.length === 0);
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
    new WorldPainter(level).paintRestoring(
      expected,
      scene,
      orb.position,
      subject.frames - pickupFrame,
      [],
      [orb.restores],
    );
    const congratulations = new MessageBox();
    congratulations.show(messages.colorsBack, pickupFrame);
    congratulations.paint(expected, subject.frames);
    subject.session.paint(actual);
    expect(actual.pixels).toEqual(expected.pixels);
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
