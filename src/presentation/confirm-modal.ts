import { PixelGrid, type Art } from './art/art';
import { glyphHeight, lineHeight, textWidth, writeText } from './art/font';
import { menuButtonWidth, panelArt, textButtonHeight } from './art/panel';
import { artUrl } from './canvas-art';
import { element } from './dom';
import { windowFrame, windowLegend } from './level-picker';
import { takeMenuKeys } from './menu-keys';
import { ditheredArt, ditherSteps } from './ordered-dither';

const lines = ['ΝΕΟ ΠΑΙΧΝΙΔΙ;', 'Η ΠΡΟΟΔΟΣ ΘΑ ΧΑΘΕΙ.'];
const padding = 16;
const textGap = 16;
const buttonGap = 8;
const textHeight = (lines.length - 1) * lineHeight + glyphHeight;
const backdropTile = new PixelGrid(4, 4, 'k').build({ k: 'Ink' });

// The box is drawn whole with the question in it, and the page lays the buttons over its lower part.
export function confirmArt(): Art {
  const width = Math.max(...lines.map(textWidth), menuButtonWidth) + 2 * padding;
  const height = 2 * padding + textHeight + textGap + 2 * textButtonHeight + buttonGap;
  const grid = windowFrame(width, height);
  lines.forEach((text, line) =>
    writeText(grid, text, Math.floor((width - textWidth(text)) / 2), padding + line * lineHeight, 't'),
  );
  return grid.build(windowLegend);
}

// The modal comes and goes through the ordered dither, one threshold per game frame like the message box.
// Its answers only act once it is whole, so a press during the dither never chooses something half seen.
export class ConfirmModal {
  private readonly modal: HTMLElement;
  private readonly box: HTMLElement;
  private readonly yesButton: HTMLButtonElement;
  private readonly noButton: HTMLButtonElement;
  private readonly boxUrls: string[];
  private readonly yesUrls: string[];
  private readonly noUrls: string[];
  private readonly backdropUrls: string[];
  private shown = 0;
  private target = 0;

  constructor(root: Document) {
    this.modal = element(root, '.confirm-modal');
    this.box = element(root, '.confirm-box');
    this.yesButton = element(root, '.confirm-yes');
    this.noButton = element(root, '.confirm-no');
    const steps = (art: Art): string[] =>
      Array.from({ length: ditherSteps + 1 }, (_, shown) => `url(${artUrl(root, ditheredArt(art, shown))})`);
    const box = confirmArt();
    this.boxUrls = steps(box);
    this.yesUrls = steps(panelArt.yes!);
    this.noUrls = steps(panelArt.no!);
    // The backdrop stops at half the thresholds, so the start screen stays readable behind it.
    this.backdropUrls = steps(backdropTile).slice(0, ditherSteps / 2 + 1);
    this.box.style.setProperty('--art-width', String(box.rows[0]!.length));
    this.box.style.setProperty('--art-height', String(box.rows.length));
    this.box.style.setProperty('--box-padding', String(padding));
    this.box.style.setProperty('--box-text-gap', String(textGap));
    this.box.style.setProperty('--box-button-gap', String(buttonGap));
    for (const button of [this.yesButton, this.noButton]) {
      button.style.setProperty('--art-width', String(menuButtonWidth));
      button.style.setProperty('--art-height', String(textButtonHeight));
    }
    const text = element<HTMLElement>(root, '.confirm-text');
    text.style.setProperty('--art-width', String(box.rows[0]!.length - 2 * padding));
    text.style.setProperty('--art-height', String(textHeight));
    takeMenuKeys(root, this.modal);
  }

  get isWhole(): boolean {
    return !this.modal.hidden && this.shown === ditherSteps && this.target === ditherSteps;
  }

  whenYes(listener: () => void): void {
    this.yesButton.addEventListener('click', () => {
      if (this.isWhole) listener();
    });
  }

  whenNo(listener: () => void): void {
    this.noButton.addEventListener('click', () => {
      if (this.isWhole) listener();
    });
  }

  open(): void {
    this.shown = 0;
    this.target = ditherSteps;
    this.modal.hidden = false;
    this.draw();
    this.noButton.focus({ preventScroll: true });
  }

  close(): void {
    this.target = 0;
  }

  dismiss(): void {
    this.shown = 0;
    this.target = 0;
    this.modal.hidden = true;
  }

  advance(): void {
    if (this.modal.hidden || this.shown === this.target) return;
    this.shown += Math.sign(this.target - this.shown);
    if (this.shown === 0) this.modal.hidden = true;
    else this.draw();
  }

  // A whole modal hands its buttons back to the stylesheet, so pressing them shows their pressed art.
  private draw(): void {
    const whole = this.shown === ditherSteps;
    this.box.style.setProperty('--art', this.boxUrls[this.shown]!);
    this.modal.style.setProperty('--art', this.backdropUrls[Math.floor(this.shown / 2)]!);
    for (const [button, urls] of [
      [this.yesButton, this.yesUrls],
      [this.noButton, this.noUrls],
    ] as const)
      if (whole) button.style.removeProperty('--art');
      else button.style.setProperty('--art', urls[this.shown]!);
  }
}
