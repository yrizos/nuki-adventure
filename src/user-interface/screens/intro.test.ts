import { expect, test } from 'vitest';
import { FakeDocument, stubReducedMotion } from '../testing/fake-document';
import { neutralCode, palette } from '../graphics/palette';
import { Picture } from '../graphics/picture';
import { pixelDifference } from '../testing/pictures';
import { beatStart, boomFrame, revealLength, sinkStart, skipLength } from './intro-timeline';
import { Intro, introPage, narration, type Rectangle } from './intro';

const width = 234;
const height = 507;

function colorAt(picture: Picture, column: number, row: number): string {
  const offset = (row * picture.width + column) * 4;
  return `#${[...picture.pixels.subarray(offset, offset + 3)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

function intro(held = false) {
  FakeDocument.stubGlobals();
  const hold = { isHeld: held };
  const subject = new Intro(hold);
  const picture = new Picture(width, height);
  let frame = 0;
  const advanceTo = (target: number): Picture => {
    for (; frame < target; frame++) subject.tick();
    subject.paint(picture);
    return picture;
  };
  return { subject, hold, advanceTo };
}

const inside = (area: Rectangle, x: number, y: number): boolean =>
  x >= area.x && x < area.x + area.width && y >= area.y && y < area.y + area.height;

const overlaps = (a: Rectangle, b: Rectangle): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test.each([
  { name: 'a phone', page: { width: 234, height: 507 } },
  { name: 'a small phone', page: { width: 250, height: 445 } },
  { name: 'a desktop', page: { width: 298, height: 450 } },
])('fits all five panels on $name without overlapping', ({ page }) => {
  const panels = introPage(page.width, page.height);
  expect(panels).toHaveLength(5);
  for (const panel of panels) {
    expect([panel.x >= 0, panel.y >= 0]).toEqual([true, true]);
    expect([panel.x + panel.width <= page.width, panel.y + panel.height <= page.height]).toEqual([true, true]);
  }
  panels.forEach((panel, index) =>
    panels.slice(index + 1).forEach((other) => expect(overlaps(panel, other)).toBe(false)),
  );
});

test('keeps every panel on the page in its frame once it is shown', () => {
  const { advanceTo } = intro();
  const panels = introPage(width, height);
  const missing: string[] = [];
  for (let frame = revealLength; frame < sinkStart; frame += 8) {
    const picture = advanceTo(frame);
    panels.forEach((panel, index) => {
      if (frame < beatStart(index) + revealLength) return;
      const edges = [
        [panel.x + 1, panel.y + 2],
        [panel.x + panel.width - 2, panel.y + panel.height - 3],
      ] as const;
      if (frame >= boomFrame && frame < beatStart(3)) return;
      if (edges.some(([x, y]) => colorAt(picture, x, y) !== palette.V1))
        missing.push(`panel ${index + 1} at frame ${frame}`);
    });
  }
  expect(missing).toEqual([]);
});

test('nothing moves inside the panels once they are whole', () => {
  const { advanceTo } = intro();
  const still = new Picture(width, height);
  still.pixels.set(advanceTo(beatStart(4) + revealLength).pixels);
  expect(pixelDifference(advanceTo(sinkStart - 1), still)).toBeUndefined();
});

test('is Ink everywhere outside the panels', () => {
  const { advanceTo } = intro();
  const panels = introPage(width, height);
  const strays: string[] = [];
  for (const frame of [0, beatStart(2) - 1, sinkStart - 1, sinkStart + 24]) {
    const picture = advanceTo(frame);
    sweep: for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (panels.some((panel) => inside(panel, x, y))) continue;
        if (colorAt(picture, x, y) !== palette.Ink) {
          strays.push(`frame ${frame}, pixel ${x}, ${y}`);
          break sweep;
        }
      }
    }
  }
  expect(strays).toEqual([]);
});

test('the last panel shows Nuki in color in a gray orchard', () => {
  const picture = intro().advanceTo(sinkStart - 1);
  const panel = introPage(width, height)[4]!;
  const neutrals = new Set(neutralCode.options.map((code) => palette[code]));
  const colors = new Set<string>();
  for (let y = panel.y; y < panel.y + panel.height; y++)
    for (let x = panel.x; x < panel.x + panel.width; x++) colors.add(colorAt(picture, x, y));
  const colored = [...colors].filter((color) => !neutrals.has(color));
  expect(colored).toContain(palette.P2);
  expect(colored).not.toContain(palette.G2);
});

test('narrates the newest panel from the first frame of its beat', () => {
  const { subject, advanceTo } = intro();
  expect(subject.messageText).toBe(narration[0]);
  advanceTo(beatStart(4) - 1);
  expect(subject.messageText).toBe(narration[3]);
  advanceTo(beatStart(4));
  expect(subject.messageText).toBe(narration[4]);
});

test('a full hold skips, and letting go before the end starts the hold over', () => {
  const { subject, hold, advanceTo } = intro(true);
  advanceTo(skipLength - 1);
  hold.isHeld = false;
  advanceTo(skipLength);
  hold.isHeld = true;
  advanceTo(2 * skipLength - 1);
  expect(subject.finished).toBe(false);
  advanceTo(2 * skipLength);
  expect(subject.finished).toBe(true);
});

test('shows the skip circle only while a press is held, filling clockwise from the top with Paper', () => {
  const { hold, advanceTo } = intro();
  const left = width - 8 - 13;
  const top = height - 8 - 13;
  let frame = 1;
  const topPixel = (): string => colorAt(advanceTo(frame), left + 7, top + 2);
  const leftPixel = (): string => colorAt(advanceTo(frame), left + 2, top + 6);
  expect(topPixel()).toBe(palette.Ink);
  hold.isHeld = true;
  frame = 2;
  expect([topPixel(), leftPixel()]).toEqual([palette.N1, palette.N1]);
  frame = 1 + skipLength / 2;
  expect([topPixel(), leftPixel()]).toEqual([palette.Paper, palette.N1]);
  hold.isHeld = false;
  frame += 1;
  expect(topPixel()).toBe(palette.Ink);
});

test('with reduced motion the page does not tremble at the boom', () => {
  const { advanceTo } = intro();
  stubReducedMotion(true);
  const trembling = new Picture(width, height);
  trembling.pixels.set(advanceTo(boomFrame + 2).pixels);
  expect(pixelDifference(advanceTo(boomFrame + 30), trembling)).toBeUndefined();
});
