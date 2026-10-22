import { expect, test, vi } from 'vitest';
import { watchPageLifecycle } from './page-lifecycle';

function watched() {
  const root = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const target = new EventTarget();
  const whenHidden = vi.fn();
  const whenVisible = vi.fn();
  watchPageLifecycle(root as unknown as Document, target as unknown as Window, whenHidden, whenVisible);
  return { root, target, whenHidden, whenVisible };
}

test('hiding the page saves the level', () => {
  const { root, whenHidden, whenVisible } = watched();
  root.visibilityState = 'hidden';
  root.dispatchEvent(new Event('visibilitychange'));
  expect(whenHidden).toHaveBeenCalledTimes(1);
  expect(whenVisible).not.toHaveBeenCalled();
});

test('showing the page again lets the game loop rest', () => {
  const { root, whenHidden, whenVisible } = watched();
  root.dispatchEvent(new Event('visibilitychange'));
  expect(whenVisible).toHaveBeenCalledTimes(1);
  expect(whenHidden).not.toHaveBeenCalled();
});

test('leaving the page saves the level too', () => {
  const { target, whenHidden } = watched();
  target.dispatchEvent(new Event('pagehide'));
  expect(whenHidden).toHaveBeenCalledTimes(1);
});
