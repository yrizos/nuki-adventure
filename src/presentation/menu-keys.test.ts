import { expect, test, vi } from 'vitest';
import { FakeDocument } from '../test-support/fake-document';
import { focusAfter, takeMenuKeys } from './menu-keys';

test.each([
  ['ArrowDown', 0, 1],
  ['ArrowRight', 0, 1],
  ['ArrowDown', 3, 3],
  ['ArrowUp', 2, 1],
  ['ArrowLeft', 2, 1],
  ['ArrowUp', 0, 0],
])('moves focus with %s from choice %s to %s of four', (key, from, to) => {
  expect(focusAfter(key, from, 4)).toBe(to);
});

test('a hidden menu leaves the keys to the game', () => {
  FakeDocument.stubGlobals();
  const root = new FakeDocument();
  const menu = root.createElement('section');
  const choice = root.createElement('button');
  menu.append(choice);
  root.body.append(menu);
  menu.hidden = true;
  takeMenuKeys(root as unknown as Document, menu as unknown as HTMLElement);
  choice.focus();
  const clicked = vi.fn();
  choice.addEventListener('click', clicked);
  const event = Object.assign(new Event('keydown', { cancelable: true }), { key: 'Enter', repeat: false });
  root.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
  expect(clicked).not.toHaveBeenCalled();
});
