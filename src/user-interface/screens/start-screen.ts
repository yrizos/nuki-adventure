import { menuButtonWidth, textButtonHeight } from '../graphics/panel';
import { artUrl } from '../graphics/canvas-art';
import { ConfirmModal } from './confirm-modal';
import { element } from '../shell/dom';
import { menuChoices, takeMenuKeys } from './menu-keys';
import { ditheredArt, ditherSteps } from '../graphics/ordered-dither';
import { titleArt } from './title-logo';

const framesPerTitleThreshold = 2;

export interface StartChoices {
  readonly canContinue: boolean;
  readonly hasProgress: boolean;
}

export class StartScreen {
  private readonly screen: HTMLElement;
  private readonly continueButton: HTMLButtonElement;
  private readonly pickLevelButton: HTMLButtonElement;
  private readonly newGameButton: HTMLButtonElement;
  private readonly confirm: ConfirmModal;
  private choices: StartChoices = { canContinue: false, hasProgress: false };
  private readonly title: HTMLElement;
  private readonly titleUrls: string[];
  private titleShown = -1;

  constructor(root: Document) {
    this.screen = element(root, '.start-screen');
    this.continueButton = element(root, '.start-continue');
    this.pickLevelButton = element(root, '.start-pick-level');
    this.newGameButton = element(root, '.start-new-game');
    this.confirm = new ConfirmModal(root, this.screen, this.newGameButton);
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
    this.confirm.whenNo(() => this.confirm.close());
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
