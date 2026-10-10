import { PixelGrid, type Art } from './art/art';
import { glyphHeight, textWidth, writeText } from './art/font';
import { continueHeight, newGameWidth, pickLevelWidth } from './art/panel';
import { artUrl } from './canvas-art';
import { element } from './dom';
import { takeMenuKeys } from './menu-keys';

const gameName = ['Η ΠΟΛΥΧΡΩΜΗ ΠΕΡΙΠΕΤΕΙΑ', 'ΤΗΣ ΝΟΥΚΙ'];
const lineHeight = 16;

export function titleArt(): Art {
  const width = Math.max(...gameName.map(textWidth));
  const grid = new PixelGrid(width, (gameName.length - 1) * lineHeight + glyphHeight);
  gameName.forEach((line, index) =>
    writeText(grid, line, Math.floor((width - textWidth(line)) / 2), index * lineHeight, 'a'),
  );
  return grid.build({ a: 'Y2' });
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
