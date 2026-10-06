import { describe, expect, test, vi } from 'vitest';
import { PlayLevel } from '../application/play-level';
import { Hero } from '../domain/level/hero';
import { Area, Door, Level, LevelId, Orb, OrbColor, Signpost, SignpostText, Star } from '../domain/level/level';
import { Direction, TilePosition } from '../domain/level/position';
import { Ground, LevelSize, Scenery } from '../domain/level/scenery';
import { InMemoryLevelRepository } from '../infrastructure/in-memory-level-repository';
import { fitCanvas } from './game';
import { GameLoop } from './game-loop';
import { GameSession, messages } from './game-session';
import { Picture } from './picture';
import { closingLength } from './world-painter';

const area = (keep: (position: TilePosition) => boolean): Area =>
  Area.of(Array.from({ length: 1600 }, (_, index) => TilePosition.at(index % 40, Math.floor(index / 40))).filter(keep));
const everywhere = area(() => true);
const leftHalf = area((position) => position.column < 2);
const rightHalf = area((position) => position.column >= 2);

test.each([1, 1.25, 1.5, 2, 3])('fits whole, equally sized device pixels at pixel ratio %s', (ratio) => {
  for (const [width, height] of [
    [320, 405],
    [360, 316],
    [375, 475],
    [430, 712],
    [529, 529],
  ]) {
    const deviceWidth = Math.ceil(width! * ratio);
    const deviceHeight = Math.ceil(height! * ratio);
    const fit = fitCanvas(deviceWidth, deviceHeight);
    expect(fit.scale).toBe(Math.floor(Math.min(deviceWidth, deviceHeight) / 224));
    expect(fit.width).toBeGreaterThanOrEqual(224);
    expect(fit.height).toBeGreaterThanOrEqual(224);
    expect(fit.width * fit.scale).toBeGreaterThanOrEqual(deviceWidth);
    expect(fit.height * fit.scale).toBeGreaterThanOrEqual(deviceHeight);
    expect(fit.width * fit.scale - deviceWidth).toBeLessThan(fit.scale);
    expect(fit.height * fit.scale - deviceHeight).toBeLessThan(fit.scale);
  }
});

test('uses the largest permitted scale at the 224-pixel boundaries', () => {
  expect(fitCanvas(447, 600)).toEqual({ width: 447, height: 600, scale: 1 });
  expect(fitCanvas(448, 600)).toEqual({ width: 224, height: 300, scale: 2 });
  expect(fitCanvas(673, 900)).toEqual({ width: 225, height: 300, scale: 3 });
});

test.each([0, -1, NaN, Infinity])('rejects invalid view dimensions %s', (dimension) => {
  expect(() => fitCanvas(dimension, 224)).toThrow(RangeError);
  expect(() => fitCanvas(224, dimension)).toThrow(RangeError);
});

const hint = 'ΒΡΕΣ ΤΗ ΣΦΑΙΡΑ!';

function gameSession(orbs: readonly Orb[] = [Orb.at(TilePosition.at(1, 0), OrbColor.Violet, everywhere)]) {
  const levelId = LevelId.of('session');
  const pressed = new Set<'a' | 'b'>();
  const controls = {
    takePress: vi.fn((button: 'a' | 'b') => pressed.delete(button)),
    direction: vi.fn<() => Direction | null>(() => null),
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
    const level = new Level(
      levelId,
      scenery,
      [],
      orbs,
      Door.closedAt(TilePosition.at(1, 5)),
      new Hero(TilePosition.at(0, 0), Direction.Right),
      [Star.at(TilePosition.at(3, 0))],
      [Signpost.at(TilePosition.at(0, 1), SignpostText.of(hint))],
    );
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
  const move = (direction: Direction): void => {
    controls.direction.mockReturnValue(direction);
    for (let frame = 0; frame < 4 && !play.view(levelId).hero.step; frame++) tick();
    const step = play.view(levelId).hero.step;
    expect(step).not.toBeNull();
    controls.direction.mockReturnValue(null);
    advance(step!.duration);
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
    press(button: 'a' | 'b'): void {
      pressed.add(button);
      tick();
    },
    get level(): Level {
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
    subject.controls.direction.mockReturnValue(Direction.Right);
    subject.tick();
    expect(subject.session.messageText).toBe('');
    expect(subject.level.hero.step).not.toBeNull();
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

  test('tells her to find the other orb until she has both, then opens the door', () => {
    const subject = gameSession([
      Orb.at(TilePosition.at(1, 0), OrbColor.Red, leftHalf),
      Orb.at(TilePosition.at(2, 0), OrbColor.Blue, rightHalf),
    ]);
    subject.move(Direction.Right);
    expect(subject.session.messageText).toBe(messages.someColorsBack);
    expect(subject.level.door.isOpen).toBe(false);
    subject.move(Direction.Right);
    expect(subject.session.messageText).toBe(messages.colorsBack);
    expect(subject.level.door.isOpen).toBe(true);
    expect(subject.sound.orb).toHaveBeenCalledTimes(2);
  });

  test('starts restoration exactly thirty frames after collecting the orb', () => {
    const subject = gameSession();
    subject.move(Direction.Right);
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
