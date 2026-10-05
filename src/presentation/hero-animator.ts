import type { Hero } from '../domain/level/hero';
import type { Art } from './art/art';
import { heroArt } from './art/sprites';

const framesPerWalkPose = 4;
const blinkEvery = 180;
const blinkFrames = 6;
const breathEvery = 90;

export class HeroAnimator {
  private previousPose = 1;
  private hairPose = 1;
  private moving = false;
  private settling = false;
  private facing: Hero['facing'] | null = null;
  private readonly composed = new WeakMap<Art, WeakMap<Art, Art>>();

  advance(hero: Hero): void {
    const pose = hero.step ? Math.floor(hero.step.framesTaken / framesPerWalkPose) % 4 : 1;
    const sameFacing = this.facing?.equals(hero.facing) ?? false;
    this.hairPose = this.moving && sameFacing ? this.previousPose : pose;
    this.settling = this.moving && hero.step === null && sameFacing;
    this.moving = hero.step !== null;
    this.previousPose = pose;
    this.facing = hero.facing;
  }

  pose(hero: Hero, frame: number, holdingOrb: boolean): Art {
    const facing = hero.facing;
    const art = heroArt[facing.rowStep < 0 ? 'up' : facing.rowStep > 0 ? 'down' : facing.columnStep < 0 ? 'left' : 'right'];
    if (holdingOrb) return art.holding!;
    if (hero.step) {
      const body = art.walk[Math.floor(hero.step.framesTaken / framesPerWalkPose) % art.walk.length]!;
      return this.withHair(body, art.hair![this.hairPose]!);
    }
    if (this.settling) return this.withHair(art.settle, art.hair![this.hairPose]!);
    if (art.blink && frame >= blinkEvery && frame % blinkEvery < blinkFrames) return art.blink;
    return Math.floor(frame / breathEvery) % 2 === 1 ? art.breathe : art.stand;
  }

  private withHair(body: Art, hair: Art): Art {
    let poses = this.composed.get(body);
    if (!poses) {
      poses = new WeakMap<Art, Art>();
      this.composed.set(body, poses);
    }
    let combined = poses.get(hair);
    if (!combined) {
      combined = {
        legend: body.legend,
        rows: body.rows.map((row, vertical) => [...row].map((symbol, horizontal) =>
          hair.rows[vertical]![horizontal] === '.' ? symbol : hair.rows[vertical]![horizontal]).join('')),
      };
      poses.set(hair, combined);
    }
    return combined;
  }
}
