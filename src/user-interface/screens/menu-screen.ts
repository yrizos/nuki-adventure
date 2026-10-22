import { menuButtonWidth, textButtonHeight } from '../graphics/panel';
import { artUrl } from '../graphics/canvas-art';
import { ConfirmModal } from './confirm-modal';
import { element } from '../page/dom';
import { menuChoices, takeMenuKeys } from './menu-keys';
import { ditheredArt, ditherSteps } from '../graphics/ordered-dither';
import type { Art } from '../graphics/art';
import {
  confettiAbove,
  confettiSide,
  sparkleMargin,
  titleArt,
  titleConfettiArt,
  titleShineArts,
  titleSparkleArts,
} from './title-logo';

const framesPerTitleThreshold = 2;
export const titleRevealLength = ditherSteps * framesPerTitleThreshold;
// A long rest keeps the shine an occasional glint rather than a constant flicker.
const shineRest = 180;
const framesPerSparkleStep = 4;
// One pixel every 4 game frames keeps the confetti drifting rather than falling.
const framesPerConfettiStep = 4;

export interface StartChoices {
  readonly canContinue: boolean;
  readonly hasProgress: boolean;
}

export class MenuScreen {
  private readonly screen: HTMLElement;
  private readonly continueButton: HTMLButtonElement;
  private readonly pickLevelButton: HTMLButtonElement;
  private readonly newGameButton: HTMLButtonElement;
  private readonly confirm: ConfirmModal;
  private choices: StartChoices = { canContinue: false, hasProgress: false };
  private readonly root: Document;
  private readonly urls = new Map<Art, string>();
  private readonly title: HTMLElement;
  private readonly titleArts: Art[];
  private shines: Art[] | undefined;
  private titleShown: Art | undefined;
  private readonly sparkles: HTMLElement;
  private readonly sparkleArts: Art[];
  private sparklesShown: Art | undefined;
  private readonly confetti: HTMLElement;
  private readonly confettiUrl: string;
  private readonly confettiHeight: number;

  constructor(root: Document) {
    this.root = root;
    this.screen = element(root, '.menu-screen');
    this.continueButton = element(root, '.menu-continue');
    this.pickLevelButton = element(root, '.menu-pick-level');
    this.newGameButton = element(root, '.menu-new-game');
    this.confirm = new ConfirmModal(root, this.screen, this.newGameButton);
    this.title = element(root, '.menu-title');
    const art = titleArt();
    this.titleArts = Array.from({ length: ditherSteps + 1 }, (_, shown) => ditheredArt(art, shown));
    this.title.style.setProperty('--art-width', String(art.rows[0]!.length));
    this.title.style.setProperty('--art-height', String(art.rows.length));
    this.sparkles = element(root, '.menu-sparkles');
    this.sparkleArts = titleSparkleArts();
    this.sparkles.style.setProperty('--art-width', String(this.sparkleArts[0]!.rows[0]!.length));
    this.sparkles.style.setProperty('--art-height', String(this.sparkleArts[0]!.rows.length));
    this.sparkles.style.setProperty('--sparkle-margin', String(sparkleMargin));
    this.confetti = element(root, '.menu-confetti');
    const confettiArt = titleConfettiArt();
    this.confettiUrl = `url(${artUrl(root, confettiArt)})`;
    this.confettiHeight = confettiArt.rows.length;
    this.confetti.style.setProperty('--art-width', String(confettiArt.rows[0]!.length));
    this.confetti.style.setProperty('--art-height', String(this.confettiHeight));
    this.confetti.style.setProperty('--confetti-side', String(confettiSide));
    this.confetti.style.setProperty('--confetti-above', String(confettiAbove));
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
    const shinePhase = sinceReveal < 0 ? -1 : (sinceReveal % (shineRest + this.shineArts().length)) - shineRest;
    const shown =
      sinceReveal < 0
        ? this.titleArts[Math.floor(framesOpen / framesPerTitleThreshold)]!
        : shinePhase < 0
          ? this.titleArts[ditherSteps]!
          : this.shineArts()[shinePhase]!;
    if (shown !== this.titleShown) {
      this.titleShown = shown;
      this.title.style.setProperty('--art', this.url(shown));
    }
    const sparkles =
      this.sparkleArts[
        sinceReveal < 0
          ? this.sparkleArts.length - 1
          : Math.floor(sinceReveal / framesPerSparkleStep) % this.sparkleArts.length
      ]!;
    if (sparkles !== this.sparklesShown) {
      this.sparklesShown = sparkles;
      this.sparkles.style.setProperty('--art', this.url(sparkles));
    }
    this.confetti.style.setProperty('--art', sinceReveal < 0 ? 'none' : this.confettiUrl);
    this.confetti.style.setProperty(
      '--fall',
      String(sinceReveal < 0 ? 0 : Math.floor(sinceReveal / framesPerConfettiStep) % this.confettiHeight),
    );
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

  // The shine first plays seconds after the reveal, so its frames are not built before the first paint.
  private shineArts(): Art[] {
    this.shines ??= titleShineArts();
    return this.shines;
  }

  // Encoding every frame up front held back the first paint, so each frame is encoded when first shown and then reused.
  private url(art: Art): string {
    let url = this.urls.get(art);
    if (!url) {
      url = `url(${artUrl(this.root, art)})`;
      this.urls.set(art, url);
    }
    return url;
  }
}
