import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { audioWindow } from '../test-support/audio-context';
import { memoryStorage } from '../test-support/memory-storage';
import { Sound } from './sound';

const events = ['footstep', 'star', 'key', 'restoring', 'door'] as const;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
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

test.each(events)('%s is heard only while sound is on, and again once it is switched back on', (event) => {
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
  sound.toggle();
  sound[event]();
  expect(page.audio()!.heard().length).toBeGreaterThan(whileOn.length);
});

test('the hum keeps sounding at the volume asked for until it is set to zero or muted', () => {
  const page = audioWindow();
  const sound = new Sound(page.root);
  page.interact();
  sound.hum(0);
  expect(page.audio()!.sounding()).toEqual([]);
  sound.hum(0.5);
  expect(page.audio()!.sounding().length).toBeGreaterThan(0);
  sound.toggle();
  expect(page.audio()!.sounding()).toEqual([]);
  sound.toggle();
  sound.hum(0);
  expect(page.audio()!.sounding()).toEqual([]);
});

test.each(['star', 'key', 'restoring', 'gate', 'door'] as const)('%s vibrates even while sound is off', (event) => {
  const page = audioWindow();
  const sound = new Sound(page.root);
  sound[event]();
  expect(page.vibrate).toHaveBeenCalledOnce();
  sound.toggle();
  sound[event]();
  expect(page.vibrate).toHaveBeenCalledTimes(2);
});

test('the last key and repeated hints do not vibrate', () => {
  const page = audioWindow();
  const sound = new Sound(page.root);
  sound.key(true);
  sound.hint();
  expect(page.vibrate).not.toHaveBeenCalled();
  sound.hint(true);
  expect(page.vibrate).toHaveBeenCalledOnce();
});

test('footsteps, the hum and the arrival never vibrate', () => {
  const page = audioWindow();
  const sound = new Sound(page.root);
  page.interact();
  sound.footstep();
  sound.hum(0.5);
  sound.arrival();
  expect(page.vibrate).not.toHaveBeenCalled();
});

test('the plate thuds and chirps when pressed, clicks softly when released, and buzzes only when pressed', () => {
  const page = audioWindow();
  const sound = new Sound(page.root);
  page.interact();
  const before = page.audio()!.heard().length;
  sound.plate(true);
  const pressed = page.audio()!.heard().slice(before);
  expect(pressed).toEqual([73, 392, 523, 784]);
  expect(page.vibrate).toHaveBeenCalledOnce();
  sound.plate(false);
  expect(
    page
      .audio()!
      .heard()
      .slice(before + pressed.length),
  ).toEqual([523, 330]);
  expect(page.vibrate).toHaveBeenCalledOnce();
});
