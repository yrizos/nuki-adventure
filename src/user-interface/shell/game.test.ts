import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Area, Key, Star } from '../../level/domain/collectibles';
import { Direction, Heading, TilePosition } from '../../level/domain/position';
import { Door } from '../../level/domain/door';
import { Ground, LevelSize, Scenery } from '../../level/domain/scenery';
import { LevelId } from '../../level/domain/level-id';
import { type LevelView } from '../../level/application/level-view';
import { PlayLevel } from '../../level/application/play-level';
import { Level } from '../../level/domain/level';
import { ManageProgress } from '../../progress/application/manage-progress';
import { check2dObstacles } from '../../level/infrastructure/check2d-obstacles';
import { levelFromLayout } from '../../level/content/level-layout';
import { secondLevel, secondLevelId } from '../../level/content/second';
import { keepOrder } from '../../level/testing/star-spots';
import { pathTo, same } from '../../level/testing/walk-level';
import { InMemoryLevelRepository } from '../../level/infrastructure/in-memory-level-repository';
import { LocalProgressRepository } from '../../progress/infrastructure/local-progress-repository';
import { audioWindow } from '../testing/audio-context';
import {
  type FakeCanvasElement,
  FakeDocument,
  type FakeElement,
  type FakeHTMLElement,
  stubDisplay,
} from '../testing/fake-document';
import { memoryStorage } from '../../progress/testing/memory-storage';
import { pixelDifference } from '../testing/pictures';
import type { Art } from '../graphics/art';
import { artUrl } from '../graphics/canvas-art';
import { buttonWobble, startGame, wobbleEvery } from './game';
import { arrivalLength } from './game-phase';
import { Sound } from '../audio/sound';
import { GameLoop } from './game-loop';
import { endScreenFadeLength } from '../screens/end-screen';
import { narration } from '../screens/intro';
import { introLength, skipLength } from '../screens/intro-timeline';
import { GameSession, humVolume, messages } from './game-session';
import { HeroAnimator } from '../world/hero-animator';
import { MessageBox } from '../screens/message-box';
import { neutralCode, palette } from '../graphics/palette';
import { lighten, Picture } from '../graphics/picture';
import { heroArt } from '../graphics/sprite-library';
import { cameraPosition, heroPixels } from '../world/world-geometry';
import { WorldPainter } from '../world/world-painter';
import { closingLength, doorOpeningLength, restorationLength } from '../world/world-transition';

const gateSwingLength = 16;

const area = (keep: (position: TilePosition) => boolean): Area =>
  Area.of(Array.from({ length: 1600 }, (_, index) => TilePosition.at(index % 40, Math.floor(index / 40))).filter(keep));
const everywhere = area(() => true);
const leftHalf = area((position) => position.column < 2);
const rightHalf = area((position) => position.column >= 2);

// The page drives the joystick through the keyboard, so the touch joystick library only needs to accept listeners.
vi.mock('nipplejs', () => ({ create: () => ({ on: () => {}, destroy: () => {} }) }));

