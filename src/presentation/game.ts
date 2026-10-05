import { PlayLevel } from '../application/play-level';
import type { OrbColor } from '../domain/level/level';
import type { TilePosition } from '../domain/level/position';
import { firstLevel, firstLevelId } from '../infrastructure/first-level';
import { InMemoryLevelRepository } from '../infrastructure/in-memory-level-repository';
import type { Art } from './art/art';
import { panelArt } from './art/panel';
import { Controls } from './controls';
import { HeroAnimator } from './hero-animator';
import { Picture, sprite } from './picture';
import { tileSize, WorldPainter } from './world-painter';

const frameLength = 1000 / 60;
const holdFrames = 30;
const smallestViewTiles = 7;

type Phase =
  | { readonly name: 'playing' }
  | { readonly name: 'holding'; readonly until: number; readonly origin: TilePosition; readonly color: OrbColor }
  | { readonly name: 'restoring'; readonly since: number; readonly origin: TilePosition }
  | { readonly name: 'restored' };

function element<T extends HTMLElement>(root: Document, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`The page has no ${selector}`);
  return found;
}

interface CanvasFit {
  readonly width: number;
  readonly height: number;
  readonly scale: number;
}

export function fitCanvas(deviceWidth: number, deviceHeight: number): CanvasFit {
  if (!Number.isFinite(deviceWidth) || !Number.isFinite(deviceHeight) || deviceWidth <= 0 || deviceHeight <= 0) {
    throw new RangeError('The game view needs positive finite device dimensions');
  }
  const smallest = smallestViewTiles * tileSize;
  // Only a whole number of device pixels per game pixel keeps every game pixel the same size.
  const scale = Math.max(1, Math.floor(Math.min(deviceWidth, deviceHeight) / smallest));
  return { width: Math.ceil(deviceWidth / scale), height: Math.ceil(deviceHeight / scale), scale };
}

function artUrl(root: Document, art: Art): string {
  const { width, height, colored } = sprite(art);
  const canvas = root.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const image = new ImageData(width, height);
  image.data.set(colored);
  canvas.getContext('2d')?.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

export function startGame(root: Document): void {
  const screen = element<HTMLElement>(root, '.screen');
  for (const [name, art] of Object.entries(panelArt)) screen.style.setProperty(`--art-${name}`, `url(${artUrl(root, art)})`);
  const view = element<HTMLElement>(root, '.game-view');
  const canvas = element<HTMLCanvasElement>(root, '.game-view canvas');
  const controls = new Controls(element(root, '.control-panel'), element(root, '.joystick'), element(root, '.knob'), {
    a: element(root, '.button-a'),
    b: element(root, '.button-b'),
  });

  const context = canvas.getContext('2d');
  if (!context) throw new Error('The canvas cannot draw in 2D');
  let picture = new Picture(1, 1);
  let image = new ImageData(1, 1);
  let alignment = 0;

  const updatePixelRatio = (): void => {
    const ratio = window.devicePixelRatio || 1;
    screen.style.setProperty('--minimum-game-view', `${(smallestViewTiles * tileSize) / ratio}px`);
    screen.style.setProperty('--device-pixel', `${1 / ratio}px`);
  };
  updatePixelRatio();

  const resize = (deviceWidth: number, deviceHeight: number): void => {
    if (deviceWidth <= 0 || deviceHeight <= 0) return;
    const fit = fitCanvas(deviceWidth, deviceHeight);
    const ratio = window.devicePixelRatio || 1;
    canvas.style.width = `${(fit.width * fit.scale) / ratio}px`;
    canvas.style.height = `${(fit.height * fit.scale) / ratio}px`;
    if (fit.width === picture.width && fit.height === picture.height) return;
    canvas.width = fit.width;
    canvas.height = fit.height;
    context.imageSmoothingEnabled = false;
    picture = new Picture(fit.width, fit.height);
    image = new ImageData(fit.width, fit.height);
  };
  const resizeFromLayout = (): void => {
    const ratio = window.devicePixelRatio || 1;
    const bounds = view.getBoundingClientRect();
    resize(Math.ceil(bounds.width * ratio), Math.ceil(bounds.height * ratio));
  };
  // Device emulation can report devicePixelContentBoxSize in CSS pixels, so the canvas is sized from layout and the device pixel ratio instead.
  new ResizeObserver(() => {
    const ratio = window.devicePixelRatio || 1;
    const left = screen.getBoundingClientRect().left - alignment;
    alignment = Math.round(left * ratio) / ratio - left;
    screen.style.setProperty('--pixel-alignment', `${alignment}px`);
    resizeFromLayout();
  }).observe(view);
  // A media query only reports leaving one pixel ratio, so a fresh query is needed after every zoom or display change.
  const watchPixelRatio = (): void => {
    window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener(
      'change',
      () => {
        updatePixelRatio();
        resizeFromLayout();
        watchPixelRatio();
      },
      { once: true },
    );
  };
  watchPixelRatio();
  resizeFromLayout();

  const play = new PlayLevel(new InMemoryLevelRepository([firstLevel()]));
  const level = play.view(firstLevelId);
  const painter = new WorldPainter(level);
  const animator = new HeroAnimator();
  let phase: Phase = { name: 'playing' };
  let frame = 0;

  const tick = (): void => {
    if (phase.name === 'playing') {
      const [completed] = play.advance(firstLevelId, controls.direction());
      if (completed) phase = { name: 'holding', until: frame + holdFrames, origin: completed.restorationOrigin, color: completed.collectedOrbColor };
    } else if (phase.name === 'holding' && frame >= phase.until) {
      phase = { name: 'restoring', since: frame, origin: phase.origin };
    } else if (phase.name === 'restoring' && frame - phase.since >= painter.restorationLength(phase.origin)) {
      phase = { name: 'restored' };
    }
    animator.advance(level.hero);
    controls.advance();
    frame++;
  };

  const render = (): void => {
    const scene = {
      level: play.view(firstLevelId),
      frame,
      hero: animator.pose(level.hero, frame, phase.name === 'holding'),
      heldOrb: phase.name === 'holding' ? phase.color : null,
    };
    if (phase.name === 'restoring') painter.paintRestoring(picture, scene, phase.origin, frame - phase.since);
    else painter.paint(picture, scene, phase.name === 'restored' ? 'colored' : 'faded');
    image.data.set(picture.pixels);
    context.putImageData(image, 0, 0);
  };

  let previous = performance.now();
  let pending = 0;
  const loop = (now: number): void => {
    // Capping the catch-up keeps a backgrounded tab from fast-forwarding the game when it returns.
    pending = Math.min(pending + now - previous, frameLength * 10);
    previous = now;
    while (pending >= frameLength) {
      tick();
      pending -= frameLength;
    }
    render();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
