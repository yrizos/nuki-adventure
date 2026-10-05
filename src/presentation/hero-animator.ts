import type { Hero } from '../domain/level/hero';
import type { Art } from './art/art';
import { heroArt } from './art/sprites';

const ticksPerWalkFrame = 8;
const settleTicks = 8;
const blinkEvery = 180;
const blinkFrames = 6;
const breathEvery = 90;

export class HeroAnimator {
  private walkTicks = 0;
  private settleLeft = 0;

  advance(hero: Hero): void {
    if (hero.step) {
      this.walkTicks++;
      this.settleLeft = 0;
      return;
    }
    // Stopping mid-stride on a passing frame leaves the pigtails swinging, so they get one walk frame to catch up.
    if (this.walkTicks > 0) this.settleLeft = this.walkFrame() % 2 === 1 ? settleTicks : 0;
    else if (this.settleLeft > 0) this.settleLeft--;
    this.walkTicks = 0;
  }

  pose(hero: Hero, frame: number, holdingOrb: boolean): Art {
    const facing = hero.facing;
    const art = heroArt[facing.rowStep < 0 ? 'up' : facing.rowStep > 0 ? 'down' : facing.columnStep < 0 ? 'left' : 'right'];
    if (holdingOrb) return art.holding!;
    if (hero.step) return art.walk[this.walkFrame()]!;
    if (this.settleLeft > 0) return art.settle;
    const inhaling = Math.floor(frame / breathEvery) % 2 === 1;
    const blink = inhaling ? art.inhaleBlink : art.blink;
    if (blink && frame >= blinkEvery && frame % blinkEvery < blinkFrames) return blink;
    return inhaling ? art.breathe : art.stand;
  }

  private walkFrame(): number {
    return Math.floor((this.walkTicks - 1) / ticksPerWalkFrame) % 4;
  }
}