function gameSession(
  keys: readonly Key[] = [Key.at(TilePosition.at(1, 0), everywhere)],
  stars: readonly Star[] = [Star.at(TilePosition.at(3, 5))],
  size: LevelSize = LevelSize.of(5, 6),
  arrives = false,
) {
  const levelId = LevelId.of('session');
  const pressed = new Set<'a' | 'b'>();
  const controls = {
    takePress: vi.fn((button: 'a' | 'b') => pressed.delete(button)),
    isHeld: vi.fn((_button: 'a' | 'b') => false),
    heading: vi.fn<() => Heading | null>(() => null),
  };
  const sound = {
    star: vi.fn(),
    key: vi.fn(),
    hum: vi.fn(),
    door: vi.fn(),
    footstep: vi.fn(),
    restoring: vi.fn(),
    arrival: vi.fn(),
    gate: vi.fn(),
    plate: vi.fn(),
  };
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
      keys: keys.map((key) => Key.at(TilePosition.at(key.position.column, 5), key.restores)),
      door: Door.closedAt(TilePosition.at(1, 0)),
      hero: { position: TilePosition.at(0, 5), facing: Direction.Right },
      obstacles: check2dObstacles,
      stars,
    });
    play = new PlayLevel(new InMemoryLevelRepository([level]));
    return play;
  });
  const report = { completed: vi.fn() };
  const session = new GameSession({ id: levelId, start: createPlay, arrives }, controls, sound, progress, report);
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
    progress,
    report,
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
  test('starts the restoration sound on the key pickup tick', () => {
    const subject = gameSession();
    subject.walkUntil(Direction.Right, () => subject.level.keys.length === 0);
    expect(subject.sound.key).toHaveBeenCalledExactlyOnceWith(true);
    expect(subject.sound.restoring).toHaveBeenCalledOnce();
  });

  test('hums beside the key and falls silent once it is picked up', () => {
    const subject = gameSession();
    subject.tick();
    expect(subject.sound.hum.mock.lastCall![0]).toBeGreaterThan(0);
    subject.walkUntil(Direction.Right, () => subject.level.keys.length === 0);
    expect(subject.sound.hum).toHaveBeenLastCalledWith(0);
  });

  test('starts painting restored world colors on the key pickup tick', () => {
    const subject = gameSession();
    const key = subject.level.keys[0]!;
    subject.walkUntil(Direction.Right, () => subject.level.keys.length === 0);
    const actual = new Picture(224, 448);
    const expected = new Picture(224, 448);
    const faded = new Picture(224, 448);
    const scene = {
      level: subject.session.level,
      frame: subject.frames,
      hero: subject.normalAnimator.pose(subject.session.level.hero, subject.frames),
    };
    const painter = new WorldPainter(scene.level);
    painter.paintRestoring(expected, scene, key.position, 1, [], [key.restores]);
    painter.paint(faded, scene, []);
    subject.session.paint(actual);
    const camera = cameraPosition(scene.level, actual.width, actual.height);
    const offset =
      ((key.position.row * 32 + 16 - camera.y) * actual.width + key.position.column * 32 + 20 - camera.x) * 4;
    const pixel = (picture: Picture) => [...picture.pixels.subarray(offset, offset + 4)];
    expect(pixel(expected)).not.toEqual(pixel(faded));
    expect(pixel(actual)).toEqual(pixel(expected));
  });

  test('walks through key pickup and restoration just as through a star pickup', () => {
    const subject = gameSession();
    const starPickup = gameSession([Key.at(TilePosition.at(4, 0), everywhere)], [Star.at(TilePosition.at(1, 5))]);
    subject.controls.heading.mockReturnValue(Heading.of(Direction.Right));
    starPickup.controls.heading.mockReturnValue(Heading.of(Direction.Right));
    for (let frame = 0; frame < 40 && subject.level.keys.length > 0; frame++) {
      subject.tick();
      starPickup.tick();
      expect(subject.session.level.hero.feet).toEqual(starPickup.session.level.hero.feet);
      expect(subject.session.level.hero.isWalking).toBe(true);
    }
    expect(subject.session.level.keys).toHaveLength(0);
    expect(starPickup.session.level.stars).toHaveLength(0);
    for (let frame = 0; frame < 40; frame++) {
      subject.tick();
      starPickup.tick();
      expect(subject.session.level.hero.feet).toEqual(starPickup.session.level.hero.feet);
      expect(subject.session.level.hero.isWalking).toBe(true);
    }
  });

  test.each([1, 2])(
    'congratulates a key pickup with %s keys in the level without claiming the door is open',
    (count) => {
      const subject = gameSession([
        Key.at(TilePosition.at(1, 0), count === 1 ? everywhere : leftHalf),
        ...Array.from({ length: count - 1 }, () => Key.at(TilePosition.at(2, 0), rightHalf)),
      ]);
      subject.walkUntil(Direction.Right, () => subject.level.keys.length < count);
      expect(subject.session.messageText).toContain('ΜΠΡΑΒΟ!');
      expect(subject.session.messageText).not.toContain('Η ΠΟΡΤΑ');
      expect(subject.session.level.door.isOpen).toBe(false);
    },
  );

  test('keeps walking and collecting stars while colors spread', () => {
    const subject = gameSession();
    subject.move(Direction.Right);
    expect(subject.sound.key).toHaveBeenCalledOnce();
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

  test('tells her to find the other key until she has both', () => {
    const subject = gameSession([Key.at(TilePosition.at(1, 0), leftHalf), Key.at(TilePosition.at(2, 0), rightHalf)]);
    subject.move(Direction.Right);
    expect(subject.session.messageText).toBe(messages.someColorsBack);
    expect(subject.level.door.isOpen).toBe(false);
    subject.move(Direction.Right);
    expect(subject.session.messageText).toBe(messages.colorsBack);
    expect(subject.level.door.isOpen).toBe(false);
    expect(subject.sound.key.mock.calls).toEqual([[false], [true]]);
  });

  test('opens the door only once color has drawn it open from the last key, however long ago the first was taken', () => {
    const subject = gameSession([Key.at(TilePosition.at(1, 0), leftHalf), Key.at(TilePosition.at(2, 0), rightHalf)]);
    const { door, scenery } = subject.level;
    const [first, second] = subject.level.keys;
    subject.walkUntil(Direction.Right, () => subject.level.keys.length === 1);
    subject.advance(restorationLength(scenery.size, first!.position));
    expect(subject.level.door.isOpen).toBe(false);
    subject.walkUntil(Direction.Right, () => subject.level.keys.length === 0);
    subject.advance(doorOpeningLength(door, scenery.size, second!.position) - 1);
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

  test('reports completion once, after the closing transition', () => {
    const subject = gameSession();
    for (let tile = 0; tile < 3; tile++) subject.move(Direction.Right);
    for (let tile = 0; tile < 5; tile++) subject.move(Direction.Up);
    const completedAt = subject.frames;
    expect(subject.sound.door).toHaveBeenCalledOnce();
    subject.advance(closingLength - 1);
    expect(subject.report.completed).not.toHaveBeenCalled();
    subject.advance(1);
    expect(subject.report.completed).toHaveBeenCalledOnce();
    const playthrough = { playFrames: completedAt - 1, starsCollected: 1, starCount: 1 };
    expect(subject.progress.complete).toHaveBeenCalledExactlyOnceWith(subject.level.id, playthrough);
    subject.press('a');
    subject.advance(10);
    expect(subject.report.completed).toHaveBeenCalledOnce();
    expect(subject.createPlay).toHaveBeenCalledOnce();
  });
});

function gatedSession(arrives = false) {
  const id = LevelId.of('gated');
  const pressed = new Set<'a' | 'b'>();
  const controls = {
    takePress: vi.fn((button: 'a' | 'b') => pressed.delete(button)),
    isHeld: vi.fn((_button: 'a' | 'b') => false),
    heading: vi.fn<() => Heading | null>(() => null),
  };
  const sound = {
    star: vi.fn(),
    key: vi.fn(),
    hum: vi.fn(),
    door: vi.fn(),
    footstep: vi.fn(),
    restoring: vi.fn(),
    arrival: vi.fn(),
    gate: vi.fn(),
    plate: vi.fn(),
  };
  const level = levelFromLayout(
    id,
    ['.DDD.', '..K..', '.....', 'WFGFW', '..H..', '.....'],
    keepOrder,
    check2dObstacles,
    {
      keys: { K: { restores: () => true } },
    },
  );
  const session = new GameSession(
    { id, start: () => new PlayLevel(new InMemoryLevelRepository([level])), arrives },
    controls,
    sound,
    { reach: vi.fn(), complete: vi.fn() },
    { completed: vi.fn() },
  );
  const tick = (count = 1): void => {
    for (let frame = 0; frame < count; frame++) session.tick();
  };
  return {
    session,
    controls,
    sound,
    tick,
    press(button: 'a' | 'b'): void {
      pressed.add(button);
      tick();
    },
    hold(direction: Direction | null): void {
      controls.heading.mockReturnValue(direction && Heading.of(direction));
    },
  };
}

test('a game session passes its randomness to the world painter to float the water lilies', () => {
  const random = vi.fn(() => 0.5);
  new GameSession(
    {
      id: secondLevelId,
      start: () => new PlayLevel(new InMemoryLevelRepository([secondLevel(keepOrder, check2dObstacles)])),
    },
    { takePress: vi.fn(), isHeld: vi.fn(), heading: vi.fn() },
    {
      star: vi.fn(),
      key: vi.fn(),
      hum: vi.fn(),
      door: vi.fn(),
      footstep: vi.fn(),
      restoring: vi.fn(),
      arrival: vi.fn(),
      gate: vi.fn(),
      plate: vi.fn(),
    },
    { reach: vi.fn(), complete: vi.fn() },
    { completed: vi.fn() },
    random,
  );
  expect(random).toHaveBeenCalled();
});

describe('a swing gate in the game session', () => {
  test('enables A only in a level with a gate', () => {
    expect(gatedSession().session.uses('a')).toBe(true);
    expect(gameSession().session.uses('a')).toBe(false);
  });

  test('starts opening with its sound when A is pressed from below, whichever way the hero faces', () => {
    const subject = gatedSession();
    subject.hold(Direction.Left);
    subject.tick();
    subject.hold(null);
    expect(subject.session.level.hero.facing).toEqual(Direction.Left);
    expect(subject.session.level.canOperateGate).toBe(true);
    subject.press('a');
    expect(subject.sound.gate).toHaveBeenCalledOnce();
    expect(subject.session.level.gates[0]?.state).toBe('opening');
    expect(subject.session.level.canOperateGate).toBe(false);
  });

  test('holds the hero for sixteen frames and lets her through on the frame after the swing ends', () => {
    const subject = gatedSession();
    const start = subject.session.level.hero.feet;
    subject.hold(Direction.Up);
    subject.press('a');
    subject.tick(gateSwingLength - 2);
    expect(subject.session.level.gates[0]?.state).toBe('opening');
    subject.tick();
    expect(subject.session.level.gates[0]?.state).toBe('open');
    expect(subject.session.level.hero.feet).toEqual(start);
    subject.tick();
    expect(subject.session.level.hero.feet.y).toBeLessThan(start.y);
    subject.tick(40);
    expect(subject.session.level.hero.position.row).toBeLessThan(3);
  });

  test('answers no further press while it swings', () => {
    const subject = gatedSession();
    subject.press('a');
    subject.press('a');
    subject.tick(gateSwingLength - 1);
    expect(subject.sound.gate).toHaveBeenCalledOnce();
    expect(subject.session.level.gates[0]?.state).toBe('open');
  });

  test('closes with its sound when A is pressed again from the far side', () => {
    const subject = gatedSession();
    subject.press('a');
    subject.tick(gateSwingLength);
    subject.hold(Direction.Up);
    subject.tick(40);
    subject.hold(null);
    subject.tick();
    expect(subject.session.level.hero.position.row).toBe(2);
    expect(subject.session.prompts('a')).toBe(false);
    subject.press('a');
    expect(subject.sound.gate).toHaveBeenCalledTimes(2);
    expect(subject.session.level.gates[0]?.state).toBe('closing');
    subject.tick(gateSwingLength - 1);
    expect(subject.session.level.gates[0]?.state).toBe('closed');
  });

  test('never opens for B, for walking into it or from two tiles away', () => {
    const subject = gatedSession();
    subject.press('b');
    subject.hold(Direction.Up);
    subject.tick(30);
    subject.hold(null);
    subject.tick();
    subject.hold(Direction.Down);
    subject.tick(20);
    subject.hold(null);
    subject.tick();
    expect(subject.session.level.hero.position.row).toBe(5);
    subject.press('a');
    expect(subject.sound.gate).not.toHaveBeenCalled();
    expect(subject.session.level.gates[0]?.state).toBe('closed');
  });

  test('asks the A button to wobble only while the hero can open the gate', () => {
    const subject = gatedSession(true);
    expect(subject.session.prompts('a')).toBe(false);
    subject.tick(arrivalLength);
    expect(subject.session.prompts('a')).toBe(true);
    subject.press('a');
    expect(subject.session.prompts('a')).toBe(false);
    subject.tick(gateSwingLength);
    expect(subject.session.prompts('a')).toBe(false);
    expect(gameSession().session.prompts('a')).toBe(false);
  });

  test('wobbles a button smoothly within one panel pixel in bursts that start still and rest between', () => {
    const offsets = Array.from({ length: wobbleEvery }, (_, age) => buttonWobble(age));
    expect(offsets[0]).toBe(0);
    expect(offsets.every((offset) => Math.abs(offset) <= 1)).toBe(true);
    expect(offsets.slice(1).some((offset, index) => Math.abs(offset - offsets[index]!) > 0.5)).toBe(false);
    expect(offsets.slice(24).every((offset) => offset === 0)).toBe(true);
    expect(buttonWobble(wobbleEvery + 3)).toBe(offsets[3]);
  });

  test('ignores A during the magical arrival', () => {
    const subject = gatedSession(true);
    subject.press('a');
    subject.tick(arrivalLength - 1);
    expect(subject.session.level.gates[0]?.state).toBe('closed');
    subject.press('a');
    expect(subject.session.level.gates[0]?.state).toBe('opening');
  });
});

describe('the second level in the game session', () => {
  test('is played from the arrival through the gate, to the key and out of the door into the next level', () => {
    const pressed = new Set<'a' | 'b'>();
    let heading: Heading | null = null;
    const controls = {
      takePress: (button: 'a' | 'b') => pressed.delete(button),
      isHeld: () => false,
      heading: () => heading,
    };
    const sound = {
      star: vi.fn(),
      key: vi.fn(),
      hum: vi.fn(),
      door: vi.fn(),
      footstep: vi.fn(),
      restoring: vi.fn(),
      arrival: vi.fn(),
      gate: vi.fn(),
      plate: vi.fn(),
    };
    const report = { completed: vi.fn() };
    const session = new GameSession(
      {
        id: secondLevelId,
        start: () => new PlayLevel(new InMemoryLevelRepository([secondLevel(keepOrder, check2dObstacles)])),
        arrives: true,
      },
      controls,
      sound,
      { reach: vi.fn(), complete: vi.fn() },
      report,
    );
    const walkTo = (arrived: (tile: TilePosition) => boolean): void => {
      const path = pathTo(session.level, arrived);
      expect(path, 'the destination must be reachable').toBeDefined();
      for (const next of path!.slice(1)) {
        for (let attempt = 0; attempt < 3 && !same(session.level.hero.feet, next); attempt++) {
          const { feet } = session.level.hero;
          heading = Heading.toward(next.x - feet.x, next.y - feet.y);
          session.tick();
        }
        expect(session.level.hero.feet).toEqual(next);
      }
      heading = null;
      session.tick();
    };
    for (let frame = 0; frame < arrivalLength; frame++) session.tick();
    const gate = session.level.gates[0]!;
    walkTo((tile) => tile.equals(gate.approach));
    heading = Heading.of(Direction.Up);
    session.tick();
    heading = null;
    pressed.add('a');
    session.tick();
    expect(sound.gate).toHaveBeenCalledOnce();
    for (let frame = 1; frame < gateSwingLength; frame++) session.tick();
    expect(session.level.gates[0]?.state).toBe('open');
    walkTo((tile) => tile.equals(TilePosition.at(21, 6)));
    expect(sound.key).toHaveBeenCalledOnce();
    for (let frame = 0; frame < 600 && !session.level.door.isOpen; frame++) session.tick();
    expect(session.level.door.isOpen).toBe(true);
    walkTo((tile) => session.level.door.covers(tile));
    expect(sound.door).toHaveBeenCalledOnce();
    for (let frame = 0; frame <= closingLength; frame++) session.tick();
    expect(report.completed).toHaveBeenCalledOnce();
  });
});

describe('the magical arrival', () => {
  const arriving = (stars: readonly Star[] = [Star.at(TilePosition.at(3, 5))]) =>
    gameSession(undefined, stars, undefined, true);

  test('plays its chime once when the session starts', () => {
    expect(arriving().sound.arrival).toHaveBeenCalledOnce();
    expect(gameSession().sound.arrival).not.toHaveBeenCalled();
  });

  test('holds the hero still through the arrival and lets a held direction move her on the next frame', () => {
    const subject = arriving();
    const start = subject.level.hero.feet;
    subject.controls.heading.mockReturnValue(Heading.of(Direction.Right));
    subject.advance(arrivalLength);
    expect(subject.level.hero.feet).toEqual(start);
    expect(subject.sound.footstep).not.toHaveBeenCalled();
    subject.advance(1);
    expect(subject.level.hero.feet.x).toBeGreaterThan(start.x);
  });

  test('collects nothing beside the start until play begins', () => {
    const subject = arriving([Star.at(TilePosition.at(0, 4))]);
    subject.controls.heading.mockReturnValue(Heading.of(Direction.Up));
    subject.advance(arrivalLength);
    expect(subject.level.stars).toHaveLength(1);
    expect(subject.sound.star).not.toHaveBeenCalled();
    subject.walkUntil(Direction.Up, () => subject.level.stars.length === 0);
  });

  test('keeps its frames out of the play time', () => {
    const subject = arriving();
    subject.advance(arrivalLength);
    for (let tile = 0; tile < 3; tile++) subject.move(Direction.Right);
    for (let tile = 0; tile < 5; tile++) subject.move(Direction.Up);
    const completedAt = subject.frames;
    subject.advance(closingLength);
    const playthrough = { playFrames: completedAt - 1 - arrivalLength, starsCollected: 1, starCount: 1 };
    expect(subject.progress.complete).toHaveBeenCalledExactlyOnceWith(subject.level.id, playthrough);
  });
});

function gamePage({ secondUnlocked = false, arrives = false, intro = false } = {}) {
  FakeDocument.stubGlobals();
  audioWindow();
  const display = stubDisplay(1);
  Object.defineProperty(display.window, 'location', { value: { search: '' } });
  const frameCallbacks: ((now: number) => void)[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: (now: number) => void) => frameCallbacks.push(callback));
  vi.spyOn(performance, 'now').mockReturnValue(0);
  const root = new FakeDocument();
  const elements = new Map<string, FakeHTMLElement>();
  for (const name of [
    'screen',
    'game-view',
    'menu-switch',
    'full-screen-switch',
    'sound-switch',
    'start-screen',
    'start-title',
    'start-hero',
    'confirm-modal',
    'confirm-box',
    'confirm-text',
    'end-screen',
    'end-title',
    'end-hero',
    'level-picker-screen',
    'level-picker-box',
    'level-picker-title',
    'announcement',
    'control-panel',
    'joystick',
    'knob',
    'button-a',
    'button-b',
  ]) {
    const created = root.createElement('div');
    created.className = name;
    elements.set(name, created);
    root.body.append(created);
  }
  // Each menu holds its own buttons, so its keyboard handling finds them as the real page does.
  for (const [menu, choices] of [
    ['start-screen', ['start-continue', 'start-pick-level', 'start-new-game']],
    ['confirm-modal', ['confirm-yes', 'confirm-no']],
    ['level-picker-screen', ['level-picker', 'level-picker-up', 'level-picker-down', 'level-picker-back']],
  ] as const) {
    for (const name of choices) {
      const created = root.createElement(name === 'level-picker' ? 'ol' : 'button');
      created.className = name;
      elements.set(name, created);
      elements.get(menu)!.append(created);
    }
  }
  // The fake page has no layout, so the level list reports that it fits and both scroll buttons stay disabled.
  Object.assign(elements.get('level-picker')!, { scrollTop: 0, scrollHeight: 0, clientHeight: 0 });
  const view = elements.get('game-view')!;
  // The smallest view the game allows keeps painting every frame of whole playthroughs fast.
  view.bounds = { left: 0, top: 0, width: 224, height: 224 };
  view.append(root.createElement('canvas'));
  for (const menu of ['start-screen', 'confirm-modal', 'end-screen', 'level-picker-screen'])
    elements.get(menu)!.hidden = true;
  const started: string[] = [];
  const playable = (name: string) => {
    const id = LevelId.of(name);
    return {
      id,
      arrives,
      start: () => {
        started.push(name);
        return new PlayLevel(
          new InMemoryLevelRepository([
            Level.create({
              id,
              scenery: Scenery.of(
                LevelSize.of(3, 5),
                Array.from({ length: 5 }, () => Array<Ground>(3).fill(Ground.Path)),
                [],
                [],
              ),
              stones: [],
              keys: [Key.at(TilePosition.at(1, 3), everywhere)],
              door: Door.closedAt(TilePosition.at(0, 0)),
              hero: { position: TilePosition.at(1, 4), facing: Direction.Up },
              obstacles: check2dObstacles,
            }),
          ]),
        );
      },
    };
  };
  const levels = [playable('one'), playable('two')];
  const progress = new ManageProgress(
    new LocalProgressRepository(memoryStorage()),
    levels.map(({ id }) => id),
  );
  if (secondUnlocked) progress.complete(levels[0]!.id, { playFrames: 60, starsCollected: 0, starCount: 0 });
  startGame(root as unknown as Document, levels, progress, () => 1);
  // A fresh game opens on the intro, and Escape leaves it for the start screen that most tests begin on.
  if (!intro && !secondUnlocked)
    root.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'Escape', repeat: false }));
  // The level picker reads every level once to draw its picture, which starts no session.
  started.length = 0;
  let now = 0;
  const frame = (): void => {
    now += 1000 / 60 + 0.001;
    frameCallbacks.at(-1)!(now);
  };
  const key = (type: 'keydown' | 'keyup', name: string): void => {
    const event = Object.assign(new Event(type, { cancelable: true }), { key: name, repeat: false });
    Object.defineProperty(event, 'target', { value: display.window });
    display.window.dispatchEvent(event);
  };
  const announcement = elements.get('announcement')!;
  return {
    root,
    started,
    frame,
    announcement,
    screen: elements.get('screen')!,
    canvas: view.children[0] as FakeCanvasElement,
    startScreen: elements.get('start-screen')!,
    confirmModal: elements.get('confirm-modal')!,
    endScreen: elements.get('end-screen')!,
    continueButton: elements.get('start-continue')!,
    continueGame: (): void => (elements.get('start-continue') as FakeHTMLElement).click(),
    // The answers act only once the modal has dithered in, one threshold per frame.
    confirm: (): void => {
      for (let step = 0; step < 16; step++) frame();
      (elements.get('confirm-yes') as FakeHTMLElement).click();
    },
    decline: (): void => {
      for (let step = 0; step < 16; step++) frame();
      (elements.get('confirm-no') as FakeHTMLElement).click();
      for (let step = 0; step < 16; step++) frame();
    },
    progress,
    startHero: elements.get('start-hero')!,
    levelPicker: elements.get('level-picker-screen')!,
    newGame: (): void => (elements.get('start-new-game') as FakeHTMLElement).click(),
    // The level picker answers only once it has dithered in, and is gone only once it has dithered out.
    pickLevel: (): void => {
      (elements.get('start-pick-level') as FakeHTMLElement).click();
      for (let step = 0; step < 16; step++) frame();
    },
    back: (): void => {
      (elements.get('level-picker-back') as FakeHTMLElement).click();
      for (let step = 0; step < 16; step++) frame();
    },
    focused: (): FakeElement | null => root.activeElement,
    pickLevelButton: elements.get('start-pick-level')!,
    backButton: elements.get('level-picker-back')!,
    newGameButton: elements.get('start-new-game')!,
    firstRow: (): FakeElement => root.querySelectorAll('.level-row')[0]!,
    menuKey: (name: string): void => {
      root.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: name, repeat: false }));
    },
    choose: (number: number): void => (root.querySelectorAll('.level-row')[number - 1] as FakeHTMLElement).click(),
    openMenu: (): void => (elements.get('menu-switch') as FakeHTMLElement).click(),
    walkUpUntil(done: () => boolean): void {
      key('keydown', 'ArrowUp');
      for (let count = 0; count < 400 && !done(); count++) frame();
      key('keyup', 'ArrowUp');
      expect(done()).toBe(true);
    },
    completeLevel(): void {
      const count = started.length;
      this.walkUpUntil(() => started.length > count || !elements.get('end-screen')!.hidden);
    },
  };
}

