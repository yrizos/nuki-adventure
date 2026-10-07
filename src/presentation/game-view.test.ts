import { expect, test, vi } from 'vitest';
import { FakeDocument, type FakeCanvasElement, stubDisplay } from '../test-support/fake-document';
import { GameView } from './game-view';
import type { Picture } from './picture';

function gameView({ ratio = 1, width = 448, height = 600, left = 0 } = {}) {
  FakeDocument.stubGlobals();
  const display = stubDisplay(ratio);
  const root = new FakeDocument();
  const screen = root.createElement('div');
  const view = root.createElement('div');
  const canvas = root.createElement('canvas') as FakeCanvasElement;
  screen.bounds = { left, top: 0, width, height };
  view.bounds = { left, top: 0, width, height };
  const subject = new GameView(
    screen as unknown as HTMLElement,
    view as unknown as HTMLElement,
    canvas as unknown as HTMLCanvasElement,
  );
  return { subject, display, screen, view, canvas };
}

test('fits the canvas to the view in whole device pixels per game pixel', () => {
  const { screen, canvas } = gameView({ ratio: 2, width: 224, height: 300 });
  expect([canvas.width, canvas.height]).toEqual([224, 300]);
  expect([canvas.style.width, canvas.style.height]).toEqual(['224px', '300px']);
  expect(canvas.context.imageSmoothingEnabled).toBe(false);
  expect(screen.style.getPropertyValue('--minimum-game-view')).toBe('112px');
  expect(screen.style.getPropertyValue('--device-pixel')).toBe('0.5px');
});

test('shows what the session paints, then the overlay on top', () => {
  const { subject, canvas } = gameView();
  const session = { paint: vi.fn((picture: Picture) => picture.pixels.fill(7)) };
  const overlay = vi.fn(() => expect(canvas.context.shown?.data.every((value) => value === 7)).toBe(true));
  subject.paint(session, 0.5, overlay);
  expect(session.paint).toHaveBeenCalledWith(expect.objectContaining({ width: 224, height: 300 }), 0.5);
  expect([canvas.context.shown?.width, canvas.context.shown?.height]).toEqual([224, 300]);
  expect(overlay).toHaveBeenCalledExactlyOnceWith(canvas.context);
});

test('refits the canvas and aligns the screen to device pixels when the layout changes', () => {
  const { subject, display, screen, view, canvas } = gameView({ ratio: 2 });
  screen.bounds = { left: 10.3, top: 0, width: 300, height: 400 };
  view.bounds = { left: 10.3, top: 0, width: 300, height: 400 };
  display.relayout();
  expect(Number.parseFloat(screen.style.getPropertyValue('--pixel-alignment'))).toBeCloseTo(0.2);
  expect([canvas.width, canvas.height]).toEqual([300, 400]);
  const session = { paint: vi.fn() };
  subject.paint(session, 1);
  expect(session.paint).toHaveBeenCalledWith(expect.objectContaining({ width: 300, height: 400 }), 1);
});

test('keeps the last fit while the view has no size', () => {
  const { display, view, canvas } = gameView();
  view.bounds = { left: 0, top: 0, width: 0, height: 0 };
  display.relayout();
  expect([canvas.width, canvas.height]).toEqual([224, 300]);
  expect([canvas.style.width, canvas.style.height]).toEqual(['448px', '600px']);
});

test('refits after every change of the device pixel ratio', () => {
  const { display, screen, canvas } = gameView({ width: 330, height: 400 });
  expect([canvas.width, canvas.height]).toEqual([330, 400]);
  display.changeRatio(1.5);
  expect(screen.style.getPropertyValue('--device-pixel')).toBe(`${1 / 1.5}px`);
  expect([canvas.width, canvas.height]).toEqual([248, 300]);
  display.changeRatio(2);
  expect(screen.style.getPropertyValue('--device-pixel')).toBe('0.5px');
  expect([canvas.width, canvas.height]).toEqual([330, 400]);
});
