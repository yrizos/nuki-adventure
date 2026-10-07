import { expect, test } from 'vitest';
import { Hero } from '../domain/level/hero';
import type { Obstacles } from '../domain/level/obstacles';
import { Direction, Heading, TilePosition } from '../domain/level/position';
import type { Art } from './art/art';
import { heroArt } from './sprite-library';
import { HeroAnimator } from './hero-animator';

const openGround: Obstacles = { walk: (_, to) => to };
const down = Heading.of(Direction.Down);

test('animation history is identical with and without intervening renders', () => {
  const hero = new Hero(TilePosition.at(2, 2), Direction.Down);
  const everyRender = new HeroAnimator();
  const skippedRenders = new HeroAnimator();
  for (let frame = 0; frame < 35; frame++) {
    hero.steer(frame < 25 ? down : null, openGround);
    everyRender.advance(hero.state);
    skippedRenders.advance(hero.state);
    everyRender.pose(hero.state, frame, false);
    everyRender.pose(hero.state, frame, false);
    if (frame % 7 === 0 || frame === 34) {
      expect(skippedRenders.pose(hero.state, frame, false)).toEqual(everyRender.pose(hero.state, frame, false));
    }
  }
});

test('walk frames last eight ticks, and stopping on a passing frame settles for eight ticks', () => {
  const hero = new Hero(TilePosition.at(2, 2), Direction.Down);
  const animator = new HeroAnimator();
  const shown: Art[] = [];
  for (let frame = 0; frame < 24; frame++) {
    hero.steer(down, openGround);
    animator.advance(hero.state);
    shown.push(animator.pose(hero.state, frame, false));
  }
  const walk = heroArt.down.walk;
  expect(shown).toEqual([
    ...Array<Art | undefined>(8).fill(walk[0]),
    ...Array<Art | undefined>(8).fill(walk[1]),
    ...Array<Art | undefined>(8).fill(walk[2]),
  ]);
  for (let frame = 24; frame < 32; frame++) {
    hero.steer(down, openGround);
    animator.advance(hero.state);
  }
  for (let frame = 32; frame < 40; frame++) {
    hero.steer(null, openGround);
    animator.advance(hero.state);
    expect(animator.pose(hero.state, frame, false)).toBe(heroArt.down.settle);
  }
  animator.advance(hero.state);
  expect(animator.pose(hero.state, 40, false)).toBe(heroArt.down.stand);
});

test('idle blinks for six ticks every three seconds and breathes every ninety ticks', () => {
  const hero = new Hero(TilePosition.at(0, 0), Direction.Down);
  const animator = new HeroAnimator();
  expect(animator.pose(hero.state, 0, false)).toBe(heroArt.down.stand);
  expect(animator.pose(hero.state, 90, false)).toBe(heroArt.down.breathe);
  for (let frame = 180; frame < 186; frame++) expect(animator.pose(hero.state, frame, false)).toBe(heroArt.down.blink);
  expect(animator.pose(hero.state, 186, false)).toBe(heroArt.down.stand);
});

test.each([
  ['down', Direction.Down],
  ['up', Direction.Up],
  ['left', Direction.Left],
  ['right', Direction.Right],
] as const)('%s has its own holding pose', (name, direction) => {
  const hero = new Hero(TilePosition.at(0, 0), direction);
  expect(new HeroAnimator().pose(hero.state, 0, true)).toBe(heroArt[name].holding);
});

test('a foot lands on the first walking tick and every sixteen ticks after', () => {
  const hero = new Hero(TilePosition.at(2, 2), Direction.Down);
  const animator = new HeroAnimator();
  const landed: number[] = [];
  for (let frame = 0; frame < 40; frame++) {
    hero.steer(frame < 34 ? down : null, openGround);
    animator.advance(hero.state);
    if (animator.footfall) landed.push(frame);
  }
  expect(landed).toEqual([0, 16, 32]);
});
