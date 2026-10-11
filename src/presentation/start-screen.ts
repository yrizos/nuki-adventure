import { PixelGrid, type Art } from './art/art';
import { glyphHeight, glyphWidth, letterGap, textWidth, writeText } from './art/font';
import { continueHeight, newGameWidth, pickLevelWidth } from './art/panel';
import { artUrl } from './canvas-art';
import { element } from './dom';
import { idleHeroPose } from './hero-animator';
import { takeMenuKeys } from './menu-keys';
import { ditherSteps, ditherThreshold } from './ordered-dither';

// ΠΟΛΥΧΡΩΜΗ means colorful, so its letters take the orb colors in turn, and the hero's name takes the gold of the stars.
const gameName = [
  { text: 'Η ΠΟΛΥΧΡΩΜΗ ΠΕΡΙΠΕΤΕΙΑ', colors: 'pp' + 'vtr'.repeat(3) + 'p'.repeat(11) },
  { text: 'ΤΗΣ ΝΟΥΚΙ', colors: 'pppp' + 'yyyyy' },
];
const gameNameLegend = { p: 'Paper', v: 'V2', t: 'T2', r: 'R2', y: 'Y2' } as const;
const lineHeight = 16;
const framesPerTitleThreshold = 2;

export function titleArt(): Art {
  const width = Math.max(...gameName.map(({ text }) => textWidth(text)));
  const grid = new PixelGrid(width, (gameName.length - 1) * lineHeight + glyphHeight);
  gameName.forEach(({ text, colors }, line) => {
    const left = Math.floor((width - textWidth(text)) / 2);
    [...text].forEach((character, index) =>
      writeText(grid, character, left + index * (glyphWidth + letterGap), line * lineHeight, colors[index]!),
    );
  });
  return grid.build(gameNameLegend);
}

export class StartScreen {
  private readonly screen: HTMLElement;
  private readonly newGameButton: HTMLButtonElement;
  private readonly pickLevelButton: HTMLButtonElement;
  private readonly hero: HTMLElement;
  private readonly title: HTMLElement;
  private readonly titleUrls: string[];
  private titleShown = -1;
  private readonly heroUrls = new Map<Art, string>();
  private heroPose: Art | null = null;

  constructor(private readonly root: Document) {
    this.screen = element(root, '.start-screen');
    this.newGameButton = element(root, '.start-new-game');
    this.pickLevelButton = element(root, '.start-pick-level');
    this.hero = element(root, '.start-hero');
    this.title = element(root, '.start-title');
    const art = titleArt();
    // Each reveal step is drawn once here, so replaying the reveal on every visit builds no new images.
    this.titleUrls = Array.from({ length: ditherSteps + 1 }, (_, shown) => {
      const rows = art.rows.map((row, y) =>
        [...row].map((symbol, x) => (ditherThreshold(x, y) < shown ? symbol : '.')).join(''),
      );
      return `url(${artUrl(root, { legend: art.legend, rows })})`;
    });
    this.title.style.setProperty('--art-width', String(art.rows[0]!.length));
    this.title.style.setProperty('--art-height', String(art.rows.length));
    for (const [button, width] of [
      [this.newGameButton, newGameWidth],
      [this.pickLevelButton, pickLevelWidth],
    ] as const) {
      button.style.setProperty('--art-width', String(width));
      button.style.setProperty('--art-height', String(continueHeight));
    }
    takeMenuKeys(root, this.screen);
  }

  whenNewGame(listener: () => void): void {
    this.newGameButton.addEventListener('click', listener);
  }

  whenPickingLevel(listener: () => void): void {
    this.pickLevelButton.addEventListener('click', listener);
  }

  animate(framesOpen: number): void {
    const shown = Math.min(ditherSteps, Math.floor(framesOpen / framesPerTitleThreshold));
    if (shown !== this.titleShown) {
      this.titleShown = shown;
      this.title.style.setProperty('--art', this.titleUrls[shown]!);
    }
    const pose = idleHeroPose('down', framesOpen);
    if (pose === this.heroPose) return;
    this.heroPose = pose;
    let url = this.heroUrls.get(pose);
    if (!url) {
      url = `url(${artUrl(this.root, pose)})`;
      this.heroUrls.set(pose, url);
    }
    this.hero.style.setProperty('--art', url);
    this.hero.style.setProperty('--art-width', String(pose.rows[0]!.length));
    this.hero.style.setProperty('--art-height', String(pose.rows.length));
  }

  show(): void {
    this.screen.hidden = false;
    this.newGameButton.focus({ preventScroll: true });
  }

  hide(): void {
    this.screen.hidden = true;
  }
}
