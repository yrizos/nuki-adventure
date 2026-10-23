import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Area, Orb } from '../../level/domain/collectibles';
import { Direction, Heading, TilePosition } from '../../level/domain/position';
import { Door } from '../../level/domain/door';
import { Ground, LevelSize, Scenery } from '../../level/domain/scenery';
import { LevelId } from '../../level/domain/level-id';
import { type LevelView } from '../../level/application/level-view';
import { PlayLevel } from '../../level/application/play-level';
import { Level } from '../../level/domain/level';
import { ManageProgress, type SuspendedRun } from '../../progress/application/manage-progress';
import { check2dObstacles } from '../../level/infrastructure/check2d-obstacles';
import { levelFromLayout } from '../../level/content/level-layout';
import { secondLevel, secondLevelId } from '../../level/content/second';
import { keepOrder, lowestRoll } from '../../level/testing/draws';
import { pathTo, same } from '../../level/testing/walk-level';
import type { PlacedOrb } from '../../level/domain/level-snapshot';
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
import { startGame } from './game';
import { artUrl } from '../graphics/canvas-art';
import { panelArt } from '../graphics/panel';
import { arrivalLength } from '../session/game-phase';
import { Sound } from '../audio/sound';
import { LevelPicker } from '../screens/level-picker';
import { titleRevealLength } from '../screens/menu-screen';
import { GameLoop } from './game-loop';
import { endScreenFadeLength } from '../screens/end-screen';
import { narration } from '../screens/intro';
import { introLength, skipLength } from '../screens/intro-timeline';
import { GameSession, humVolume, messages } from '../session/game-session';
import { HeroAnimator } from '../world/hero/hero-animator';
import { MessageBox } from '../screens/message-box';
import { lighten, Picture } from '../graphics/picture';
import { cameraPosition, heroPixels } from '../world/world-geometry';
import { WorldPainter } from '../world/painting/world-painter';
import { hintSparkleArt } from '../graphics/sprite-library';
import { wobbleBurst, wobbleEvery } from '../session/prompt-wobble';
import {
  areaRestorationLength,
  closingLength,
  doorOpeningLength,
  restorationLength,
} from '../world/transition/world-transition';

const gateSwingLength = 16;

const at = TilePosition.at;
const orbAt = (column: number, radius = 4): PlacedOrb => ({ position: at(column, 5), radius });
// Two circles stay apart only with twelve tiles between their orbs, so a level with two orbs is wider.
const twoOrbs = [orbAt(1), orbAt(13)];
const wide = LevelSize.of(15, 6);

// The page drives the joystick through the keyboard, so the touch joystick library only needs to accept listeners.
vi.mock('nipplejs', () => ({ create: () => ({ on: () => {}, destroy: () => {} }) }));

