import { expect, test } from 'vitest';
import { Hero } from '../domain/level/hero';
import type { Obstacles } from '../domain/level/obstacles';
import { Direction, Heading, TilePosition } from '../domain/level/position';
import type { Art } from './art/art';
import { heroArt, heroDanceArt } from './sprite-library';
import { dancingHeroPose, HeroAnimator, idleHeroPose, pushingPose } from './hero-animator';

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
    everyRender.pose(hero.state, frame);
    everyRender.pose(hero.state, frame);
    if (frame % 7 === 0 || frame === 34) {
      expect(skippedRenders.pose(hero.state, frame)).toEqual(everyRender.pose(hero.state, frame));
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
    shown.push(animator.pose(hero.state, frame));
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
    expect(animator.pose(hero.state, frame)).toBe(heroArt.down.settle);
  }
  animator.advance(hero.state);
  expect(animator.pose(hero.state, 40)).toBe(heroArt.down.stand);
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

test.each(['down', 'left', 'right', 'up'] as const)(
  'idle facing %s breathes from frame 90 and blinks for six frames every 180, except facing up',
  (facing) => {
    const art = heroArt[facing];
    const blink = facing === 'up' ? art.stand : art.blink;
    const frames = [89, 90, 91, 179, 180, 181, 184, 185, 186, 359, 360, 361];
    expect(frames.map((frame) => idleHeroPose(facing, frame))).toEqual([
      art.stand,
      art.breathe,
      art.breathe,
      art.breathe,
      blink,
      blink,
      blink,
      blink,
      art.stand,
      art.breathe,
      blink,
      blink,
    ]);
  },
);

test('pushes through both pushing frames across the sixteen frames of a gate swing and holds the last', () => {
  const shown = Array.from({ length: 18 }, (_, age) => pushingPose(age));
  expect(shown.slice(0, 8).every((art) => art === heroArt.up.push[0])).toBe(true);
  expect(shown.slice(8).every((art) => art === heroArt.up.push[1])).toBe(true);
});

test('dances through cheer, left, cheer and right poses for sixteen frames each and loops every 64 frames', () => {
  const [cheer, , left, , , , right] = heroDanceArt;
  const frames = [0, 15, 16, 31, 32, 48, 63, 64];
  expect(frames.map(dancingHeroPose)).toEqual([cheer, cheer, left, left, cheer, right, right, cheer]);
  expect(new Set([cheer, left, right]).size).toBe(3);
});
