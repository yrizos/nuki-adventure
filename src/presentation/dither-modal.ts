import { PixelGrid } from './art/art';
import { artUrl } from './canvas-art';
import { ditheredArt, ditherSteps } from './ordered-dither';

const tile = new PixelGrid(4, 4, 'k').build({ k: 'Ink' });
// Every modal shares one width, so they all leave the same margin beside them in the narrowest column.
export const modalWidth = 164;

// A modal comes and goes through the ordered dither, one threshold per game frame like the message box. The same
// dithered tile masks its box and, up to half its thresholds, darkens what lies behind it, so the page underneath
// stays readable. The page behind is inert while the modal is up, so it takes no touches, focus or menu keys.
export class DitherModal {
  private readonly tileUrls: string[];
  private shown = 0;
  private target = 0;

  constructor(
    root: Document,
    private readonly modal: HTMLElement,
    private readonly box: HTMLElement,
    private readonly behind: HTMLElement,
    private readonly opener: HTMLElement,
  ) {
    this.tileUrls = Array.from(
      { length: ditherSteps + 1 },
      (_, shown) => `url(${artUrl(root, ditheredArt(tile, shown))})`,
    );
  }

  get isOpen(): boolean {
    return !this.modal.hidden;
  }

  // Choices act only on a whole modal, so a press during the dither never picks something half seen.
  get isWhole(): boolean {
    return this.isOpen && this.shown === ditherSteps && this.target === ditherSteps;
  }

  open(): void {
    this.shown = 0;
    this.target = ditherSteps;
    this.modal.hidden = false;
    this.behind.inert = true;
    this.draw();
  }

  close(): void {
    this.target = 0;
  }

  dismiss(): void {
    this.shown = 0;
    this.target = 0;
    this.modal.hidden = true;
    this.behind.inert = false;
  }

  advance(): void {
    if (this.modal.hidden || this.shown === this.target) return;
    this.shown += Math.sign(this.target - this.shown);
    if (this.shown > 0) return this.draw();
    // Focus goes back to what opened the modal, which only works once the page behind it is no longer inert.
    this.dismiss();
    this.opener.focus({ preventScroll: true });
  }

  private draw(): void {
    this.modal.style.setProperty('--backdrop', this.tileUrls[Math.floor(this.shown / 2)]!);
    if (this.shown === ditherSteps) this.box.style.removeProperty('--mask');
    else this.box.style.setProperty('--mask', this.tileUrls[this.shown]!);
  }
}
