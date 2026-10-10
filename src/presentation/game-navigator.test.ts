import { describe, expect, test, vi } from 'vitest';
import type { LevelView } from '../application/level-view';
import { PlayLevel } from '../application/play-level';
import { Area, Orb, OrbColor } from '../domain/level/collectibles';
import { Door } from '../domain/level/door';
import { Level } from '../domain/level/level';
import { Direction, Heading, TilePosition } from '../domain/level/position';
import { Ground, LevelSize, Scenery } from '../domain/level/scenery';
import { LevelId } from '../domain/shared/level-id';
import { check2dObstacles } from '../infrastructure/check2d-obstacles';
import { InMemoryLevelRepository } from '../infrastructure/in-memory-level-repository';
import { pixelDifference } from '../test-support/pictures';
import { GameNavigator } from './game-navigator';
import { GameSession } from './game-session';
import { HeroAnimator } from './hero-animator';
import { Picture } from './picture';
import { WorldPainter } from './world-painter';
import { closingLength } from './world-transition';

const everywhere = Area.of(Array.from({ length: 15 }, (_, index) => TilePosition.at(index % 3, Math.floor(index / 3))));

function navigator(first = 'one') {
  const pressed = new Set<'a' | 'b'>();
  let heading: Heading | null = null;
  const controls = { takePress: (button: 'a' | 'b') => pressed.delete(button), heading: () => heading };
  const sound = { star: vi.fn(), orb: vi.fn(), door: vi.fn(), footstep: vi.fn(), restoring: vi.fn() };
  const levelEnd = { show: vi.fn(), hide: vi.fn() };
  const progress = { reach: vi.fn<(level: LevelId) => void>(), complete: vi.fn<(level: LevelId) => void>() };
  const showStartScreen = vi.fn();
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
  const subject = new GameNavigator(
    [playable('one'), playable('two')],
    (level, report) => new GameSession(level, controls, sound, levelEnd, progress, report),
    showStartScreen,
  );
  subject.play(LevelId.of(first));
  const session = (): GameSession => {
    expect(subject.session).not.toBeNull();
    return subject.session!;
  };
  const complete = (): void => {
    const shown = levelEnd.show.mock.calls.length;
    heading = Heading.of(Direction.Up);
    for (let frame = 0; frame < 120 && !current().isComplete; frame++) session().tick();
    heading = null;
    for (let frame = 0; frame <= closingLength && levelEnd.show.mock.calls.length === shown; frame++) session().tick();
    expect(levelEnd.show).toHaveBeenCalledTimes(shown + 1);
  };
  const continueWith = (button: 'level-end button' | 'a' | 'b'): void => {
    if (button === 'level-end button') {
      session().continuePlaying();
      return;
    }
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
  return { navigator: subject, started, progress, showStartScreen, complete, continueWith, current, steer };
}

describe('the game navigator', () => {
  test.each(['one', 'two'])('starts the chosen level %s', (first) => {
    const subject = navigator(first);
    expect(subject.started).toEqual([first]);
    expect(subject.navigator.state).toBe('playing');
    expect(subject.progress.reach.mock.calls.map(([id]) => id.value)).toEqual([first]);
  });

  test('enters the level end when the level end window opens', () => {
    const subject = navigator();
    subject.complete();
    expect(subject.navigator.state).toBe('level-end');
    expect(subject.started).toEqual(['one']);
  });

  test.each(['level-end button', 'a', 'b'] as const)('continues once to a fresh next level with %s', (button) => {
    const subject = navigator();
    const finished = subject.navigator.session;
    subject.complete();
    subject.continueWith(button);
    subject.continueWith(button);
    expect(subject.started).toEqual(['one', 'two']);
    expect(subject.navigator.state).toBe('playing');
    expect(subject.navigator.session).not.toBe(finished);
    const level = subject.current();
    expect(level.id.value).toBe('two');
    expect(level.hero.position).toEqual(TilePosition.at(1, 4));
    expect(level.orbs).toHaveLength(1);
    expect(level.door.isOpen).toBe(false);
    expect(level.isComplete).toBe(false);
    expect(subject.navigator.session!.messageText).toBe('');
  });

  test.each(['level-end button', 'a', 'b'] as const)(
    'opens the start screen after the last level with %s',
    (button) => {
      const subject = navigator('two');
      subject.complete();
      subject.continueWith(button);
      expect(subject.showStartScreen).toHaveBeenCalledOnce();
      expect(subject.navigator.state).toBe('start-screen');
      expect(subject.navigator.session).toBeNull();
      expect(subject.started).toEqual(['two']);
    },
  );

  test.each(['before', 'after'] as const)(
    'continues once when the level-end button is used %s a pending action press',
    (order) => {
      const subject = navigator();
      subject.complete();
      if (order === 'before') subject.continueWith('level-end button');
      subject.continueWith('a');
      if (order === 'after') subject.continueWith('level-end button');
      expect(subject.started).toEqual(['one', 'two']);
      expect(subject.navigator.state).toBe('playing');
      expect(subject.current().isComplete).toBe(false);
    },
  );

  test('discards the session when the start screen opens during play', () => {
    const subject = navigator();
    subject.navigator.openStartScreen();
    expect(subject.showStartScreen).toHaveBeenCalledOnce();
    expect(subject.navigator.state).toBe('start-screen');
    expect(subject.navigator.session).toBeNull();
  });

  test('discards the session when the start screen opens over the level end window', () => {
    const subject = navigator();
    subject.complete();
    subject.navigator.openStartScreen();
    expect(subject.showStartScreen).toHaveBeenCalledOnce();
    expect(subject.navigator.state).toBe('start-screen');
    expect(subject.navigator.session).toBeNull();
  });

  test('paints the next level as a fresh painter and animator would, idle and walking', () => {
    const subject = navigator();
    subject.complete();
    subject.continueWith('level-end button');
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
      new WorldPainter(level).paint(
        expected,
        { level, frame, hero: animator.pose(level.hero, frame, false), heldOrb: null },
        [],
      );
      session.paint(actual);
      expect(pixelDifference(actual, expected)).toBeUndefined();
    }
  });

  test('saves each completion once', () => {
    const subject = navigator();
    subject.complete();
    subject.continueWith('a');
    subject.complete();
    subject.continueWith('a');
    expect(subject.progress.complete.mock.calls.map(([id]) => id.value)).toEqual(['one', 'two']);
    expect(subject.progress.reach.mock.calls.map(([id]) => id.value)).toEqual(['one', 'two']);
  });
});
