import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { audioWindow } from '../test-support/audio-context';
import { memoryStorage } from '../test-support/memory-storage';
import { Sound } from './sound';

const events = ['footstep', 'star', 'orb', 'restoring', 'door'] as const;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test('the switch turns sound off and back on', () => {
  const page = audioWindow();
  const sound = new Sound(page.root);
  page.interact();
  expect(sound.on).toBe(true);
  sound.toggle();
  expect(sound.on).toBe(false);
  sound.toggle();
  expect(sound.on).toBe(true);
  const before = page.audio()!.heard().length;
  sound.footstep();
  expect(page.audio()!.heard().slice(before)).toEqual([110]);
});

test('the next visit remembers whether sound was off', () => {
  const storage = memoryStorage();
  new Sound(audioWindow(storage).root).toggle();
  const muted = audioWindow(storage);
  const sound = new Sound(muted.root);
  expect(sound.on).toBe(false);
  muted.interact();
  sound.footstep();
  expect(muted.audio()!.heard()).toEqual([]);
  sound.toggle();
  expect(new Sound(audioWindow(storage).root).on).toBe(true);
});

test.each(events)('%s is heard only while sound is on', (event) => {
  const page = audioWindow();
  const sound = new Sound(page.root);
  page.interact();
  const before = page.audio()!.heard().length;
  sound[event]();
  const whileOn = page.audio()!.heard();
  expect(whileOn.length).toBeGreaterThan(before);
  sound.toggle();
  sound[event]();
  expect(page.audio()!.heard()).toEqual(whileOn);
});
