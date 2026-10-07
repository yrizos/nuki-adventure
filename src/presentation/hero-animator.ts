import type { HeroState } from '../domain/level/hero';
import type { Art } from './art/art';
import { heroArt, heroWalkFrameLength } from './sprite-library';

const ticksPerWalkFrame = heroWalkFrameLength;
const settleTicks = 8;
const blinkEvery = 180;
const blinkFrames = 6;
const breathEvery = 90;
// Each foot lands once per two walk frames.
const ticksPerFootfall = 2 * ticksPerWalkFrame;

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

  pose(hero: HeroState, frame: number, holdingOrb: boolean): Art {
    const facing = hero.facing;
    const art =
      heroArt[facing.rowStep < 0 ? 'up' : facing.rowStep > 0 ? 'down' : facing.columnStep < 0 ? 'left' : 'right'];
    // The raised arms only read as holding when the hero stands still, so a walking hero keeps the walk cycle under the orb.
    if (holdingOrb && !hero.isWalking) return art.holding!;
    if (hero.isWalking) return art.walk[this.walkFrame()]!;
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
