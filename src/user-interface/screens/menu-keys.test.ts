import { expect, test, vi } from 'vitest';
import { FakeDocument } from '../testing/fake-document';
import { takeMenuKeys } from './menu-keys';

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
