import { describe, expect, test, vi } from 'vitest';
import { Area, Key } from '../../level/domain/collectibles';
import { Direction, Heading, TilePosition } from '../../level/domain/position';
import { Door } from '../../level/domain/door';
import { Ground, LevelSize, Scenery } from '../../level/domain/scenery';
import { LevelId } from '../../level/domain/level-id';
import { type LevelView } from '../../level/application/level-view';
import { PlayLevel } from '../../level/application/play-level';
import { ManageProgress } from '../../progress/application/manage-progress';
import { Level } from '../../level/domain/level';
import { check2dObstacles } from '../../level/infrastructure/check2d-obstacles';
import { InMemoryLevelRepository } from '../../level/infrastructure/in-memory-level-repository';
import { LocalProgressRepository } from '../../progress/infrastructure/local-progress-repository';
import { memoryStorage } from '../../progress/testing/memory-storage';
import { pixelDifference } from '../testing/pictures';
import { endScreenFadeLength } from '../screens/end-screen';
import { GameNavigator } from './game-navigator';
import { GameSession } from './game-session';
import { HeroAnimator } from '../world/hero-animator';
import { Picture } from '../graphics/picture';
import { WorldPainter } from '../world/world-painter';
import { closingLength } from '../world/world-transition';

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
  if (secondUnlocked) progress.complete(LevelId.of('one'), { playFrames: 60, starsCollected: 0, starCount: 0 });
  vi.spyOn(progress, 'reach');
  vi.spyOn(progress, 'complete');
  const screens = {
    showStartScreen: vi.fn(),
    animateStartScreen: vi.fn(),
    showLevelPicker: vi.fn(),
    closeLevelPicker: vi.fn(),
    animateLevelPicker: vi.fn(),
    showEndScreen: vi.fn(),
    animateEndScreen: vi.fn(),
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
  test('shows the level when it plays an unlocked level, with A disabled where the level has no gate', () => {
    const subject = navigator();
    expect(subject.screens.showLevel).toHaveBeenCalledExactlyOnceWith(false, false);
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

  test('animates only the level picker while it is open, and closing it resumes the start screen where it was', () => {
    const subject = navigator(null);
    subject.navigator.openStartScreen();
    subject.navigator.tick();
    subject.navigator.openLevelPicker();
    subject.navigator.tick();
    expect(subject.screens.animateLevelPicker).toHaveBeenCalledOnce();
    expect(subject.screens.animateStartScreen).toHaveBeenLastCalledWith(1);
    subject.navigator.closeLevelPicker();
    expect(subject.navigator.state).toBe('start-screen');
    expect(subject.screens.closeLevelPicker).toHaveBeenCalledOnce();
    subject.navigator.tick();
    expect(subject.screens.animateStartScreen).toHaveBeenLastCalledWith(2);
    expect(subject.screens.showStartScreen).toHaveBeenCalledOnce();
  });

  test('ticks the level session while playing, without animating the start screen', () => {
    const subject = navigator();
    const before = subject.current().hero.feet;
    subject.steer(Direction.Up);
    subject.navigator.tick();
    expect(subject.current().hero.feet).not.toEqual(before);
    expect(subject.screens.animateStartScreen).not.toHaveBeenCalled();
  });

  test('finishing the last level opens the end screen, which stays 2 seconds and then fades to the start screen', () => {
    const subject = navigator();
    subject.complete();
    subject.complete();
    expect(subject.navigator.state).toBe('end-screen');
    expect(subject.screens.showEndScreen).toHaveBeenCalledOnce();
    for (let frame = 1; frame < 120; frame++) subject.navigator.tick();
    expect(vi.mocked(subject.screens.animateEndScreen).mock.calls.at(-1)).toEqual([119, 0]);
    for (let frame = 0; frame < endScreenFadeLength; frame++) subject.navigator.tick();
    expect(vi.mocked(subject.screens.animateEndScreen).mock.calls.at(-1)).toEqual([
      119 + endScreenFadeLength,
      endScreenFadeLength - 1,
    ]);
    expect(subject.navigator.state).toBe('end-screen');
    subject.navigator.tick();
    expect(subject.navigator.state).toBe('start-screen');
  });

  test('leaving the end screen early starts the fade at once, and a second press does not restart it', () => {
    const subject = navigator();
    subject.complete();
    subject.complete();
    subject.navigator.tick();
    subject.navigator.leaveEndScreen();
    subject.navigator.tick();
    subject.navigator.leaveEndScreen();
    subject.navigator.tick();
    expect(vi.mocked(subject.screens.animateEndScreen).mock.calls.at(-1)).toEqual([3, 2]);
    for (let frame = 3; frame < endScreenFadeLength; frame++) subject.navigator.tick();
    expect(subject.navigator.state).toBe('end-screen');
    subject.navigator.tick();
    expect(subject.navigator.state).toBe('start-screen');
  });

  test('saves each completion once', () => {
    const subject = navigator();
    subject.complete();
    subject.complete();
    expect(vi.mocked(subject.progress.complete).mock.calls.map(([id]) => id.value)).toEqual(['one', 'two']);
    expect(vi.mocked(subject.progress.reach).mock.calls.map(([id]) => id.value)).toEqual(['one', 'two']);
  });
});