describe('the game page', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('opens a fresh game on the intro with every control hidden, then the start screen once it ends', () => {
    const page = gamePage({ intro: true });
    expect(page.startScreen.hidden).toBe(true);
    expect(page.screen.classList.contains('intro-open')).toBe(true);
    for (let frame = 1; frame < introLength; frame++) page.frame();
    expect(page.startScreen.hidden).toBe(true);
    page.frame();
    expect(page.startScreen.hidden).toBe(false);
    expect(page.screen.classList.contains('intro-open')).toBe(false);
    expect(page.started).toEqual([]);
  });

  test('opens the start screen at once when progress is saved', () => {
    const page = gamePage({ secondUnlocked: true });
    expect(page.startScreen.hidden).toBe(false);
    expect(page.screen.classList.contains('intro-open')).toBe(false);
  });

  test('paints the intro on the game view and announces its narration', () => {
    const page = gamePage({ intro: true });
    page.frame();
    expect(page.canvas.context.shown).not.toBeNull();
    expect(page.announcement.textContent).toBe(narration[0]);
  });

  test('Escape leaves the intro for the start screen', () => {
    const page = gamePage({ intro: true });
    page.menuKey('Escape');
    expect(page.startScreen.hidden).toBe(false);
    expect(page.screen.classList.contains('intro-open')).toBe(false);
  });

  test('a touch held through the whole skip leaves the intro for the start screen', () => {
    const page = gamePage({ intro: true });
    page.root.body.dispatchEvent(Object.assign(new Event('pointerdown'), { pointerId: 1 }));
    for (let frame = 1; frame < skipLength; frame++) page.frame();
    expect(page.startScreen.hidden).toBe(true);
    page.frame();
    expect(page.startScreen.hidden).toBe(false);
  });

  test('starts level one from ΝΕΟ ΠΑΙΧΝΙΔΙ at once when no progress is saved', () => {
    const page = gamePage();
    expect(page.startScreen.hidden).toBe(false);
    page.frame();
    expect(page.started).toEqual([]);
    page.newGame();
    expect(page.startScreen.hidden).toBe(true);
    expect(page.confirmModal.hidden).toBe(true);
    expect(page.started).toEqual(['one']);
  });

  test('with progress saved, ΝΕΟ ΠΑΙΧΝΙΔΙ asks first, ΟΧΙ keeps the progress and ΝΑΙ deletes it before starting level one', () => {
    const page = gamePage({ secondUnlocked: true });
    page.newGame();
    expect([page.startScreen.hidden, page.confirmModal.hidden]).toEqual([false, false]);
    page.decline();
    expect([page.startScreen.hidden, page.confirmModal.hidden]).toEqual([false, true]);
    expect(page.progress.view().hasProgress).toBe(true);
    page.newGame();
    page.confirm();
    expect(page.started).toEqual(['one']);
    expect(page.progress.view().levels.map(({ isUnlocked }) => isUnlocked)).toEqual([true, false]);
  });

  test('ΣΥΝΕΧΕΙΑ restarts the level left through the menu', () => {
    const page = gamePage({ secondUnlocked: true });
    expect(page.continueButton.disabled).toBe(true);
    page.pickLevel();
    page.choose(2);
    page.openMenu();
    expect(page.continueButton.disabled).toBe(false);
    expect(page.focused()).toBe(page.continueButton);
    page.continueGame();
    expect(page.started).toEqual(['two', 'two']);
  });

  test('keeps the start screen and the level picker silent and plays the game tune in a level', () => {
    const music = vi.spyOn(Sound.prototype, 'music');
    const page = gamePage({ secondUnlocked: true });
    expect(music).toHaveBeenLastCalledWith(null);
    page.pickLevel();
    expect(music).toHaveBeenLastCalledWith(null);
    page.choose(1);
    expect(music).toHaveBeenLastCalledWith('game');
    page.openMenu();
    expect(music).toHaveBeenLastCalledWith(null);
  });

  test('Nuki blinks on the start screen 180 frames after it opens', () => {
    const page = gamePage();
    const url = (art: Art): string => `url(${artUrl(page.root as unknown as Document, art)})`;
    for (let frame = 0; frame < 179; frame++) page.frame();
    expect(page.startHero.style.getPropertyValue('--art')).toBe(url(heroArt.down.breathe));
    page.frame();
    expect(page.startHero.style.getPropertyValue('--art')).toBe(url(heroArt.down.blink!));
  });

  test('Nuki stands on the start screen as soon as it opens, before any frame, and again when it reopens mid-blink', () => {
    const page = gamePage();
    const shown = (): string => page.startHero.style.getPropertyValue('--art');
    const stand = `url(${artUrl(page.root as unknown as Document, heroArt.down.stand)})`;
    const onLoad = shown();
    // 181 frames land inside the first blink whether the opening frame counts as frame 0 or not.
    for (let frame = 0; frame < 181; frame++) page.frame();
    page.pickLevel();
    page.back();
    expect([onLoad, shown()]).toEqual([stand, stand]);
  });

  test('shows the level picker over the start screen from ΕΠΙΠΕΔΑ', () => {
    const page = gamePage({ secondUnlocked: true });
    page.pickLevel();
    expect(page.startScreen.hidden).toBe(false);
    expect(page.levelPicker.hidden).toBe(false);
    expect(page.started).toEqual([]);
  });

  test('starts the level chosen in the level picker', () => {
    const page = gamePage({ secondUnlocked: true });
    page.pickLevel();
    page.choose(2);
    expect(page.levelPicker.hidden).toBe(true);
    expect(page.startScreen.hidden).toBe(true);
    expect(page.started).toEqual(['two']);
  });

  test('returns from the level picker to the start screen with ΠΙΣΩ', () => {
    const page = gamePage({ secondUnlocked: true });
    page.pickLevel();
    page.back();
    expect(page.levelPicker.hidden).toBe(true);
    expect(page.startScreen.hidden).toBe(false);
    expect(page.started).toEqual([]);
  });

  test('returns from the level picker to the start screen with the menu switch', () => {
    const page = gamePage({ secondUnlocked: true });
    page.pickLevel();
    page.openMenu();
    expect(page.levelPicker.hidden).toBe(true);
    expect(page.startScreen.hidden).toBe(false);
    expect(page.started).toEqual([]);
  });

  test.each(['Enter', 'z'])('opens the level picker without starting a level when %s chooses ΕΠΙΠΕΔΑ', (key) => {
    const page = gamePage({ secondUnlocked: true });
    expect(page.focused()).toBe(page.pickLevelButton);
    page.menuKey(key);
    expect(page.started).toEqual([]);
    expect(page.startScreen.hidden).toBe(false);
    expect(page.levelPicker.hidden).toBe(false);
    expect(page.focused()).toBe(page.firstRow());
  });

  test.each(['Enter', 'z'])('returns to the start screen without starting a level when %s chooses ΠΙΣΩ', (key) => {
    const page = gamePage({ secondUnlocked: true });
    page.pickLevel();
    page.menuKey('ArrowDown');
    page.menuKey('ArrowDown');
    expect(page.focused()).toBe(page.backButton);
    page.menuKey(key);
    for (let step = 0; step < 16; step++) page.frame();
    expect(page.started).toEqual([]);
    expect(page.levelPicker.hidden).toBe(true);
    expect(page.startScreen.hidden).toBe(false);
    expect(page.focused()).toBe(page.pickLevelButton);
  });

  test('returns to the start screen from the menu switch', () => {
    const page = gamePage();
    page.newGame();
    page.walkUpUntil(() => page.announcement.textContent === messages.colorsBack);
    page.openMenu();
    expect(page.startScreen.hidden).toBe(false);
    expect(page.announcement.textContent).toBe('');
    page.frame();
    expect(page.announcement.textContent).toBe('');
    expect(page.started).toEqual(['one']);
  });

  test('opens the menu during the magical arrival and replays the arrival on the next start', () => {
    const arrival = vi.spyOn(Sound.prototype, 'arrival');
    const page = gamePage({ arrives: true });
    page.newGame();
    page.frame();
    page.frame();
    page.openMenu();
    expect(page.startScreen.hidden).toBe(false);
    page.newGame();
    page.confirm();
    expect(page.started).toEqual(['one', 'one']);
    expect(arrival).toHaveBeenCalledTimes(2);
  });

  test('silences the key hum when the menu switch leaves the level', () => {
    const hum = vi.spyOn(Sound.prototype, 'hum');
    const page = gamePage();
    page.newGame();
    page.walkUpUntil(() => (hum.mock.lastCall?.[0] ?? 0) > 0);
    page.openMenu();
    expect(hum).toHaveBeenLastCalledWith(0);
    page.frame();
    expect(hum).toHaveBeenLastCalledWith(0);
  });

  test('shows the end screen after completing the last level, then the start screen with ΣΥΝΕΧΕΙΑ disabled', () => {
    const page = gamePage({ secondUnlocked: true });
    page.pickLevel();
    page.choose(2);
    page.completeLevel();
    expect(page.endScreen.hidden).toBe(false);
    expect(page.startScreen.hidden).toBe(true);
    for (let frame = 0; frame < 120 + endScreenFadeLength; frame++) page.frame();
    expect(page.endScreen.hidden).toBe(true);
    expect(page.startScreen.hidden).toBe(false);
    expect(page.continueButton.disabled).toBe(true);
    expect(page.focused()).toBe(page.pickLevelButton);
    expect(page.started).toEqual(['two']);
  });

  test('a held key repeating on the end screen leaves it no earlier, and Escape leaves through the fade', () => {
    const page = gamePage({ secondUnlocked: true });
    page.pickLevel();
    page.choose(2);
    page.completeLevel();
    const repeat = Object.assign(new Event('keydown', { cancelable: true }), { key: 'ArrowUp', repeat: true });
    page.root.dispatchEvent(repeat);
    for (let frame = 0; frame < endScreenFadeLength; frame++) page.frame();
    expect(page.endScreen.hidden).toBe(false);
    page.menuKey('Escape');
    expect(page.endScreen.hidden).toBe(false);
    for (let frame = 0; frame < endScreenFadeLength; frame++) page.frame();
    expect(page.startScreen.hidden).toBe(false);
  });

  test('any touch on the end screen starts its fade at once', () => {
    const page = gamePage({ secondUnlocked: true });
    page.pickLevel();
    page.choose(2);
    page.completeLevel();
    page.root.dispatchEvent(new Event('pointerdown'));
    for (let frame = 0; frame < endScreenFadeLength; frame++) page.frame();
    expect(page.startScreen.hidden).toBe(false);
  });

  test('announces the message of the level being played', () => {
    const page = gamePage();
    page.newGame();
    page.frame();
    expect(page.announcement.textContent).toBe('');
    page.walkUpUntil(() => page.announcement.textContent === messages.colorsBack);
    page.completeLevel();
    page.frame();
    expect(page.started).toEqual(['one', 'two']);
    expect(page.announcement.textContent).toBe('');
    page.walkUpUntil(() => page.announcement.textContent === messages.colorsBack);
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
  const pose = subject.normalAnimator.pose(level.hero, subject.frames);
  const scene = { level, frame: subject.frames, hero: pose };
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
  test.each(['walking', 'idle'] as const)('paints the normal %s hero pose after key pickup', (motion) => {
    const subject = gameSession();
    subject.walkUntil(Direction.Right, () => subject.level.keys.length === 0);
    if (motion === 'idle') subject.tick();
    expect(unexpectedHeroPixels(subject, 0, 32)).toBe(0);
  });

  test.each(['walking', 'idle'] as const)('paints no key above the %s hero after pickup', (motion) => {
    const subject = gameSession();
    subject.walkUntil(Direction.Right, () => subject.level.keys.length === 0);
    if (motion === 'idle') subject.tick();
    expect(unexpectedHeroPixels(subject, 18, 18)).toBe(0);
  });

  test.each([false, true])(
    'paints spreading colors with the normal hero and message, interrupted: %s',
    (interrupted) => {
      const subject = interrupted
        ? gameSession([Key.at(TilePosition.at(1, 0), leftHalf), Key.at(TilePosition.at(2, 0), rightHalf)])
        : gameSession();
      const keys = subject.level.keys;
      const key = keys.at(-1)!;
      const restored = interrupted ? [keys[0]!.restores] : [];
      subject.walkUntil(Direction.Right, () => subject.level.keys.length < keys.length);
      const firstPickupFrame = subject.frames - 1;
      if (interrupted) {
        subject.walkUntil(Direction.Right, () => subject.level.keys.length === 0);
        expect(subject.frames - 1 - firstPickupFrame).toBeLessThan(
          restorationLength(subject.level.scenery.size, keys[0]!.position),
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
        hero: subject.normalAnimator.pose(level.hero, subject.frames),
      };
      new WorldPainter(level).paintRestoring(expected, scene, key.position, subject.frames - pickupFrame, restored, [
        ...restored,
        key.restores,
      ]);
      const congratulations = new MessageBox();
      congratulations.show(messages.colorsBack, pickupFrame);
      congratulations.paint(expected, subject.frames);
      subject.session.paint(actual);
      expect(pixelDifference(actual, expected)).toBeUndefined();
    },
  );

  test('keeps the first area colored after a second key interrupts its restoration and finishes spreading', () => {
    const subject = gameSession([Key.at(TilePosition.at(1, 0), leftHalf), Key.at(TilePosition.at(2, 0), rightHalf)]);
    const [first, second] = subject.level.keys;
    subject.walkUntil(Direction.Right, () => subject.level.keys.length === 1);
    const firstPickupFrame = subject.frames - 1;
    subject.walkUntil(Direction.Right, () => subject.level.keys.length === 0);
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
    const key = subject.level.keys[0]!;
    subject.walkUntil(Direction.Right, () => subject.level.keys.length === 0);
    const pickupFrame = subject.frames - 1;
    subject.move(Direction.Right);
    subject.walkUntil(Direction.Up, () => subject.level.isComplete);
    const completedFrame = subject.frames - 1;
    expect(completedFrame - pickupFrame).toBeLessThan(restorationLength(subject.level.scenery.size, key.position));
    const playthrough = { playFrames: completedFrame, starsCollected: 0, starCount: 0 };
    expect(subject.progress.complete).toHaveBeenCalledExactlyOnceWith(subject.level.id, playthrough);
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
          hero: subject.normalAnimator.pose(level.hero, subject.frames),
        },
        elapsed,
      );
      subject.session.paint(actual);
      expect(pixelDifference(actual, expected)).toBeUndefined();
      expect(subject.report.completed).not.toHaveBeenCalled();
      expect(subject.progress.complete).toHaveBeenCalledOnce();
    }
    subject.tick();
    expect(subject.report.completed).toHaveBeenCalledOnce();
    expect(subject.progress.complete).toHaveBeenCalledOnce();
  });

  test('paints the current closing fixture unchanged', async () => {
    const subject = gameSession();
    for (let tile = 0; tile < 3; tile++) subject.move(Direction.Right);
    for (let tile = 0; tile < 5; tile++) subject.move(Direction.Up);
    subject.advance(closingLength / 2);
    expect(await paintedChecksum(subject)).toBe('f07d9a6b383c9aa9fbbd87b96c78c728635b889bdf9ef611d4acc205f8666f3b');
  });

  test('paints the current ended fixture unchanged', async () => {
    const subject = gameSession();
    for (let tile = 0; tile < 3; tile++) subject.move(Direction.Right);
    for (let tile = 0; tile < 5; tile++) subject.move(Direction.Up);
    subject.advance(closingLength);
    expect(await paintedChecksum(subject)).toBe('b0e49ba2a219b20e3667492745d5a2c174cd71b7e40425753260c1d6e7cfbdb3');
  });
});

