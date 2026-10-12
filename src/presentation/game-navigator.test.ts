import { describe, expect, test, vi } from 'vitest';
import type { LevelView } from '../application/level-view';
import { ManageProgress } from '../application/manage-progress';
import { PlayLevel } from '../application/play-level';
import { Area, Key } from '../domain/level/collectibles';
import { Door } from '../domain/level/door';
import { Playthrough, PlayTime } from '../domain/progress/playthrough';
import { StarCount } from '../domain/shared/star-count';
import { Level } from '../domain/level/level';
import { Direction, Heading, TilePosition } from '../domain/level/position';
import { Ground, LevelSize, Scenery } from '../domain/level/scenery';
import { LevelId } from '../domain/shared/level-id';
import { check2dObstacles } from '../infrastructure/check2d-obstacles';
import { InMemoryLevelRepository } from '../infrastructure/in-memory-level-repository';
import { LocalProgressRepository } from '../infrastructure/local-progress-repository';
import { memoryStorage } from '../test-support/memory-storage';
import { pixelDifference } from '../test-support/pictures';
import { GameNavigator } from './game-navigator';
import { GameSession } from './game-session';
import { HeroAnimator } from './hero-animator';
import { Picture } from './picture';
import { WorldPainter } from './world-painter';
import { closingLength } from './world-transition';

const everywhere = Area.of(Array.from({ length: 15 }, (_, index) => TilePosition.at(index % 3, Math.floor(index / 3))));

function navigator(first: string | null = 'one', { secondUnlocked = first === 'two' } = {}) {
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
  const progress = new ManageProgress(new LocalProgressRepository(memoryStorage()), [
    LevelId.of('one'),
    LevelId.of('two'),
  ]);
  if (secondUnlocked)
    progress.complete(LevelId.of('one'), Playthrough.of(PlayTime.ofFrames(60), StarCount.of(0), StarCount.of(0)));
  vi.spyOn(progress, 'reach');
  vi.spyOn(progress, 'complete');
  const screens = {
    showStartScreen: vi.fn(),
    animateStartScreen: vi.fn(),
    showLevelPicker: vi.fn(),
    showLevel: vi.fn(),
  };
  const { showStartScreen } = screens;
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
          keys: [Key.at(TilePosition.at(1, 3), everywhere)],
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
  const subject = new GameNavigator(
    [playable('one'), playable('two')],
    progress,
    (level, report) => new GameSession(level, controls, sound, progress, report),
    screens,
  );
  if (first) subject.play(LevelId.of(first));
  const session = (): GameSession => {
    expect(subject.session).not.toBeNull();
    return subject.session!;
  };
  const complete = (): void => {
    const finished = session();
    heading = Heading.of(Direction.Up);
    for (let frame = 0; frame < 120 && !current().isComplete; frame++) finished.tick();
    heading = null;
    for (let frame = 1; frame < closingLength; frame++) finished.tick();
    expect(subject.session).toBe(finished);
    finished.tick();
    expect(subject.session).not.toBe(finished);
  };
  const press = (button: 'a' | 'b'): void => {
    pressed.add(button);
    session().tick();
  };
  const current = (): LevelView => {
    const { id, play } = plays.at(-1)!;
    return play.view(id);
  };
  const steer = (direction: Direction | null): void => {
    heading = direction && Heading.of(direction);
  };
  return { navigator: subject, started, progress, screens, showStartScreen, complete, press, current, steer };
}

