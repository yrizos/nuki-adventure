import type { Art } from './art/art';
import { glyphHeight, lineHeight, textWidth, writeText } from './art/font';
import { menuButtonWidth, textButtonHeight } from './art/panel';
import { artUrl } from './canvas-art';
import { DitherModal, modalWidth } from './dither-modal';
import { element } from './dom';
import { windowFrame, windowLegend } from './level-picker';
import { takeMenuKeys } from './menu-keys';

const lines = ['ΝΕΟ ΠΑΙΧΝΙΔΙ;', 'Η ΠΡΟΟΔΟΣ ΘΑ ΧΑΘΕΙ.'];
const padding = 16;
const textGap = 16;
const buttonGap = 8;
const textHeight = (lines.length - 1) * lineHeight + glyphHeight;

// The box is drawn whole with the question in it, and the page lays the buttons over its lower part.
export function confirmArt(): Art {
  const width = modalWidth;
  const height = 2 * padding + textHeight + textGap + 2 * textButtonHeight + buttonGap;
  const grid = windowFrame(width, height);
  lines.forEach((text, line) =>
    writeText(grid, text, Math.floor((width - textWidth(text)) / 2), padding + line * lineHeight, 't'),
  );
  return grid.build(windowLegend);
}

export class ConfirmModal {
  private readonly dither: DitherModal;
  private readonly yesButton: HTMLButtonElement;
  private readonly noButton: HTMLButtonElement;

  constructor(root: Document, behind: HTMLElement, opener: HTMLElement) {
    const modal = element<HTMLElement>(root, '.confirm-modal');
    const box = element<HTMLElement>(root, '.confirm-box');
    this.dither = new DitherModal(root, modal, box, behind, opener);
    this.yesButton = element(root, '.confirm-yes');
    this.noButton = element(root, '.confirm-no');
    const art = confirmArt();
    box.style.setProperty('--art', `url(${artUrl(root, art)})`);
    box.style.setProperty('--art-width', String(art.rows[0]!.length));
    box.style.setProperty('--art-height', String(art.rows.length));
    box.style.setProperty('--box-padding', String(padding));
    box.style.setProperty('--box-text-gap', String(textGap));
    box.style.setProperty('--box-button-gap', String(buttonGap));
    for (const button of [this.yesButton, this.noButton]) {
      button.style.setProperty('--art-width', String(menuButtonWidth));
      button.style.setProperty('--art-height', String(textButtonHeight));
    }
    const text = element<HTMLElement>(root, '.confirm-text');
    text.style.setProperty('--art-width', String(art.rows[0]!.length - 2 * padding));
    text.style.setProperty('--art-height', String(textHeight));
    takeMenuKeys(root, modal);
  }

  whenYes(listener: () => void): void {
    this.yesButton.addEventListener('click', () => {
      if (this.dither.isWhole) listener();
    });
  }

  whenNo(listener: () => void): void {
    this.noButton.addEventListener('click', () => {
      if (this.dither.isWhole) listener();
    });
  }

  open(): void {
    this.dither.open();
    this.noButton.focus({ preventScroll: true });
  }

  close(): void {
    this.dither.close();
  }

  dismiss(): void {
    this.dither.dismiss();
  }

  advance(): void {
    this.dither.advance();
  }
}
