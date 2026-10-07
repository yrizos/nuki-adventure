import { describe, expect, test, vi } from 'vitest';
import { Playthrough, PlayTime } from '../domain/progress/playthrough';
import { StarCount } from '../domain/shared/star-count';
import { continueHeight, continueWidth } from './art/panel';
import { continueTop, LevelEndWindow, levelEndArt, levelEndText, playTime } from './level-end';
import { sprite } from './picture';

const playthrough = (frames: number, collectedStars: number, starCount: number): Playthrough =>
  Playthrough.of(PlayTime.ofFrames(frames), StarCount.of(collectedStars), StarCount.of(starCount));

test.each([
  [0, '0:00'],
  [59, '0:00'],
  [60, '0:01'],
  [60 * 65, '1:05'],
  [60 * 60 * 120, '120:00'],
])('shows %s frames as %s', (frames, shown) => {
  expect(playTime(PlayTime.ofFrames(frames))).toBe(shown);
});

test('reads the time and the stars out for screen readers', () => {
  expect(levelEndText(playthrough(60 * 83, 3, 5))).toBe('ΜΠΡΑΒΟ! ΧΡΟΝΟΣ 1:23. ΑΣΤΕΡΙΑ 3/5.');
});

test.each([
  [60 * 83, 0, 1],
  [60 * 83, 3, 5],
  [60 * 60 * 120, 12, 40],
])(
  'builds from palette codes for %s frames and %s of %s stars, inside the narrowest column',
  (frames, collectedStars, starCount) => {
    const art = levelEndArt(playthrough(frames, collectedStars, starCount));
    expect(() => sprite(art)).not.toThrow();
    expect(art.rows[0]!.length).toBeLessThanOrEqual(180 - 32);
    expect(art.rows.length).toBeGreaterThan(continueTop + continueHeight);
  },
);

describe('the level end window', () => {
  function fakeElement() {
    const properties = new Map<string, string>();
    return Object.assign(new EventTarget(), {
      hidden: true,
      textContent: '',
      style: { setProperty: (name: string, value: string) => properties.set(name, value) },
      property: (name: string) => properties.get(name),
      focus: vi.fn(),
    });
  }

  function opened() {
    vi.stubGlobal(
      'ImageData',
      class {
        readonly data: Uint8ClampedArray;
        constructor(width: number, height: number) {
          this.data = new Uint8ClampedArray(width * height * 4);
        }
      },
    );
    const elements = {
      '.level-end': fakeElement(),
      '.level-end-card': fakeElement(),
      '.level-end-summary': fakeElement(),
      '.continue-button': fakeElement(),
    };
    const canvas = { width: 0, height: 0, getContext: () => ({ putImageData: () => {} }), toDataURL: () => 'data:art' };
    const root = {
      querySelector: (selector: keyof typeof elements) => elements[selector],
      createElement: () => canvas,
    };
    const onContinue = vi.fn();
    const window = new LevelEndWindow(root as unknown as Document);
    window.whenContinued(onContinue);
    return {
      window,
      onContinue,
      overlay: elements['.level-end'],
      card: elements['.level-end-card'],
      summary: elements['.level-end-summary'],
      button: elements['.continue-button'],
    };
  }

  test('sizes the continue button from its art before it opens', () => {
    const subject = opened();
    expect(subject.button.property('--button-top')).toBe(String(continueTop));
    expect(subject.button.property('--button-width')).toBe(String(continueWidth));
    expect(subject.button.property('--button-height')).toBe(String(continueHeight));
    expect(subject.overlay.hidden).toBe(true);
  });

  test('shows the result art, summary and focused continue button', () => {
    const subject = opened();
    const result = playthrough(60 * 83, 3, 5);
    subject.window.show(result);
    const art = levelEndArt(result);
    const width = art.rows[0]!.length;
    expect(subject.card.property('--art')).toBe('url(data:art)');
    expect(subject.card.property('--card-width')).toBe(String(width));
    expect(subject.card.property('--card-height')).toBe(String(art.rows.length));
    expect(subject.button.property('--button-left')).toBe(String(Math.floor((width - continueWidth) / 2)));
    expect(subject.summary.textContent).toBe(levelEndText(result));
    expect(subject.overlay.hidden).toBe(false);
    expect(subject.button.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
  });

  test('hides again', () => {
    const subject = opened();
    subject.window.show(playthrough(0, 0, 1));
    subject.window.hide();
    expect(subject.overlay.hidden).toBe(true);
  });

  test('continues when its button is clicked', () => {
    const subject = opened();
    subject.button.dispatchEvent(new Event('click'));
    expect(subject.onContinue).toHaveBeenCalledOnce();
  });
});
