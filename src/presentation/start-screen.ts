import { PixelGrid, type Art } from './art/art';
import { glyphHeight, glyphWidth, letterGap, textWidth, writeText } from './art/font';
import { continueHeight, newGameWidth, pickLevelWidth } from './art/panel';
import { artUrl } from './canvas-art';
import { element } from './dom';
import { takeMenuKeys } from './menu-keys';

// ΠΟΛΥΧΡΩΜΗ means colorful, so its letters take the orb colors in turn, and the hero's name takes the gold of the stars.
const gameName = [
  { text: 'Η ΠΟΛΥΧΡΩΜΗ ΠΕΡΙΠΕΤΕΙΑ', colors: 'pp' + 'vtr'.repeat(3) + 'p'.repeat(11) },
  { text: 'ΤΗΣ ΝΟΥΚΙ', colors: 'pppp' + 'yyyyy' },
];
const gameNameLegend = { p: 'Paper', v: 'V2', t: 'T2', r: 'R2', y: 'Y2' } as const;
const lineHeight = 16;

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

  constructor(root: Document) {
    this.screen = element(root, '.start-screen');
    this.newGameButton = element(root, '.start-new-game');
    this.pickLevelButton = element(root, '.start-pick-level');
    const title = element<HTMLElement>(root, '.start-title');
    const art = titleArt();
    title.style.setProperty('--art', `url(${artUrl(root, art)})`);
    title.style.setProperty('--art-width', String(art.rows[0]!.length));
    title.style.setProperty('--art-height', String(art.rows.length));
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

  show(): void {
    this.screen.hidden = false;
    this.newGameButton.focus({ preventScroll: true });
  }

  hide(): void {
    this.screen.hidden = true;
  }
}
