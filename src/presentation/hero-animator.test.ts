import { expect, test } from 'vitest';
import { Hero } from '../domain/level/hero';
import { Direction, TilePosition } from '../domain/level/position';
import { heroArt } from './art/sprites';
import { HeroAnimator } from './hero-animator';

test('animation history is identical with and without intervening renders', () => {
  const hero = new Hero(TilePosition.at(2, 2), Direction.Down);
  const everyRender = new HeroAnimator();
  const skippedRenders = new HeroAnimator();
  for (let frame = 0; frame < 35; frame++) {
    hero.advance();
    hero.steer(frame < 25 ? Direction.Down : null, () => true);
    everyRender.advance(hero);
    skippedRenders.advance(hero);
    everyRender.pose(hero, frame, false);
    everyRender.pose(hero, frame, false);
    if (frame % 7 === 0 || frame === 34) {
      expect(skippedRenders.pose(hero, frame, false)).toEqual(everyRender.pose(hero, frame, false));
    }
  }
});

test('hair follows a new walk pose one simulation tick late and settles in one tick', () => {
  const hero = new Hero(TilePosition.at(2, 2), Direction.Down);
  const animator = new HeroAnimator();
  hero.steer(Direction.Down, () => true);
  animator.advance(hero);
  for (let frame = 1; frame <= 4; frame++) { hero.advance(); animator.advance(hero); }
  const delayed = animator.pose(hero, 4, false);
  hero.advance();
  animator.advance(hero);
  const caughtUp = animator.pose(hero, 5, false);
  expect(delayed.rows).not.toEqual(caughtUp.rows);
  expect(delayed.rows.slice(14)).toEqual(caughtUp.rows.slice(14));
  for (let frame = 6; frame <= 16; frame++) { hero.advance(); animator.advance(hero); }
  expect(animator.pose(hero, 16, false).rows).not.toEqual(heroArt.down.stand.rows);
  animator.advance(hero);
  expect(animator.pose(hero, 17, false)).toBe(heroArt.down.stand);
});

test('idle blinks for six ticks every three seconds and breathes every ninety ticks', () => {
  const hero = new Hero(TilePosition.at(0, 0), Direction.Down);
  const animator = new HeroAnimator();
  expect(animator.pose(hero, 0, false)).toBe(heroArt.down.stand);
  expect(animator.pose(hero, 90, false)).toBe(heroArt.down.breathe);
  for (let frame = 180; frame < 186; frame++) expect(animator.pose(hero, frame, false)).toBe(heroArt.down.blink);
  expect(animator.pose(hero, 186, false)).toBe(heroArt.down.stand);
});

test.each([['down', Direction.Down], ['up', Direction.Up], ['left', Direction.Left], ['right', Direction.Right]] as const)(
  '%s keeps a constant silhouette throughout idle and walking, and has its own holding pose', (name, direction) => {
    const art = heroArt[name];
    const area = (rows: readonly string[]): number => rows.join('').replaceAll('.', '').length;
    for (const pose of [art.stand, art.breathe, ...art.walk, ...(art.blink ? [art.blink] : [])]) {
      expect(area(pose.rows)).toBe(area(art.stand.rows));
      expect(pose.rows[31]).toBe(art.stand.rows[31]);
    }
    const hero = new Hero(TilePosition.at(0, 0), direction);
    expect(new HeroAnimator().pose(hero, 0, true)).toBe(art.holding);
  },
);
