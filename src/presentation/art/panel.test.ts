import { expect, test } from 'vitest';
import { sprite } from '../picture';
import { controlSize, lipHeight, panelArt } from './panel';

test.each(Object.keys(panelArt))('%s builds from palette codes', (name) => {
  expect(() => sprite(panelArt[name]!)).not.toThrow();
});

test.each(['knob', 'button-a', 'button-b'])('pressed %s sinks into its lip instead of keeping it', (name) => {
  const rest = panelArt[name]!.rows;
  const pressed = panelArt[`${name === 'knob' ? 'knob-held' : `${name}-pressed`}`]!.rows;
  for (const rows of [rest, pressed]) {
    expect(rows).toHaveLength(controlSize + lipHeight);
    expect(rows.every((row) => row.length === controlSize)).toBe(true);
  }
  expect(rest.at(-1)).not.toMatch(/^\.+$/);
  expect(pressed.slice(0, lipHeight).every((row) => /^\.+$/.test(row))).toBe(true);
  expect(pressed.slice(lipHeight)).toEqual(expect.arrayContaining([expect.stringMatching(/k/)]));
});
