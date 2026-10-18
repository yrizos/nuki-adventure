import { menuButtonWidth, textButtonHeight } from '../graphics/panel';
import { artUrl } from '../graphics/canvas-art';
import { ConfirmModal } from './confirm-modal';
import { element } from '../shell/dom';
import { menuChoices, takeMenuKeys } from './menu-keys';
import { ditheredArt, ditherSteps } from '../graphics/ordered-dither';
import { titleArt, titleShineArts } from './title-logo';

const framesPerTitleThreshold = 2;
const titleRevealLength = ditherSteps * framesPerTitleThreshold;
// A long rest keeps the shine an occasional glint rather than a constant flicker.
const shineRest = 180;

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
  private readonly shineUrls: string[];
  private titleShown = '';

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
    this.shineUrls = titleShineArts().map((shine) => `url(${artUrl(root, shine)})`);
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
    const sinceReveal = framesOpen - titleRevealLength;
    const shinePhase = sinceReveal < 0 ? -1 : (sinceReveal % (shineRest + this.shineUrls.length)) - shineRest;
    const shown =
      sinceReveal < 0
        ? this.titleUrls[Math.floor(framesOpen / framesPerTitleThreshold)]!
        : shinePhase < 0
          ? this.titleUrls[ditherSteps]!
          : this.shineUrls[shinePhase]!;
    if (shown !== this.titleShown) {
      this.titleShown = shown;
      this.title.style.setProperty('--art', shown);
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
