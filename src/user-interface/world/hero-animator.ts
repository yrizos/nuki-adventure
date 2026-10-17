import type { HeroState } from '../../level';
import type { Art, HeroArt, HeroDirectionArt } from '../graphics/art';
import { heroArt, heroDanceArt, heroWalkFrameLength } from '../graphics/sprite-library';

const ticksPerWalkFrame = heroWalkFrameLength;
const settleTicks = 8;
const blinkEvery = 180;
const blinkFrames = 6;
const breathEvery = 90;
const ticksPerFootfall = 2 * ticksPerWalkFrame;

export function idleHeroPose(facing: keyof HeroArt, frame: number): Art {
  return idlePose(heroArt[facing], frame);
}

export function idlePose(art: Pick<HeroDirectionArt, 'stand' | 'breathe' | 'blink'>, frame: number): Art {
  if (art.blink && frame >= blinkEvery && frame % blinkEvery < blinkFrames) return art.blink;
  return Math.floor(frame / breathEvery) % 2 === 1 ? art.breathe : art.stand;
}

export function dancingHeroPose(frame: number): Art {
  return heroDanceArt[Math.floor(frame / heroWalkFrameLength) % heroDanceArt.length]!;
}

export function pushingPose(age: number): Art {
  const frames = heroArt.up.push;
  return frames[Math.min(Math.floor(age / ticksPerWalkFrame), frames.length - 1)]!;
}

export class HeroAnimator {
  private walkTicks = 0;
  private settleLeft = 0;

  get footfall(): boolean {
    return this.walkTicks % ticksPerFootfall === 1;
  }

  advance(hero: HeroState): void {
    if (hero.isWalking) {
      this.walkTicks++;
      this.settleLeft = 0;
      return;
    }
    // Stopping mid-stride on a passing frame leaves the pigtails swinging, so they get one walk frame to catch up.
    if (this.walkTicks > 0) this.settleLeft = this.walkFrame() % 2 === 1 ? settleTicks : 0;
    else if (this.settleLeft > 0) this.settleLeft--;
    this.walkTicks = 0;
  }

  pose(hero: HeroState, frame: number): Art {
    const facing = hero.facing;
    const facingKey: keyof HeroArt =
      facing.rowStep < 0 ? 'up' : facing.rowStep > 0 ? 'down' : facing.columnStep < 0 ? 'left' : 'right';
    const art = heroArt[facingKey];
    if (hero.isWalking) return art.walk[this.walkFrame()]!;
    if (this.settleLeft > 0) return art.settle;
    return idleHeroPose(facingKey, frame);
  }

  private walkFrame(): number {
    return Math.floor((this.walkTicks - 1) / ticksPerWalkFrame) % 4;
  }
}
