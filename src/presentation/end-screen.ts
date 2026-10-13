import { PixelGrid, type Art } from './art/art';
import { glyphHeight, textWidth, writeText } from './art/font';
import { artUrl } from './canvas-art';
import { element } from './dom';
import { dancingHeroPose } from './hero-animator';
import { ditheredArt, ditherSteps } from './ordered-dither';

const congratulations = 'ΣΥΓΧΑΡΗΤΗΡΙΑ!';
const framesPerFadeThreshold = 2;
export const endScreenFadeLength = ditherSteps * framesPerFadeThreshold;

// The stars are gold, so the word that celebrates collecting them wears the same color.
export function congratulationsArt(): Art {
  const grid = new PixelGrid(textWidth(congratulations), glyphHeight);
  writeText(grid, congratulations, 0, 0, 'y');
  return grid.build({ y: 'Y2' });
}

function showArt(target: HTMLElement, art: Art, url: string): void {
  target.style.setProperty('--art', url);
  target.style.setProperty('--art-width', String(art.rows[0]!.length));
  target.style.setProperty('--art-height', String(art.rows.length));
}

export class EndScreen {
  private readonly screen: HTMLElement;
  private readonly title: HTMLElement;
  private readonly hero: HTMLElement;
  private readonly titleArt = congratulationsArt();
  // Each pose and fade step is drawn once, so the dance and the fade build no new images after their first pass.
  private readonly urls = new Map<Art, string[]>();

  constructor(private readonly root: Document) {
    this.screen = element(root, '.end-screen');
    this.title = element(root, '.end-title');
    this.hero = element(root, '.end-hero');
  }

  // Any key or touch anywhere leaves, so the player never has to find a button to move on.
  whenLeaving(listener: () => void): void {
    for (const type of ['pointerdown', 'keydown'] as const)
      this.root.addEventListener(type, (event) => {
        // A key still held from walking into the last door repeats, and must not cut the celebration short.
        if (!this.screen.hidden && !(event as KeyboardEvent).repeat) listener();
      });
  }

  animate(framesOpen: number, framesLeaving: number): void {
    const shown = Math.max(0, ditherSteps - Math.floor(framesLeaving / framesPerFadeThreshold));
    showArt(this.title, this.titleArt, this.url(this.titleArt, shown));
    const pose = dancingHeroPose(framesOpen);
    showArt(this.hero, pose, this.url(pose, shown));
  }

  show(): void {
    this.screen.hidden = false;
  }

  hide(): void {
    this.screen.hidden = true;
  }

  private url(art: Art, shown: number): string {
    let steps = this.urls.get(art);
    if (!steps) {
      steps = [];
      this.urls.set(art, steps);
    }
    return (steps[shown] ??= `url(${artUrl(this.root, ditheredArt(art, shown))})`);
  }
}
