import { PixelGrid, type Art } from './art/art';
import { glyphHeight, glyphWidth, letterGap, lineHeight, textWidth, writeText } from './art/font';
import { menuButtonWidth, textButtonHeight } from './art/panel';
import { artUrl } from './canvas-art';
import { ConfirmModal } from './confirm-modal';
import { element } from './dom';
import { idleHeroPose } from './hero-animator';
import { menuChoices, takeMenuKeys } from './menu-keys';
import { ditheredArt, ditherSteps } from './ordered-dither';

// ΠΟΛΥΧΡΩΜΗ means colorful, so its letters take violet, teal and red in turn, and the hero's name takes the gold of the stars.
const gameName = [
  { text: 'Η ΠΟΛΥΧΡΩΜΗ ΠΕΡΙΠΕΤΕΙΑ', colors: 'pp' + 'vtr'.repeat(3) + 'p'.repeat(11) },
  { text: 'ΤΗΣ ΝΟΥΚΙ', colors: 'pppp' + 'yyyyy' },
];
const gameNameLegend = { p: 'Paper', v: 'V2', t: 'T2', r: 'R2', y: 'Y2' } as const;
const framesPerTitleThreshold = 2;

export interface StartChoices {
  readonly canContinue: boolean;
  readonly hasProgress: boolean;
}

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
  private readonly continueButton: HTMLButtonElement;
  private readonly pickLevelButton: HTMLButtonElement;
  private readonly newGameButton: HTMLButtonElement;
  private readonly confirm: ConfirmModal;
  private choices: StartChoices = { canContinue: false, hasProgress: false };
  private readonly hero: HTMLElement;
  private readonly title: HTMLElement;
  private readonly titleUrls: string[];
  private titleShown = -1;
  private readonly heroUrls = new Map<Art, string>();
  private heroPose: Art | null = null;

  constructor(private readonly root: Document) {
    this.screen = element(root, '.start-screen');
    this.continueButton = element(root, '.start-continue');
    this.pickLevelButton = element(root, '.start-pick-level');
    this.newGameButton = element(root, '.start-new-game');
    this.confirm = new ConfirmModal(root);
    this.hero = element(root, '.start-hero');
    this.title = element(root, '.start-title');
    const art = titleArt();
    // Each reveal step is drawn once here, so replaying the reveal on every visit builds no new images.
    this.titleUrls = Array.from(
      { length: ditherSteps + 1 },
      (_, shown) => `url(${artUrl(root, ditheredArt(art, shown))})`,
    );
    this.title.style.setProperty('--art-width', String(art.rows[0]!.length));
    this.title.style.setProperty('--art-height', String(art.rows.length));
    for (const button of [this.continueButton, this.pickLevelButton, this.newGameButton]) {
      button.style.setProperty('--art-width', String(menuButtonWidth));
      button.style.setProperty('--art-height', String(textButtonHeight));
    }
    this.newGameButton.addEventListener('click', () => {
      if (this.choices.hasProgress) this.confirm.open();
    });
    this.confirm.whenNo(() => {
      this.confirm.close();
      this.newGameButton.focus({ preventScroll: true });
    });
    // The modal sits over the start screen and was built first, so its key listener runs first while it is open.
    takeMenuKeys(root, this.screen);
  }

  whenContinuing(listener: () => void): void {
    this.continueButton.addEventListener('click', listener);
  }

  // Starting afresh deletes saved progress, so with progress saved it waits for ΝΑΙ.
  whenNewGame(listener: () => void): void {
    this.newGameButton.addEventListener('click', () => {
      if (!this.choices.hasProgress) listener();
    });
    this.confirm.whenYes(listener);
  }

  whenPickingLevel(listener: () => void): void {
    this.pickLevelButton.addEventListener('click', listener);
  }

  animate(framesOpen: number): void {
    this.confirm.advance();
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

  show(choices: StartChoices): void {
    this.choices = choices;
    this.continueButton.disabled = !choices.canContinue;
    this.pickLevelButton.disabled = !choices.hasProgress;
    this.confirm.dismiss();
    this.screen.hidden = false;
    menuChoices(this.screen)[0]?.focus({ preventScroll: true });
  }

  hide(): void {
    this.screen.hidden = true;
    this.confirm.dismiss();
  }
}