function gameSession(
  orbs: readonly PlacedOrb[] = [orbAt(1)],
  size: LevelSize = orbs.length > 1 ? wide : LevelSize.of(5, 6),
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
    orb: vi.fn(),
    hum: vi.fn(),
    door: vi.fn(),
    footstep: vi.fn(),
    restoring: vi.fn(),
    arrival: vi.fn(),
    gate: vi.fn(),
    plate: vi.fn(),
  };
  const progress = {
    reach: vi.fn<(level: LevelId) => void>(),
    complete: vi.fn(),
    suspend: vi.fn<(level: LevelId, run: SuspendedRun) => void>(),
  };
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
      orbs: orbs.map(({ position, radius }) => Orb.at(position, radius, size)),
      door: Door.closedAt(TilePosition.at(1, 0)),
      hero: { position: TilePosition.at(0, 5), facing: Direction.Right },
      obstacles: check2dObstacles,
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
    for (let frame = 0; frame < 240 && !done(); frame++) tick();
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
  test('hums beside the orb and falls silent once it is picked up', () => {
    const subject = gameSession();
    subject.tick();
    expect(subject.sound.hum.mock.lastCall![0]).toBeGreaterThan(0);
    subject.walkUntil(Direction.Right, () => subject.level.orbs.length === 0);
    expect(subject.sound.hum).toHaveBeenLastCalledWith(0);
  });

  test('hums toward whichever orb is nearest', () => {
    const subject = gameSession(twoOrbs);
    subject.tick();
    expect(subject.sound.hum.mock.lastCall![0]).toBeGreaterThan(0);
    subject.walkUntil(Direction.Right, () => subject.level.orbs.length === 1);
    subject.advance(areaRestorationLength(wide, at(1, 5), subject.level.restored[0]!));
    expect(subject.sound.hum.mock.lastCall![0]).toBe(0);
    subject.walkUntil(Direction.Right, () => subject.level.hero.position.equals(at(11, 5)));
    expect(subject.sound.hum.mock.lastCall![0]).toBeGreaterThan(0);
  });

  test('starts painting restored world colors on the orb pickup tick', () => {
    const subject = gameSession();
    const orb = subject.level.orbs[0]!;
    const painter = new WorldPainter(subject.session.level);
    subject.walkUntil(Direction.Right, () => subject.level.orbs.length === 0);
    const actual = new Picture(224, 448);
    const expected = new Picture(224, 448);
    const faded = new Picture(224, 448);
    const scene = {
      level: subject.session.level,
      frame: subject.frames,
      hero: subject.normalAnimator.pose(subject.session.level.hero, subject.frames),
    };
    painter.paintRestoring(expected, scene, orb.position, 1, [], subject.level.restored);
    painter.paint(faded, scene, []);
    subject.session.paint(actual);
    const camera = cameraPosition(scene.level, actual.width, actual.height);
    const offset =
      ((orb.position.row * 32 + 16 - camera.y) * actual.width + orb.position.column * 32 + 20 - camera.x) * 4;
    const pixel = (picture: Picture) => [...picture.pixels.subarray(offset, offset + 4)];
    expect(pixel(expected)).not.toEqual(pixel(faded));
    expect(pixel(actual)).toEqual(pixel(expected));
  });

  test('walks through an orb pickup and its restoration without slowing her down', () => {
    const subject = gameSession();
    const elsewhere = gameSession([{ position: at(4, 0), radius: 4 }]);
    subject.controls.heading.mockReturnValue(Heading.of(Direction.Right));
    elsewhere.controls.heading.mockReturnValue(Heading.of(Direction.Right));
    for (let frame = 0; frame < 80; frame++) {
      subject.tick();
      elsewhere.tick();
      expect(subject.session.level.hero.feet).toEqual(elsewhere.session.level.hero.feet);
      expect(subject.session.level.hero.isWalking).toBe(true);
    }
    expect([subject.session.level.orbs, elsewhere.session.level.orbs.length]).toEqual([[], 1]);
  });

  test('tells her on the last orb that the colors are back and the door is open', () => {
    const subject = gameSession(twoOrbs);
    subject.walkUntil(Direction.Right, () => subject.level.orbs.length === 0);
    expect(subject.session.messageText).toBe('ΤΑ ΧΡΩΜΑΤΑ ΕΠΕΣΤΡΕΨΑΝ!\nΗ ΠΟΡΤΑ ΑΝΟΙΞΕ!');
    expect(subject.sound.orb.mock.calls).toEqual([[false], [true]]);
    expect(subject.level.restored).toEqual([Area.whole(wide)]);
  });

  test('leaving while colors spread keeps the moment before the orb was picked up', () => {
    const subject = gameSession();
    subject.move(Direction.Right);
    subject.session.suspend();
    const [, { snapshot, playFrames }] = subject.progress.suspend.mock.lastCall!;
    expect(subject.level.orbs).toEqual([]);
    expect(snapshot.collectedOrbs).toEqual([]);
    expect(playFrames).toBeLessThan(subject.frames);
  });

  test('keeps walking while colors spread', () => {
    const subject = gameSession();
    subject.move(Direction.Right);
    expect(subject.sound.orb).toHaveBeenCalledOnce();
    expect(subject.session.messageText).toBe(messages.colorsBack);
    subject.move(Direction.Right);
    subject.move(Direction.Right);
    expect(subject.level.hero.position).toEqual(TilePosition.at(3, 5));
    expect(subject.sound.restoring).toHaveBeenCalledOnce();
    expect(subject.sound.footstep).toHaveBeenCalledTimes(3);
  });

  test('plays on once the circle of an orb has spread, long before the whole level would have', () => {
    const subject = gameSession(twoOrbs);
    subject.walkUntil(Direction.Right, () => subject.level.orbs.length === 1);
    const circle = areaRestorationLength(wide, at(1, 5), subject.level.restored[0]!);
    expect(circle).toBeLessThan(restorationLength(wide, at(1, 5)));
    subject.advance(circle + 1);
    subject.session.suspend();
    expect(subject.progress.suspend.mock.lastCall![1].playFrames).toBe(subject.frames);
  });

  test('opens the door only once color has drawn it open from the last orb, however long ago the first was taken', () => {
    const subject = gameSession(twoOrbs);
    const { door, scenery } = subject.level;
    const [first, second] = subject.level.orbs;
    subject.walkUntil(Direction.Right, () => subject.level.orbs.length === 1);
    expect(subject.session.messageText).toBe('');
    subject.advance(restorationLength(scenery.size, first!.position));
    expect(subject.level.door.isOpen).toBe(false);
    subject.walkUntil(Direction.Right, () => subject.level.orbs.length === 0);
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
    orb: vi.fn(),
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
    ['.DDD.', '..Q..', '.....', 'WFGFW', '..H..', '.....'],
    keepOrder,
    check2dObstacles,
    lowestRoll,
  );
  const progress = { reach: vi.fn(), complete: vi.fn(), suspend: vi.fn<(level: LevelId, run: SuspendedRun) => void>() };
  const session = new GameSession(
    { id, start: () => new PlayLevel(new InMemoryLevelRepository([level])), arrives },
    controls,
    sound,
    progress,
    { completed: vi.fn() },
  );
  const tick = (count = 1): void => {
    for (let frame = 0; frame < count; frame++) session.tick();
  };
  return {
    session,
    controls,
    sound,
    progress,
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
      start: () => new PlayLevel(new InMemoryLevelRepository([secondLevel(keepOrder, check2dObstacles, lowestRoll)])),
    },
    { takePress: vi.fn(), isHeld: vi.fn(), heading: vi.fn() },
    {
      orb: vi.fn(),
      hum: vi.fn(),
      door: vi.fn(),
      footstep: vi.fn(),
      restoring: vi.fn(),
      arrival: vi.fn(),
      gate: vi.fn(),
      plate: vi.fn(),
    },
    { reach: vi.fn(), complete: vi.fn(), suspend: vi.fn() },
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

  test('leaving while it swings keeps the moment before A was pressed until the swing ends', () => {
    const subject = gatedSession();
    const saved = () => {
      subject.session.suspend();
      const [, { snapshot, playFrames }] = subject.progress.suspend.mock.lastCall!;
      return [snapshot.gates, playFrames];
    };
    subject.tick(3);
    expect(saved()).toEqual([['closed'], 3]);
    subject.press('a');
    expect(saved()).toEqual([['closed'], 3]);
    subject.tick(gateSwingLength - 2);
    expect(saved()).toEqual([['closed'], 3]);
    subject.tick();
    expect(saved()).toEqual([['open'], 4 + gateSwingLength - 1]);
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

  test('counts the prompt from the frame it starts and points the hint sparkle at the gate, a step per part of each burst', () => {
    const subject = gatedSession();
    const paint = vi.spyOn(WorldPainter.prototype, 'paint').mockImplementation(() => undefined);
    const hint = (): unknown => {
      subject.session.paint(new Picture(224, 224));
      return paint.mock.lastCall![1].hint;
    };
    const at = subject.session.level.gates[0]!.position;
    const stepLength = wobbleBurst / hintSparkleArt.length;
    const hints: unknown[] = [];
    for (let age = 0; age <= wobbleEvery + 1; age++) {
      subject.tick();
      hints.push(hint());
    }
    expect(subject.session.promptAge('a')).toBe(wobbleEvery + 1);
    const ages = [
      0,
      stepLength - 1,
      stepLength,
      wobbleBurst - 1,
      wobbleBurst,
      wobbleEvery - 1,
      wobbleEvery,
      wobbleEvery + 1,
    ];
    expect(ages.map((age) => hints[age])).toEqual([
      { at, step: 0 },
      { at, step: 0 },
      { at, step: 1 },
      { at, step: hintSparkleArt.length - 1 },
      undefined,
      undefined,
      { at, step: 0 },
      { at, step: 0 },
    ]);
    subject.press('a');
    subject.tick();
    expect([subject.session.promptAge('a'), hint()]).toEqual([null, undefined]);
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
  test('is played from the arrival through the gate, to every orb and out of the door into the next level', () => {
    const pressed = new Set<'a' | 'b'>();
    let heading: Heading | null = null;
    const controls = {
      takePress: (button: 'a' | 'b') => pressed.delete(button),
      isHeld: () => false,
      heading: () => heading,
    };
    const sound = {
      orb: vi.fn(),
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
        start: () => new PlayLevel(new InMemoryLevelRepository([secondLevel(keepOrder, check2dObstacles, lowestRoll)])),
        arrives: true,
      },
      controls,
      sound,
      { reach: vi.fn(), complete: vi.fn(), suspend: vi.fn() },
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
    expect(sound.orb).toHaveBeenCalled();
    while (session.level.orbs.length > 0) {
      const next = session.level.orbs[0]!.position;
      walkTo((tile) => tile.equals(next));
    }
    expect(sound.orb).toHaveBeenLastCalledWith(true);
    for (let frame = 0; frame < 600 && !session.level.door.isOpen; frame++) session.tick();
    expect(session.level.door.isOpen).toBe(true);
    walkTo((tile) => session.level.door.covers(tile));
    expect(sound.door).toHaveBeenCalledOnce();
    for (let frame = 0; frame <= closingLength; frame++) session.tick();
    expect(report.completed).toHaveBeenCalledOnce();
  });
});

describe('the magical arrival', () => {
  const arriving = (orbs: readonly PlacedOrb[] = [orbAt(1)]) => gameSession(orbs, undefined, true);

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
    const subject = arriving([{ position: at(0, 4), radius: 4 }]);
    subject.controls.heading.mockReturnValue(Heading.of(Direction.Up));
    subject.advance(arrivalLength);
    expect(subject.level.orbs).toHaveLength(1);
    expect(subject.sound.orb).not.toHaveBeenCalled();
    subject.walkUntil(Direction.Up, () => subject.level.orbs.length === 0);
  });

  test('keeps its frames out of the play time', () => {
    const subject = arriving();
    subject.advance(arrivalLength);
    for (let tile = 0; tile < 3; tile++) subject.move(Direction.Right);
    for (let tile = 0; tile < 5; tile++) subject.move(Direction.Up);
    const completedAt = subject.frames;
    subject.advance(closingLength);
    const playthrough = { playFrames: completedAt - 1 - arrivalLength };
    expect(subject.progress.complete).toHaveBeenCalledExactlyOnceWith(subject.level.id, playthrough);
  });
});

// Read before any test spies on it, so a second page in one test does not wrap the first page's spy.
const drawMap = Reflect.get(LevelPicker.prototype, 'map') as (...args: unknown[]) => unknown;

function gamePage({ secondUnlocked = false, arrives = false, sideOrb = false, storage = memoryStorage() } = {}) {
  FakeDocument.stubGlobals();
  const sounds = audioWindow();
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
    'menu-screen',
    'menu-title',
    'menu-confetti',
    'menu-sparkles',
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
    ['menu-screen', ['menu-continue', 'menu-pick-level', 'menu-new-game']],
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
  for (const menu of ['menu-screen', 'confirm-modal', 'end-screen', 'level-picker-screen'])
    elements.get(menu)!.hidden = true;
  const started: string[] = [];
  const cardsDrawn: string[] = [];
  const plays: PlayLevel[] = [];
  // The level picker builds a level to draw its card, which starts no session.
  let drawingCard = false;
  vi.spyOn(LevelPicker.prototype as unknown as { map: typeof drawMap }, 'map').mockImplementation(function (
    this: unknown,
    ...args
  ) {
    drawingCard = true;
    try {
      return drawMap.apply(this, args);
    } finally {
      drawingCard = false;
    }
  });
  const playable = (name: string) => {
    const id = LevelId.of(name);
    return {
      id,
      arrives,
      start: () => {
        (drawingCard ? cardsDrawn : started).push(name);
        // A second orb lies a step to the right of the start, with the first moved far enough away for both circles.
        const size = LevelSize.of(sideOrb ? 16 : 3, 5);
        const orbs = sideOrb ? [at(2, 4), at(15, 1)] : [at(1, 3)];
        const play = new PlayLevel(
          new InMemoryLevelRepository([
            Level.create({
              id,
              scenery: Scenery.of(
                size,
                Array.from({ length: 5 }, () => Array<Ground>(size.columns).fill(Ground.Path)),
                [],
                [],
              ),
              stones: [],
              orbs: orbs.map((position) => Orb.at(position, 4, size)),
              door: Door.closedAt(TilePosition.at(0, 0)),
              hero: { position: TilePosition.at(1, 4), facing: Direction.Up },
              obstacles: check2dObstacles,
            }),
          ]),
        );
        if (!drawingCard) plays.push(play);
        return play;
      },
    };
  };
  const levels = [playable('one'), playable('two')];
  const progress = new ManageProgress(
    new LocalProgressRepository(storage),
    levels.map(({ id }) => id),
  );
  if (secondUnlocked) progress.complete(levels[0]!.id, { playFrames: 60 });
  startGame(root as unknown as Document, levels, progress, () => 1);
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
  const touch = (type: 'pointerdown' | 'pointerup'): void =>
    void root.body.dispatchEvent(Object.assign(new Event(type), { pointerId: 1 }));
  const visibility = (state: 'hidden' | 'visible'): void => {
    Object.defineProperty(root, 'visibilityState', { value: state, configurable: true });
    root.dispatchEvent(new Event('visibilitychange'));
  };
  return {
    root,
    heard: (): number[] => sounds.audio()?.heard() ?? [],
    unlockSound: (): void => void display.window.dispatchEvent(new Event('pointerup')),
    started,
    cardsDrawn,
    frame,
    frames(count: number): void {
      for (let step = 0; step < count; step++) frame();
    },
    hold(name: string, count: number): void {
      key('keydown', name);
      for (let step = 0; step < count; step++) frame();
      key('keyup', name);
    },
    // A hidden page gets no animation frames, so its clock simply jumps ahead when it is shown again.
    hide: (): void => visibility('hidden'),
    show(milliseconds: number): void {
      now += milliseconds;
      visibility('visible');
    },
    pageHide: (): void => void display.window.dispatchEvent(new Event('pagehide')),
    get level(): LevelView {
      return plays.at(-1)!.view(LevelId.of(started.at(-1)!));
    },
    announcement,
    screen: elements.get('screen')!,
    canvas: view.children[0] as FakeCanvasElement,
    menuScreen: elements.get('menu-screen')!,
    confirmModal: elements.get('confirm-modal')!,
    endScreen: elements.get('end-screen')!,
    continueButton: elements.get('menu-continue')!,
    continueGame: (): void => (elements.get('menu-continue') as FakeHTMLElement).click(),
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
    levelPicker: elements.get('level-picker-screen')!,
    newGame: (): void => (elements.get('menu-new-game') as FakeHTMLElement).click(),
    touch,
    skipIntro(): void {
      touch('pointerdown');
      for (let step = 0; step < skipLength; step++) frame();
      touch('pointerup');
    },
    // The level picker answers only once it has dithered in, and is gone only once it has dithered out.
    pickLevel: (): void => {
      (elements.get('menu-pick-level') as FakeHTMLElement).click();
      for (let step = 0; step < 16; step++) frame();
    },
    back: (): void => {
      (elements.get('level-picker-back') as FakeHTMLElement).click();
      for (let step = 0; step < 16; step++) frame();
    },
    focused: (): FakeElement | null => root.activeElement,
    pickLevelButton: elements.get('menu-pick-level')!,
    backButton: elements.get('level-picker-back')!,
    newGameButton: elements.get('menu-new-game')!,
    firstRow: (): FakeElement => root.querySelectorAll('.level-row')[0]!,
    menuKey: (name: string): void => {
      const event = Object.assign(new Event('keydown', { cancelable: true }), { key: name, repeat: false });
      display.captureOnWindow(event);
      root.dispatchEvent(event);
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

// Sounds are compared with what Sound itself plays, so retuning one never breaks a test about when it plays.
function heardFrom(play: (sound: Sound) => void): number[] {
  const reference = audioWindow();
  const sound = new Sound(reference.root);
  reference.interact();
  play(sound);
  return reference.audio()!.heard();
}

describe('the game page', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test.each([false, true])('opens on the menu screen without the intro when progress saved is %s', (secondUnlocked) => {
    const page = gamePage({ secondUnlocked });
    expect(page.menuScreen.hidden).toBe(false);
    expect(page.screen.classList.contains('intro-open')).toBe(false);
    page.frame();
    expect(page.announcement.textContent).toBe('');
  });

  test.each([
    ['.button-a', 'button-a'],
    ['.button-b', 'button-b'],
    ['.menu-continue', 'continue'],
    ['.menu-pick-level', 'pick-level'],
    ['.level-picker-up', 'scroll-up'],
    ['.level-picker-down', 'scroll-down'],
  ])('a disabled %s shows the faded %s art', (selector, name) => {
    const page = gamePage();
    const style = readFileSync(new URL('./style.css', import.meta.url), 'utf8');
    expect(style).toContain(`${selector}:disabled {\n  --art: var(--art-${name}-faded);\n}`);
    expect(page.screen.style.getPropertyValue(`--art-${name}-faded`)).toBe(
      `url(${artUrl(page.root as unknown as Document, panelArt[name]!, 'faded')})`,
    );
  });

  test('draws every control from palette art, with no filter', () => {
    expect(readFileSync(new URL('./style.css', import.meta.url), 'utf8')).not.toMatch(/filter:/);
  });

  test('a menu button ticks when pressed', () => {
    const page = gamePage({ secondUnlocked: true });
    page.unlockSound();
    page.pickLevel();
    const before = page.heard().length;
    (page.root.querySelector('.level-picker-back') as FakeHTMLElement).click();
    expect(page.heard().slice(before)).toEqual(heardFrom((sound) => sound.press()));
  });

  test('a level card ticks when pressed, even while the level picker dithers in', () => {
    const page = gamePage({ secondUnlocked: true });
    page.unlockSound();
    page.pickLevelButton.click();
    const before = page.heard().length;
    (page.root.querySelectorAll('.level-row')[0] as FakeHTMLElement).click();
    expect(page.heard().slice(before)).toEqual(heardFrom((sound) => sound.press()));
  });

  test('a menu key unlocks sound, so the button it chooses ticks', () => {
    const page = gamePage({ secondUnlocked: true });
    page.menuKey('ArrowDown');
    page.menuKey('Enter');
    expect(page.heard()).toEqual(heardFrom((sound) => (sound.press(), sound.rise())));
  });

  test.each([
    ['level picker', (page: ReturnType<typeof gamePage>) => page.pickLevelButton.click()],
    ['confirmation', (page: ReturnType<typeof gamePage>) => page.newGame()],
  ])('the %s rises as it opens', (_, open) => {
    const page = gamePage({ secondUnlocked: true });
    page.unlockSound();
    open(page);
    expect(page.heard()).toEqual(heardFrom((sound) => (sound.press(), sound.rise())));
  });

  test('plays the intro from ΝΕΟ ΠΑΙΧΝΙΔΙ with every control hidden when no progress is saved, then level one once it ends', () => {
    const page = gamePage();
    page.newGame();
    expect(page.menuScreen.hidden).toBe(true);
    expect(page.confirmModal.hidden).toBe(true);
    expect(page.screen.classList.contains('intro-open')).toBe(true);
    for (let frame = 1; frame < introLength; frame++) page.frame();
    expect(page.started).toEqual([]);
    page.frame();
    expect(page.started).toEqual(['one']);
    expect(page.menuScreen.hidden).toBe(true);
    expect(page.screen.classList.contains('intro-open')).toBe(false);
  });

  test('paints the intro on the game view and announces its narration', () => {
    const page = gamePage();
    page.newGame();
    page.frame();
    expect(page.canvas.context.shown).not.toBeNull();
    expect(page.announcement.textContent).toBe(narration[0]);
  });

  test('Escape leaves the intro for the menu screen', () => {
    const page = gamePage();
    page.newGame();
    page.menuKey('Escape');
    expect(page.menuScreen.hidden).toBe(false);
    expect(page.screen.classList.contains('intro-open')).toBe(false);
    expect(page.started).toEqual([]);
  });

  test('a touch held through the whole skip leaves the intro for level one', () => {
    const page = gamePage();
    page.newGame();
    page.touch('pointerdown');
    for (let frame = 1; frame < skipLength; frame++) page.frame();
    expect(page.started).toEqual([]);
    page.frame();
    expect(page.started).toEqual(['one']);
    expect(page.screen.classList.contains('intro-open')).toBe(false);
  });

  test('with progress saved, ΝΕΟ ΠΑΙΧΝΙΔΙ asks first, ΟΧΙ keeps the progress and ΝΑΙ deletes it before the intro and level one', () => {
    const page = gamePage({ secondUnlocked: true });
    page.newGame();
    expect([page.menuScreen.hidden, page.confirmModal.hidden]).toEqual([false, false]);
    page.decline();
    expect([page.menuScreen.hidden, page.confirmModal.hidden]).toEqual([false, true]);
    expect(page.progress.view().hasProgress).toBe(true);
    page.newGame();
    page.confirm();
    expect(page.progress.view().levels.map(({ isUnlocked }) => isUnlocked)).toEqual([true, false]);
    expect([page.menuScreen.hidden, page.confirmModal.hidden]).toEqual([true, true]);
    expect(page.screen.classList.contains('intro-open')).toBe(true);
    expect(page.started).toEqual([]);
    page.skipIntro();
    expect(page.started).toEqual(['one']);
  });

  test('ΣΥΝΕΧΕΙΑ goes on from where she left the level through the menu, with the play time it had', () => {
    const page = gamePage({ secondUnlocked: true, sideOrb: true });
    expect(page.continueButton.disabled).toBe(true);
    page.pickLevel();
    page.choose(2);
    page.hold('ArrowRight', 20);
    page.frames(100);
    const { hero, orbs, restored } = page.level;
    expect([orbs.length, restored.length]).toEqual([1, 1]);
    page.openMenu();
    expect(page.progress.levelInProgress()?.playFrames).toBe(120);
    page.frames(30);
    expect(page.continueButton.disabled).toBe(false);
    expect(page.focused()).toBe(page.continueButton);
    page.continueGame();
    expect(page.started).toEqual(['two', 'two']);
    expect([page.level.hero.feet, page.level.hero.facing]).toEqual([hero.feet, Direction.Right]);
    expect([page.level.orbs, page.level.restored]).toEqual([orbs, restored]);
    page.frames(10);
    page.openMenu();
    expect(page.progress.levelInProgress()?.playFrames).toBe(130);
  });

  test('ΣΥΝΕΧΕΙΑ shows her where she was at once, without the magical arrival', () => {
    const arrival = vi.spyOn(Sound.prototype, 'arrival');
    const page = gamePage({ arrives: true });
    page.newGame();
    page.skipIntro();
    page.frames(arrivalLength + 5);
    page.openMenu();
    page.continueGame();
    expect(arrival).toHaveBeenCalledOnce();
    page.hold('ArrowRight', 12);
    expect(page.level.hero.feet.x).toBeGreaterThan(48);
  });

  test.each(['hide', 'pageHide'] as const)(
    'keeps her place and play time for the next visit after the page fires %s',
    (leave) => {
      const storage = memoryStorage();
      const page = gamePage({ secondUnlocked: true, sideOrb: true, storage });
      page.pickLevel();
      page.choose(2);
      page.hold('ArrowRight', 20);
      page.frames(100);
      const { hero } = page.level;
      page[leave]();
      const next = gamePage({ sideOrb: true, storage });
      next.continueGame();
      expect(next.started).toEqual(['two']);
      expect(next.level.hero.feet).toEqual(hero.feet);
      expect(next.level.restored).toHaveLength(1);
      next.openMenu();
      expect(next.progress.levelInProgress()?.playFrames).toBe(120);
    },
  );

  test('adds no play time while the page is hidden', () => {
    const page = gamePage({ secondUnlocked: true });
    page.pickLevel();
    page.choose(2);
    page.frames(10);
    page.hide();
    page.show(10_000);
    // The first frame back only restarts the clock, and the next one plays on.
    page.frames(2);
    page.openMenu();
    expect(page.progress.levelInProgress()?.playFrames).toBe(11);
  });

  test('the level picker starts the level afresh and forgets where she was', () => {
    const page = gamePage({ secondUnlocked: true, sideOrb: true });
    page.pickLevel();
    page.choose(2);
    page.hold('ArrowRight', 20);
    page.openMenu();
    page.pickLevel();
    page.choose(2);
    expect(page.level.hero.position).toEqual(TilePosition.at(1, 4));
    expect(page.level.restored).toEqual([]);
    page.openMenu();
    expect(page.progress.levelInProgress()).toBeNull();
    page.continueGame();
    expect(page.level.hero.position).toEqual(TilePosition.at(1, 4));
  });

  test('ΝΕΟ ΠΑΙΧΝΙΔΙ forgets where she was', () => {
    const page = gamePage({ sideOrb: true });
    page.newGame();
    page.skipIntro();
    page.hold('ArrowRight', 20);
    page.openMenu();
    page.newGame();
    page.confirm();
    page.skipIntro();
    expect(page.level.hero.position).toEqual(TilePosition.at(1, 4));
    expect(page.level.restored).toEqual([]);
  });

  test('leaving a level as its door closes behind her leaves nothing to resume', () => {
    const page = gamePage();
    page.newGame();
    page.skipIntro();
    page.walkUpUntil(() => page.level.isComplete);
    page.openMenu();
    expect(page.progress.levelInProgress()).toBeNull();
    page.continueGame();
    expect(page.started).toEqual(['one', 'one']);
    expect(page.level.hero.position).toEqual(TilePosition.at(1, 4));
  });

  test('keeps the menu screen and the level picker silent and plays the game tune in a level', () => {
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

  test('builds the level cards while the menu screen shows, once its title has faded in', () => {
    const page = gamePage({ secondUnlocked: true });
    page.frames(titleRevealLength - 2);
    expect(page.cardsDrawn).toEqual([]);
    page.frames(10);
    expect(page.cardsDrawn).toEqual(['one', 'two']);
    page.pickLevel();
    expect(page.cardsDrawn).toEqual(['one', 'two']);
  });

  test('builds no card for a locked level', () => {
    const page = gamePage();
    page.frames(titleRevealLength + 10);
    expect(page.cardsDrawn).toEqual(['one']);
  });

  test('shows the level picker over the menu screen from ΕΠΙΠΕΔΑ', () => {
    const page = gamePage({ secondUnlocked: true });
    page.pickLevel();
    expect(page.menuScreen.hidden).toBe(false);
    expect(page.levelPicker.hidden).toBe(false);
    expect(page.started).toEqual([]);
  });

  test('starts the level chosen in the level picker', () => {
    const page = gamePage({ secondUnlocked: true });
    page.pickLevel();
    page.choose(2);
    expect(page.levelPicker.hidden).toBe(true);
    expect(page.menuScreen.hidden).toBe(true);
    expect(page.started).toEqual(['two']);
  });

  test('returns from the level picker to the menu screen with ΠΙΣΩ', () => {
    const page = gamePage({ secondUnlocked: true });
    page.pickLevel();
    page.back();
    expect(page.levelPicker.hidden).toBe(true);
    expect(page.menuScreen.hidden).toBe(false);
    expect(page.started).toEqual([]);
  });

  test('returns from the level picker to the menu screen with the menu switch', () => {
    const page = gamePage({ secondUnlocked: true });
    page.pickLevel();
    page.openMenu();
    expect(page.levelPicker.hidden).toBe(true);
    expect(page.menuScreen.hidden).toBe(false);
    expect(page.started).toEqual([]);
  });

  test.each(['Enter', 'z'])('opens the level picker without starting a level when %s chooses ΕΠΙΠΕΔΑ', (key) => {
    const page = gamePage({ secondUnlocked: true });
    expect(page.pickLevelButton.disabled).toBe(false);
    expect(page.focused()).toBe(page.pickLevelButton);
    page.menuKey(key);
    expect(page.started).toEqual([]);
    expect(page.menuScreen.hidden).toBe(false);
    expect(page.levelPicker.hidden).toBe(false);
    expect(page.focused()).toBe(page.firstRow());
  });

  test.each(['Enter', 'z'])('returns to the menu screen without starting a level when %s chooses ΠΙΣΩ', (key) => {
    const page = gamePage({ secondUnlocked: true });
    page.pickLevel();
    page.menuKey('ArrowDown');
    page.menuKey('ArrowDown');
    expect(page.focused()).toBe(page.backButton);
    page.menuKey(key);
    for (let step = 0; step < 16; step++) page.frame();
    expect(page.started).toEqual([]);
    expect(page.levelPicker.hidden).toBe(true);
    expect(page.menuScreen.hidden).toBe(false);
    expect(page.focused()).toBe(page.pickLevelButton);
  });

  test('returns to the menu screen from the menu switch', () => {
    const page = gamePage();
    page.newGame();
    page.skipIntro();
    page.walkUpUntil(() => page.announcement.textContent === messages.colorsBack);
    page.openMenu();
    expect(page.menuScreen.hidden).toBe(false);
    expect(page.announcement.textContent).toBe('');
    page.frame();
    expect(page.announcement.textContent).toBe('');
    expect(page.started).toEqual(['one']);
  });

  test('opens the menu during the magical arrival and replays the arrival on the next start', () => {
    const arrival = vi.spyOn(Sound.prototype, 'arrival');
    const page = gamePage({ arrives: true });
    page.newGame();
    page.skipIntro();
    page.frame();
    page.frame();
    page.openMenu();
    expect(page.menuScreen.hidden).toBe(false);
    page.newGame();
    page.confirm();
    page.skipIntro();
    expect(page.started).toEqual(['one', 'one']);
    expect(arrival).toHaveBeenCalledTimes(2);
  });

  test('silences the orb hum when the menu switch leaves the level', () => {
    const hum = vi.spyOn(Sound.prototype, 'hum');
    const page = gamePage();
    page.newGame();
    page.skipIntro();
    page.walkUpUntil(() => (hum.mock.lastCall?.[0] ?? 0) > 0);
    page.openMenu();
    expect(hum).toHaveBeenLastCalledWith(0);
    page.frame();
    expect(hum).toHaveBeenLastCalledWith(0);
  });

  test('shows the end screen after completing the last level, then the menu screen with ΣΥΝΕΧΕΙΑ disabled', () => {
    const page = gamePage({ secondUnlocked: true });
    page.pickLevel();
    page.choose(2);
    page.completeLevel();
    expect(page.endScreen.hidden).toBe(false);
    expect(page.menuScreen.hidden).toBe(true);
    for (let frame = 0; frame < 120 + endScreenFadeLength; frame++) page.frame();
    expect(page.endScreen.hidden).toBe(true);
    expect(page.menuScreen.hidden).toBe(false);
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
    expect(page.menuScreen.hidden).toBe(false);
  });

  test('any touch on the end screen starts its fade at once', () => {
    const page = gamePage({ secondUnlocked: true });
    page.pickLevel();
    page.choose(2);
    page.completeLevel();
    page.root.dispatchEvent(new Event('pointerdown'));
    for (let frame = 0; frame < endScreenFadeLength; frame++) page.frame();
    expect(page.menuScreen.hidden).toBe(false);
  });

  test('announces the message of the level being played', () => {
    const page = gamePage();
    page.newGame();
    page.skipIntro();
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
  test('drops the time a hidden page was away once it rests', () => {
    const tick = vi.fn();
    const loop = new GameLoop(tick, vi.fn(), 0);
    loop.advance(10);
    loop.rest();
    loop.advance(10_000);
    expect(tick).not.toHaveBeenCalled();
    loop.advance(10_017);
    expect(tick).toHaveBeenCalledOnce();
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

async function checksum(picture: Picture): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', picture.pixels.slice());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function paintedChecksum(subject: ReturnType<typeof gameSession>): Promise<string> {
  const picture = new Picture(224, 224);
  subject.session.paint(picture);
  return checksum(picture);
}

// The painter must be made while the orb still lies in the level, because only then does it know the orb's burst and pop.
function unexpectedHeroPixels(
  subject: ReturnType<typeof gameSession>,
  above: number,
  height: number,
  pickup: { readonly painter: WorldPainter; readonly orb: TilePosition; readonly frame: number },
): number {
  const actual = new Picture(224, 448);
  const faded = new Picture(224, 448);
  const colored = new Picture(224, 448);
  const restoring = new Picture(224, 448);
  const level = subject.session.level;
  const pose = subject.normalAnimator.pose(level.hero, subject.frames);
  const scene = { level, frame: subject.frames, hero: pose };
  const { painter } = pickup;
  painter.paint(faded, scene, []);
  painter.paint(colored, scene, [Area.whole(level.scenery.size)]);
  painter.paintRestoring(restoring, scene, pickup.orb, subject.frames - pickup.frame, [], subject.level.restored);
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
      const allowed = onHero
        ? [coloredPixel, restoring.packedPixels[index]!]
        : [faded.packedPixels[index]!, coloredPixel, lighten(coloredPixel), restoring.packedPixels[index]!];
      if (!allowed.includes(shown)) unexpected++;
    }
  }
  return unexpected;
}

describe('whole frames of the game session', () => {
  test.each(['walking', 'idle'] as const)(
    'paints the normal %s hero pose and no orb above it after pickup',
    (motion) => {
      const subject = gameSession();
      const pickup = { painter: new WorldPainter(subject.session.level), orb: subject.level.orbs[0]!.position };
      subject.walkUntil(Direction.Right, () => subject.level.orbs.length === 0);
      const frame = subject.frames - 1;
      if (motion === 'idle') subject.tick();
      expect(unexpectedHeroPixels(subject, 18, 50, { ...pickup, frame })).toBe(0);
    },
  );

  test.each([false, true])(
    'paints spreading colors with the normal hero and message, after an earlier orb: %s',
    (earlier) => {
      const subject = gameSession(earlier ? twoOrbs : undefined);
      const orbs = subject.level.orbs;
      const last = orbs.at(-1)!;
      const painter = new WorldPainter(subject.session.level);
      if (earlier) {
        subject.walkUntil(Direction.Right, () => subject.level.orbs.length === 1);
        subject.advance(restorationLength(subject.level.scenery.size, orbs[0]!.position));
      }
      const restored = earlier ? [orbs[0]!.restores] : [];
      subject.walkUntil(Direction.Right, () => subject.level.orbs.length === 0);
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
      painter.paintRestoring(
        expected,
        scene,
        last.position,
        subject.frames - pickupFrame,
        restored,
        subject.level.restored,
      );
      const congratulations = new MessageBox();
      congratulations.show(messages.colorsBack, pickupFrame);
      congratulations.paint(expected, subject.frames);
      subject.session.paint(actual);
      expect(pixelDifference(actual, expected)).toBeUndefined();
    },
  );

  test('closes the colored world without a restoration message when completion interrupts spreading', () => {
    const subject = gameSession(undefined, LevelSize.of(22, 6));
    const orb = subject.level.orbs[0]!;
    subject.walkUntil(Direction.Right, () => subject.level.orbs.length === 0);
    const pickupFrame = subject.frames - 1;
    subject.move(Direction.Right);
    subject.walkUntil(Direction.Up, () => subject.level.isComplete);
    const completedFrame = subject.frames - 1;
    expect(completedFrame - pickupFrame).toBeLessThan(restorationLength(subject.level.scenery.size, orb.position));
    const playthrough = { playFrames: completedFrame };
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
    expect(subject.sound.door).toHaveBeenCalledOnce();
    subject.press('a');
    subject.advance(10);
    expect(subject.report.completed).toHaveBeenCalledOnce();
    expect(subject.createPlay).toHaveBeenCalledOnce();
  });

  test('paints the current closing fixture unchanged', async () => {
    const subject = gameSession();
    for (let tile = 0; tile < 3; tile++) subject.move(Direction.Right);
    for (let tile = 0; tile < 5; tile++) subject.move(Direction.Up);
    subject.advance(closingLength / 2);
    expect(await paintedChecksum(subject)).toBe('12f946529f740fcd24b5806d7d6746e89505f61bb09fc5810895733643d16c0e');
  });

  test('paints the current ended fixture unchanged', async () => {
    const subject = gameSession();
    for (let tile = 0; tile < 3; tile++) subject.move(Direction.Right);
    for (let tile = 0; tile < 5; tile++) subject.move(Direction.Up);
    subject.advance(closingLength);
    expect(await paintedChecksum(subject)).toBe('0a86b3b059ecd0e6b9ddfe7ac179c24182b2afb4dd636a8a34e35c70333d2105');
  });
});

test.each([
  [0, 1],
  [2, 0.5],
  [4, 0],
  [6, 0],
])('an orb %i tiles away hums at volume %d', (distance, volume) => {
  const level = {
    orbs: [Orb.at(TilePosition.at(distance, 0), 4, LevelSize.of(8, 1))],
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
      orb: vi.fn(),
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
      ['.DDD.', 'Q....', '.....', '..O..', '..H..', '.....'],
      keepOrder,
      check2dObstacles,
      lowestRoll,
    );
    const progress = {
      reach: vi.fn(),
      complete: vi.fn(),
      suspend: vi.fn<(level: LevelId, run: SuspendedRun) => void>(),
    };
    const session = new GameSession(
      { id, start: () => new PlayLevel(new InMemoryLevelRepository([level])) },
      controls,
      sound,
      progress,
      { completed: vi.fn() },
    );
    return {
      session,
      progress,
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

  test('leaving while the boulder slides keeps the moment before it started until it stops', () => {
    const subject = boulderSession();
    const saved = () => {
      subject.session.suspend();
      const [, { snapshot, playFrames }] = subject.progress.suspend.mock.lastCall!;
      return [snapshot.boulders, playFrames];
    };
    subject.tick(2);
    subject.held.add('a');
    subject.walk(Direction.Up);
    subject.tick(15);
    expect(saved()).toEqual([[TilePosition.at(2, 3)], 2]);
    subject.tick(1);
    expect(saved()).toEqual([[TilePosition.at(2, 2)], 18]);
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
      ['.DDD.', '.....', '.....', '..O..', '..H..', '..Q..', '.....'],
      keepOrder,
      check2dObstacles,
      lowestRoll,
    );
    const session = new GameSession(
      { id, start: () => new PlayLevel(new InMemoryLevelRepository([level])) },
      {
        takePress: vi.fn(() => false),
        isHeld: vi.fn((button: 'a' | 'b') => button === 'a' && heldA),
        heading: vi.fn(() => heading),
      },
      {
        orb: vi.fn(),
        hum: vi.fn(),
        door: vi.fn(),
        footstep: vi.fn(),
        restoring: vi.fn(),
        arrival: vi.fn(),
        gate: vi.fn(),
        plate: vi.fn(),
      },
      { reach: vi.fn(), complete: vi.fn(), suspend: vi.fn() },
      { completed: vi.fn() },
    );
    for (let frame = 0; frame < 16; frame++) session.tick();
    expect(session.level.orbs).toHaveLength(0);
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

  test('points the hint sparkle at the boulder she can grip', () => {
    const subject = boulderSession();
    const paint = vi.spyOn(WorldPainter.prototype, 'paint').mockImplementation(() => undefined);
    subject.tick(1);
    subject.session.paint(new Picture(224, 224));
    expect(paint.mock.lastCall![1].hint?.at).toEqual(subject.session.level.boulders[0]!.position);
  });
});

describe('a pressure plate in the game session', () => {
  const besideGate = ['.DDDWW', '....F.', '..P.G.', '..OHFQ', '....FF', '......'];
  const belowBoulder = ['.DDDWW', '....F.', '..P.G.', '..O.FQ', '..H.FF', '......'];
  const besidePlate = ['.DDDWW', '....F.', '..PHG.', '..O.FQ', '....FF', '......'];

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
      orb: vi.fn(),
      hum: vi.fn(),
      door: vi.fn(),
      footstep: vi.fn(),
      restoring: vi.fn(),
      arrival: vi.fn(),
      gate: vi.fn(),
      plate: vi.fn(),
    };
    const level = levelFromLayout(id, rows, keepOrder, check2dObstacles, lowestRoll);
    const session = new GameSession(
      { id, start: () => new PlayLevel(new InMemoryLevelRepository([level])) },
      controls,
      sound,
      { reach: vi.fn(), complete: vi.fn(), suspend: vi.fn() },
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