test.each([
  [0, 1],
  [2, 0.5],
  [4, 0],
  [6, 0],
])('a key %i tiles away hums at volume %d', (distance, volume) => {
  const restores = Area.of([TilePosition.at(0, 0)]);
  const level = {
    keys: [Key.at(TilePosition.at(distance, 0), restores)],
    hero: { position: TilePosition.at(0, 0) },
  } as unknown as LevelView;
  expect(humVolume(level)).toBe(volume);
});

describe('a boulder in the game session', () => {
  function boulderSession() {
    const id = LevelId.of('bouldered');
    const held = new Set<'a' | 'b'>();
    let heading: Heading | null = null;
    const controls = {
      takePress: vi.fn((_button: 'a' | 'b') => false),
      isHeld: vi.fn((button: 'a' | 'b') => held.has(button)),
      heading: vi.fn<() => Heading | null>(() => heading),
    };
    const sound = {
      star: vi.fn(),
      key: vi.fn(),
      hum: vi.fn(),
      door: vi.fn(),
      footstep: vi.fn(),
      restoring: vi.fn(),
      arrival: vi.fn(),
      gate: vi.fn(),
      plate: vi.fn(),
    };
    const level = levelFromLayout(
      id,
      ['.DDD.', 'K....', '.....', '..O..', '..H..', '.....'],
      keepOrder,
      check2dObstacles,
      {
        keys: { K: { restores: () => true } },
      },
    );
    const session = new GameSession(
      { id, start: () => new PlayLevel(new InMemoryLevelRepository([level])) },
      controls,
      sound,
      { reach: vi.fn(), complete: vi.fn() },
      { completed: vi.fn() },
    );
    return {
      session,
      held,
      walk(direction: Direction | null): void {
        heading = direction && Heading.of(direction);
      },
      tick(count: number): void {
        for (let frame = 0; frame < count; frame++) session.tick();
      },
    };
  }

  test('enables only A in a level with a boulder', () => {
    expect(boulderSession().session.uses('a')).toBe(true);
    expect(boulderSession().session.uses('b')).toBe(false);
  });

  test('holding A alone only grips the boulder and moves nothing', () => {
    const subject = boulderSession();
    subject.held.add('a');
    subject.tick(40);
    expect(subject.session.level.isGripping).toBe(true);
    expect(subject.session.level.boulders[0]?.position).toEqual(TilePosition.at(2, 3));
    expect(subject.session.level.hero.position).toEqual(TilePosition.at(2, 4));
  });

  test('keeps the boulder and her moving without a pause between tiles while she holds A and a direction', () => {
    const subject = boulderSession();
    subject.held.add('a');
    subject.walk(Direction.Up);
    const walking: boolean[] = [];
    for (let frame = 0; frame < 32; frame++) {
      subject.tick(1);
      walking.push(subject.session.level.hero.isWalking);
    }
    expect(walking.every(Boolean)).toBe(true);
    expect(subject.session.level.boulders[0]?.position).toEqual(TilePosition.at(2, 1));
  });

  test('lets go as soon as A is released, even while the colors come back', () => {
    const id = LevelId.of('gripped');
    let heldA = true;
    let heading: Heading | null = Heading.of(Direction.Down);
    const level = levelFromLayout(
      id,
      ['.DDD.', '.....', '.....', '..O..', '..H..', '..K..', '.....'],
      keepOrder,
      check2dObstacles,
      {
        keys: { K: { restores: () => true } },
      },
    );
    const session = new GameSession(
      { id, start: () => new PlayLevel(new InMemoryLevelRepository([level])) },
      {
        takePress: vi.fn(() => false),
        isHeld: vi.fn((button: 'a' | 'b') => button === 'a' && heldA),
        heading: vi.fn(() => heading),
      },
      {
        star: vi.fn(),
        key: vi.fn(),
        hum: vi.fn(),
        door: vi.fn(),
        footstep: vi.fn(),
        restoring: vi.fn(),
        arrival: vi.fn(),
        gate: vi.fn(),
        plate: vi.fn(),
      },
      { reach: vi.fn(), complete: vi.fn() },
      { completed: vi.fn() },
    );
    for (let frame = 0; frame < 16; frame++) session.tick();
    expect(session.level.keys).toHaveLength(0);
    heldA = false;
    session.tick();
    expect(session.level.isGripping).toBe(false);
    const boulder = session.level.boulders[0]?.position;
    for (let frame = 0; frame < 40; frame++) session.tick();
    expect(session.level.boulders[0]?.position).toEqual(boulder);
  });

  test('asks A to wobble only while she faces the boulder from beside it and has not gripped it', () => {
    const subject = boulderSession();
    expect(subject.session.prompts('a')).toBe(true);
    expect(subject.session.prompts('b')).toBe(false);
    subject.held.add('a');
    subject.tick(1);
    expect(subject.session.prompts('a')).toBe(false);
    subject.held.delete('a');
    subject.tick(1);
    expect(subject.session.prompts('a')).toBe(true);
  });
});

