import type { Art } from './art/art';
import type { GameSession } from './game-session';
import { Picture, sprite } from './picture';
import { tileSize } from './world-painter';

export const minimumGamePixels = 7 * tileSize;

interface CanvasFit {
  readonly width: number;
  readonly height: number;
  readonly scale: number;
}

export function fitCanvas(deviceWidth: number, deviceHeight: number): CanvasFit {
  if (!Number.isFinite(deviceWidth) || !Number.isFinite(deviceHeight) || deviceWidth <= 0 || deviceHeight <= 0) {
    throw new RangeError('The game view needs positive finite device dimensions');
  }
  // Only a whole number of device pixels per game pixel keeps every game pixel the same size.
  const scale = Math.max(1, Math.floor(Math.min(deviceWidth, deviceHeight) / minimumGamePixels));
  return { width: Math.ceil(deviceWidth / scale), height: Math.ceil(deviceHeight / scale), scale };
}

export function element<T extends HTMLElement>(root: Document, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`The page has no ${selector}`);
  return found;
}

export function artUrl(root: Document, art: Art): string {
  const { width, height, colored } = sprite(art);
  const canvas = root.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const image = new ImageData(width, height);
  image.data.set(colored);
  canvas.getContext('2d')?.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

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
      const left = screen.getBoundingClientRect().left - this.alignment;
      this.alignment = Math.round(left * ratio) / ratio - left;
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