describe('the game navigator', () => {
  test.each(['one', 'two'])('starts the chosen level %s', (first) => {
    const subject = navigator(first);
    expect(subject.started).toEqual([first]);
    expect(subject.navigator.state).toBe('playing');
    expect(subject.progress.reach).toHaveBeenCalledOnce();
    expect(vi.mocked(subject.progress.reach).mock.calls[0]![0].value).toBe(first);
  });

  test('shows the level when it plays an unlocked level, with A disabled where the level has no gate', () => {
    const subject = navigator();
    expect(subject.screens.showLevel).toHaveBeenCalledExactlyOnceWith(false, false);
  });

  test('opens the level picker', () => {
    const subject = navigator(null);
    subject.navigator.openLevelPicker();
    expect(subject.screens.showLevelPicker).toHaveBeenCalledOnce();
    expect(subject.navigator.state).toBe('level-picker');
    expect(subject.navigator.session).toBeNull();
  });

  test.each([
    ['a locked level', 'two'],
    ['an unknown level', 'three'],
  ])('refuses to play %s', (_label, id) => {
    const subject = navigator(null);
    subject.navigator.openLevelPicker();
    subject.navigator.play(LevelId.of(id));
    expect(subject.navigator.state).toBe('level-picker');
    expect(subject.navigator.session).toBeNull();
    expect(subject.started).toEqual([]);
    expect(subject.screens.showLevel).not.toHaveBeenCalled();
  });

  test('starts a fresh next level once the screen has darkened', () => {
    const subject = navigator();
    subject.complete();
    expect(subject.started).toEqual(['one', 'two']);
    expect(subject.navigator.state).toBe('playing');
    const level = subject.current();
    expect(level.id.value).toBe('two');
    expect(level.hero.position).toEqual(TilePosition.at(1, 4));
    expect(level.keys).toHaveLength(1);
    expect(level.door.isOpen).toBe(false);
    expect(level.isComplete).toBe(false);
    expect(subject.navigator.session!.messageText).toBe('');
  });

  test('opens the start screen after the last level', () => {
    const subject = navigator('two');
    subject.complete();
    expect(subject.showStartScreen).toHaveBeenCalledOnce();
    expect(subject.navigator.state).toBe('start-screen');
    expect(subject.navigator.session).toBeNull();
    expect(subject.started).toEqual(['two']);
  });

  test.each(['a', 'b'] as const)('ignores %s pressed while the screen darkens', (button) => {
    const subject = navigator();
    const finished = subject.navigator.session!;
    subject.steer(Direction.Up);
    for (let frame = 0; frame < 120 && !subject.current().isComplete; frame++) finished.tick();
    subject.steer(null);
    subject.press(button);
    expect(subject.navigator.session).toBe(finished);
    expect(subject.started).toEqual(['one']);
  });

  test('discards the session when the start screen opens during play', () => {
    const subject = navigator();
    subject.navigator.openStartScreen();
    expect(subject.showStartScreen).toHaveBeenCalledOnce();
    expect(subject.navigator.state).toBe('start-screen');
    expect(subject.navigator.session).toBeNull();
  });

  test('paints the next level as a fresh painter and animator would, idle and walking', () => {
    const subject = navigator();
    subject.complete();
    const session = subject.navigator.session!;
    const animator = new HeroAnimator();
    for (const [frame, walking] of [
      [0, false],
      [1, true],
    ] as const) {
      if (walking) {
        subject.steer(Direction.Right);
        session.tick();
        animator.advance(session.level.hero);
      }
      const actual = new Picture(224, 224);
      const expected = new Picture(224, 224);
      const level = session.level;
      new WorldPainter(level).paint(expected, { level, frame, hero: animator.pose(level.hero, frame) }, []);
      session.paint(actual);
      expect(pixelDifference(actual, expected)).toBeUndefined();
    }
  });

  test('draws frame 0 when the start screen opens, counts frames from there and restarts when it reopens', () => {
    const subject = navigator(null);
    const shown: string[] = [];
    subject.screens.showStartScreen.mockImplementation(() => shown.push('open'));
    subject.screens.animateStartScreen.mockImplementation((frame: number) => shown.push(String(frame)));
    subject.navigator.openStartScreen();
    for (let frame = 0; frame < 3; frame++) subject.navigator.tick();
    subject.navigator.openLevelPicker();
    subject.navigator.openStartScreen();
    subject.navigator.tick();
    expect(shown).toEqual(['open', '0', '1', '2', '3', 'open', '0', '1']);
  });

  test('animates nothing on the level picker', () => {
    const subject = navigator(null);
    subject.navigator.openLevelPicker();
    subject.navigator.tick();
    expect(subject.screens.animateStartScreen).not.toHaveBeenCalled();
  });

  test('ticks the level session while playing, without animating the start screen', () => {
    const subject = navigator();
    const before = subject.current().hero.feet;
    subject.steer(Direction.Up);
    subject.navigator.tick();
    expect(subject.current().hero.feet).not.toEqual(before);
    expect(subject.screens.animateStartScreen).not.toHaveBeenCalled();
  });

  test('saves each completion once', () => {
    const subject = navigator();
    subject.complete();
    subject.complete();
    expect(vi.mocked(subject.progress.complete).mock.calls.map(([id]) => id.value)).toEqual(['one', 'two']);
    expect(vi.mocked(subject.progress.reach).mock.calls.map(([id]) => id.value)).toEqual(['one', 'two']);
  });
});
