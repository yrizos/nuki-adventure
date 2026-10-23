import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { audioWindow } from '../testing/audio-context';
import { memoryStorage } from '../../progress/testing/memory-storage';
import { Sound } from './sound';

const events = ['footstep', 'orb', 'restoring', 'door', 'press', 'rise'] as const;

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

test.each(['orb', 'restoring', 'gate', 'door'] as const)('%s vibrates even while sound is off', (event) => {
  const page = audioWindow();
  const sound = new Sound(page.root);
  sound[event]();
  expect(page.vibrate).toHaveBeenCalledOnce();
  sound.toggle();
  sound[event]();
  expect(page.vibrate).toHaveBeenCalledTimes(2);
});

test('the last orb and repeated hints do not vibrate', () => {
  const page = audioWindow();
  const sound = new Sound(page.root);
  sound.orb(true);
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

const endTune = [262, 330, 392, 440, 392, 330, 294, 330, 220, 262, 330, 392, 330, 294, 262, 196];
const gameTune = [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1047, 988, 784, 659, 587];

test('no music plays until a tune is chosen', () => {
  const page = audioWindow();
  new Sound(page.root);
  page.interact();
  vi.advanceTimersByTime(60_000);
  expect(page.audio()!.heard()).toEqual([]);
});

test('switching tunes fades the old tune out for good', () => {
  const page = audioWindow();
  const sound = new Sound(page.root);
  page.interact();
  sound.music('game');
  expect(page.audio()!.heard()).toEqual(gameTune);
  sound.music('end');
  expect(page.audio()!.heard()).toEqual([...gameTune, ...endTune]);
  vi.advanceTimersByTime(60_000);
  const later = page
    .audio()!
    .heard()
    .slice(gameTune.length + endTune.length);
  expect(later.length).toBeGreaterThan(0);
  expect(later.every((frequency) => endTune.includes(frequency))).toBe(true);
});

test('silence stops the music for good', () => {
  const page = audioWindow();
  const sound = new Sound(page.root);
  page.interact();
  sound.music('game');
  sound.music(null);
  vi.advanceTimersByTime(60_000);
  expect(page.audio()!.heard()).toEqual(gameTune);
});

test('a tune chosen before the first interaction is the one that starts', () => {
  const page = audioWindow();
  const sound = new Sound(page.root);
  sound.music('game');
  page.interact();
  expect(page.audio()!.heard()).toEqual(gameTune);
});
