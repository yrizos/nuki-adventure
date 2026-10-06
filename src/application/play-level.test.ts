import { describe, expect, test } from 'vitest';
import { Area, Orb, OrbColor, Star } from '../domain/level/collectibles';
import { Door } from '../domain/level/door';
import { Level } from '../domain/level/level';
import { SignpostRead, StarCollected } from '../domain/level/level-events';
import { LevelId } from '../domain/level/level-id';
import type { LevelRepository } from '../domain/level/level-repository';
import { Direction, TilePosition } from '../domain/level/position';
import { Ground, LevelSize, Scenery } from '../domain/level/scenery';
import { Signpost, SignpostText } from '../domain/level/signpost';
import { PlayLevel } from './play-level';

const levelId = LevelId.of('play');
const hint = SignpostText.of('ΔΙΑΒΑΣΕ ΜΕ');

function playing() {
  const tiles = Array.from({ length: 15 }, (_, index) => TilePosition.at(index % 5, Math.floor(index / 5)));
  const level = Level.create({
    id: levelId,
    scenery: Scenery.of(
      LevelSize.of(5, 3),
      Array.from({ length: 3 }, () => Array<Ground>(5).fill(Ground.Path)),
      [],
      [],
    ),
    stones: [],
    orbs: [Orb.at(TilePosition.at(4, 0), OrbColor.Violet, Area.of(tiles))],
    door: Door.closedAt(TilePosition.at(2, 2)),
    hero: { position: TilePosition.at(0, 0), facing: Direction.Right },
    stars: [Star.at(TilePosition.at(1, 0))],
    signposts: [Signpost.at(TilePosition.at(0, 1), hint)],
  });
  const loaded: LevelId[] = [];
  const saved: Level[] = [];
  const repository: LevelRepository = {
    load(id) {
      loaded.push(id);
      return level;
    },
    save(changed) {
      saved.push(changed);
    },
  };
  return { level, loaded, saved, play: new PlayLevel(repository) };
}

describe('playing a level', () => {
  test('shows the stored level without saving it', () => {
    const subject = playing();
    const view = subject.play.view(levelId);
    expect(view).toEqual({
      id: levelId,
      scenery: subject.level.scenery,
      stones: [],
      orbs: subject.level.orbs,
      stars: [Star.at(TilePosition.at(1, 0))],
      collected: [],
      signposts: [Signpost.at(TilePosition.at(0, 1), hint)],
      door: subject.level.door,
      hero: subject.level.hero,
      isComplete: false,
    });
    expect('tick' in view || 'read' in view).toBe(false);
    expect(subject.loaded).toEqual([levelId]);
    expect(subject.saved).toEqual([]);
  });

  test('keeps an earlier view unchanged while the level moves on', () => {
    const subject = playing();
    const before = subject.play.view(levelId);
    for (let frame = 0; frame < 17; frame++) subject.play.advance(levelId, frame === 0 ? Direction.Right : null);
    expect(before.hero.position).toEqual(TilePosition.at(0, 0));
    expect(before.hero.step).toBeNull();
    expect(before.stars).toEqual([Star.at(TilePosition.at(1, 0))]);
    expect(before.collected).toEqual([]);
    expect(subject.play.view(levelId).collected).toEqual([Star.at(TilePosition.at(1, 0))]);
  });

  test('advances the stored level in the held direction and saves it after every frame', () => {
    const subject = playing();
    const events = Array.from({ length: 17 }, (_, frame) =>
      subject.play.advance(levelId, frame === 0 ? Direction.Right : null),
    ).flat();
    expect(events).toEqual([new StarCollected(levelId, TilePosition.at(1, 0))]);
    expect(subject.level.hero.position).toEqual(TilePosition.at(1, 0));
    expect(subject.loaded).toHaveLength(17);
    expect(subject.saved).toHaveLength(17);
    expect(subject.saved.every((level) => level === subject.level)).toBe(true);
  });

  test('reads the signpost beside the hero and saves the level', () => {
    const subject = playing();
    expect(subject.play.read(levelId)).toEqual([new SignpostRead(levelId, TilePosition.at(0, 1), hint)]);
    expect(subject.saved).toEqual([subject.level]);
  });

  test('saves the level even when there is nothing to read', () => {
    const subject = playing();
    subject.play.advance(levelId, Direction.Right);
    expect(subject.play.read(levelId)).toEqual([]);
    expect(subject.saved).toHaveLength(2);
  });
});
