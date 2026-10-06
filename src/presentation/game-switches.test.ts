import { describe, expect, test, vi } from 'vitest';
import { connectGameSwitches } from './game-switches';

function fakeElement() {
  const attributes = new Map<string, string>();
  return Object.assign(new EventTarget(), {
    hidden: false,
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    getAttribute: (name: string) => attributes.get(name) ?? null,
    requestFullscreen: vi.fn(() => Promise.resolve()),
  });
}

function page({ fullscreenEnabled = true, on = true } = {}) {
  const soundSwitch = fakeElement();
  const fullScreenSwitch = fakeElement();
  const documentElement = fakeElement();
  const elements: Record<string, unknown> = {
    '.sound-switch': soundSwitch,
    '.full-screen-switch': fullScreenSwitch,
  };
  const root = Object.assign(new EventTarget(), {
    fullscreenEnabled,
    fullscreenElement: null as EventTarget | null,
    documentElement,
    querySelector: (selector: string) => elements[selector] ?? null,
    exitFullscreen: vi.fn(() => Promise.resolve()),
  });
  const sound = {
    on,
    toggle: vi.fn(() => {
      sound.on = !sound.on;
    }),
  };
  connectGameSwitches(root as unknown as Document, sound);
  const click = (target: EventTarget): void => void target.dispatchEvent(new Event('click'));
  return { root, sound, soundSwitch, fullScreenSwitch, documentElement, click };
}

describe('the sound switch', () => {
  test.each([true, false])('starts pressed as %s when sound is on', (on) => {
    expect(page({ on }).soundSwitch.getAttribute('aria-pressed')).toBe(String(on));
  });

  test('toggles the sound and shows its new state', () => {
    const subject = page();
    subject.click(subject.soundSwitch);
    expect(subject.sound.toggle).toHaveBeenCalledOnce();
    expect(subject.soundSwitch.getAttribute('aria-pressed')).toBe('false');
    subject.click(subject.soundSwitch);
    expect(subject.soundSwitch.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('the full screen switch', () => {
  test.each([
    [true, false],
    [false, true],
  ])('is hidden as %s where full screen is enabled as %s', (enabled, hidden) => {
    expect(page({ fullscreenEnabled: enabled }).fullScreenSwitch.hidden).toBe(hidden);
  });

  test('enters full screen with the whole page', () => {
    const subject = page();
    subject.click(subject.fullScreenSwitch);
    expect(subject.documentElement.requestFullscreen).toHaveBeenCalledOnce();
    expect(subject.root.exitFullscreen).not.toHaveBeenCalled();
  });

  test('leaves full screen while the page is full screen', () => {
    const subject = page();
    subject.root.fullscreenElement = subject.documentElement;
    subject.click(subject.fullScreenSwitch);
    expect(subject.root.exitFullscreen).toHaveBeenCalledOnce();
    expect(subject.documentElement.requestFullscreen).not.toHaveBeenCalled();
  });

  test('shows whether the page is full screen whenever that changes', () => {
    const subject = page();
    expect(subject.fullScreenSwitch.getAttribute('aria-pressed')).toBeNull();
    subject.root.fullscreenElement = subject.documentElement;
    subject.root.dispatchEvent(new Event('fullscreenchange'));
    expect(subject.fullScreenSwitch.getAttribute('aria-pressed')).toBe('true');
    subject.root.fullscreenElement = null;
    subject.root.dispatchEvent(new Event('fullscreenchange'));
    expect(subject.fullScreenSwitch.getAttribute('aria-pressed')).toBe('false');
  });

  test('ignores a refused full screen request', () => {
    const subject = page();
    const refusal = { catch: vi.fn<(onRejected: (reason: unknown) => void) => void>() };
    subject.documentElement.requestFullscreen.mockReturnValueOnce(refusal as unknown as Promise<void>);
    subject.click(subject.fullScreenSwitch);
    expect(refusal.catch).toHaveBeenCalledOnce();
    expect(() => refusal.catch.mock.calls[0]![0](new Error('refused'))).not.toThrow();
  });
});
