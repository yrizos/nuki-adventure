import type { GameSession } from './game-session';
import { Picture } from './picture';
import { fitCanvas, minimumGamePixels, pixelAlignment } from './viewport-layout';

export class GameView {
  private readonly context: CanvasRenderingContext2D;
  private picture: Picture;
  private image: ImageData;
  private alignment = 0;

  constructor(
    private readonly screen: HTMLElement,
    private readonly view: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
  ) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The canvas cannot draw in 2D');
    this.context = context;
    this.picture = new Picture(1, 1);
    this.image = new ImageData(1, 1);
    this.updatePixelRatio();
    new ResizeObserver(() => {
      const ratio = window.devicePixelRatio || 1;
      this.alignment = pixelAlignment(screen.getBoundingClientRect().left - this.alignment, ratio);
      screen.style.setProperty('--pixel-alignment', `${this.alignment}px`);
      this.resizeFromLayout();
    }).observe(view);
    this.watchPixelRatio();
    this.resizeFromLayout();
  }

  paint(session: Pick<GameSession, 'paint'>): void {
    session.paint(this.picture);
    this.image.data.set(this.picture.pixels);
    this.context.putImageData(this.image, 0, 0);
  }

  private updatePixelRatio(): void {
    const ratio = window.devicePixelRatio || 1;
    this.screen.style.setProperty('--minimum-game-view', `${minimumGamePixels / ratio}px`);
    this.screen.style.setProperty('--device-pixel', `${1 / ratio}px`);
  }

  private resize(deviceWidth: number, deviceHeight: number): void {
    if (deviceWidth <= 0 || deviceHeight <= 0) return;
    const fit = fitCanvas(deviceWidth, deviceHeight);
    const ratio = window.devicePixelRatio || 1;
    this.canvas.style.width = `${(fit.width * fit.scale) / ratio}px`;
    this.canvas.style.height = `${(fit.height * fit.scale) / ratio}px`;
    if (fit.width === this.picture.width && fit.height === this.picture.height) return;
    this.canvas.width = fit.width;
    this.canvas.height = fit.height;
    this.context.imageSmoothingEnabled = false;
    this.picture = new Picture(fit.width, fit.height);
    this.image = new ImageData(fit.width, fit.height);
  }

  private resizeFromLayout(): void {
    const ratio = window.devicePixelRatio || 1;
    const bounds = this.view.getBoundingClientRect();
    this.resize(Math.ceil(bounds.width * ratio), Math.ceil(bounds.height * ratio));
  }

  private watchPixelRatio(): void {
    window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener(
      'change',
      () => {
        this.updatePixelRatio();
        this.resizeFromLayout();
        this.watchPixelRatio();
      },
      { once: true },
    );
  }
}