describe('a pressure plate in the game session', () => {
  const besideGate = ['.DDDWW', '....F.', '..P.G.', '..OHFK', '....FF', '......'];
  const belowBoulder = ['.DDDWW', '....F.', '..P.G.', '..O.FK', '..H.FF', '......'];
  const besidePlate = ['.DDDWW', '....F.', '..PHG.', '..O.FK', '....FF', '......'];

  function platedSession(rows: readonly string[]) {
    const id = LevelId.of('plated');
    let heading: Heading | null = null;
    const pressed = new Set<'a' | 'b'>();
    const held = new Set<'a' | 'b'>();
    const controls = {
      takePress: vi.fn((button: 'a' | 'b') => pressed.delete(button)),
      isHeld: vi.fn((button: 'a' | 'b') => held.has(button)),
      heading: vi.fn<() => Heading | null>(() => heading),
    };
    const sound = {
      star: vi.fn(),
      key: vi.fn(),
      hum: vi.fn(),
      door: vi.fn(),
      footstep: vi.fn(),
      restoring: vi.fn(),
      arrival: vi.fn(),
      gate: vi.fn(),
      plate: vi.fn(),
    };
    const level = levelFromLayout(id, rows, keepOrder, check2dObstacles, {
      keys: { K: { restores: () => true } },
    });
    const session = new GameSession(
      { id, start: () => new PlayLevel(new InMemoryLevelRepository([level])) },
      controls,
      sound,
      { reach: vi.fn(), complete: vi.fn() },
      { completed: vi.fn() },
    );
    return {
      session,
      sound,
      pressed,
      held,
      walk(direction: Direction | null): void {
        heading = direction && Heading.of(direction);
      },
      tick(count: number): void {
        for (let frame = 0; frame < count; frame++) session.tick();
      },
    };
  }

  test('tells her the gate does not open when she tries it while the plate is empty', () => {
    const subject = platedSession(besideGate);
    subject.pressed.add('a');
    subject.tick(1);
    expect(subject.session.messageText).toBe(messages.gateStuck);
    expect(subject.session.level.gates[0]?.state).toBe('closed');
    expect(subject.sound.gate).not.toHaveBeenCalled();
  });

  test('swings the gate open by itself once she pushes the boulder onto the plate', () => {
    const subject = platedSession(belowBoulder);
    subject.held.add('a');
    subject.walk(Direction.Up);
    subject.tick(1);
    subject.walk(null);
    subject.tick(20);
    subject.held.delete('a');
    expect(subject.sound.gate).toHaveBeenCalledOnce();
    subject.tick(gateSwingLength);
    expect(subject.session.level.gates[0]?.state).toBe('open');
  });

  test('never closes the gate onto her when she steps on the plate and straight back off toward the gate', () => {
    const subject = platedSession(besidePlate);
    subject.walk(Direction.Left);
    for (let tick = 0; tick < 40 && subject.session.level.gates[0]?.state === 'closed'; tick++) subject.tick(1);
    subject.walk(Direction.Right);
    subject.tick(3 * gateSwingLength);
    const { gates, hero } = subject.session.level;
    expect(gates[0]?.state).toBe('closed');
    expect(hero.position).toEqual(TilePosition.at(3, 2));
  });

  test('clicks as she steps on and off the plate and swings the gate while she keeps walking', () => {
    const subject = platedSession(besidePlate);
    subject.walk(Direction.Left);
    subject.tick(20);
    subject.walk(null);
    expect(subject.sound.plate).toHaveBeenCalledExactlyOnceWith(true);
    expect(subject.sound.gate).toHaveBeenCalledOnce();
    expect(subject.session.level.gates[0]?.state).toBe('opening');
    subject.tick(gateSwingLength);
    expect(subject.session.level.gates[0]?.state).toBe('open');
    subject.walk(Direction.Right);
    subject.tick(20);
    expect(subject.sound.plate).toHaveBeenLastCalledWith(false);
    expect(subject.session.level.hero.position).toEqual(TilePosition.at(3, 2));
    subject.tick(gateSwingLength);
    expect(subject.session.level.gates[0]?.state).toBe('closed');
  });
});
