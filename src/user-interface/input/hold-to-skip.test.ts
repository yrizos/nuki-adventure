import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { FakeDocument, FakeHTMLElement } from '../testing/fake-document';
import { HoldToSkip } from './hold-to-skip';

beforeEach(() => FakeDocument.stubGlobals());
afterEach(() => vi.unstubAllGlobals());

function holding() {
  const keyboard = new EventTarget();
  const surface = new FakeHTMLElement('main');
  const subject = new HoldToSkip(keyboard, surface as unknown as HTMLElement);
  const key = (
    type: 'keydown' | 'keyup',
    name: string,
    options: { repeat?: boolean; metaKey?: boolean } = {},
  ): void => {
    keyboard.dispatchEvent(
      Object.assign(new Event(type), { key: name, code: '', repeat: false, metaKey: false, ...options }),
    );
  };
  const pointer = (type: string, pointerId = 1): void => {
    surface.dispatchEvent(Object.assign(new Event(type), { pointerId }));
  };
  return { subject, keyboard, surface, key, pointer };
}

test('holds while a key pressed during the scene is down', () => {
  const { subject, key } = holding();
  subject.listen();
  key('keydown', 'a');
  expect(subject.isHeld).toBe(true);
  key('keyup', 'a');
  expect(subject.isHeld).toBe(false);
});

test('holds while a touch that started during the scene is down, even once it is released outside', () => {
  const { subject, surface, pointer } = holding();
  subject.listen();
  pointer('pointerdown');
  expect(subject.isHeld).toBe(true);
  expect(surface.capturedPointers.has(1)).toBe(true);
  pointer('lostpointercapture');
  expect(subject.isHeld).toBe(false);
});

test('never counts a press from before the scene, a key repeat or Escape', () => {
  const { subject, key, pointer } = holding();
  key('keydown', 'a');
  pointer('pointerdown');
  subject.listen();
  key('keydown', 'a', { repeat: true });
  key('keydown', 'Escape');
  expect(subject.isHeld).toBe(false);
});

test('ignores shortcuts with Meta, and letting go of Meta lets go of keys whose release macOS never reports', () => {
  const { subject, key } = holding();
  subject.listen();
  key('keydown', 'r', { metaKey: true });
  expect(subject.isHeld).toBe(false);
  key('keydown', 'a');
  key('keydown', 'Meta', { metaKey: true });
  key('keyup', 'Meta');
  expect(subject.isHeld).toBe(false);
});

test('lets go of everything when the page loses focus or the scene stops listening', () => {
  const { subject, keyboard, key, pointer } = holding();
  subject.listen();
  key('keydown', 'a');
  keyboard.dispatchEvent(new Event('blur'));
  expect(subject.isHeld).toBe(false);
  pointer('pointerdown');
  subject.stop();
  expect(subject.isHeld).toBe(false);
  key('keydown', 'b');
  expect(subject.isHeld).toBe(false);
});
