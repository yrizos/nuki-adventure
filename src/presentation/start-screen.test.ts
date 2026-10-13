import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { FakeDocument } from '../test-support/fake-document';
import { glyphs, glyphWidth, letterGap, lineHeight } from './art/font';
import { backWidth, menuButtonWidth, panelArt } from './art/panel';
import { sprite } from './picture';
import { artUrl } from './canvas-art';
import { ditherThreshold } from './ordered-dither';
import { heroArt } from './sprite-library';
import { confirmArt } from './confirm-modal';
import { StartScreen, titleArt, type StartChoices } from './start-screen';

test('draws the game name from palette codes, inside the narrowest column', () => {
  const art = titleArt();
  expect(() => sprite(art)).not.toThrow();
  expect(art.rows[0]!.length).toBeLessThanOrEqual(180 - 16);
});

const keyCycle = ['V2', 'T2', 'R2'];
const titleLines: (readonly [string, string])[][] = [
  [
    ...[...'Η '].map((letter) => [letter, 'Paper'] as const),
    ...[...'ΠΟΛΥΧΡΩΜΗ'].map((letter, index) => [letter, keyCycle[index % 3]!] as const),
    ...[...' ΠΕΡΙΠΕΤΕΙΑ'].map((letter) => [letter, 'Paper'] as const),
  ],
  [
    ...[...'ΤΗΣ '].map((letter) => [letter, 'Paper'] as const),
    ...[...'ΝΟΥΚΙ'].map((letter) => [letter, 'Y2'] as const),
  ],
];

test('colors each letter of the game name with its palette code', () => {
  const art = titleArt();
  const width = art.rows[0]!.length;
  const violations: string[] = [];
  titleLines.forEach((line, lineIndex) => {
    const left = Math.floor((width - (line.length * (glyphWidth + letterGap) - letterGap)) / 2);
    line.forEach(([letter, expected], index) => {
      glyphs[letter]!.forEach((pixels, y) =>
        [...pixels].forEach((pixel, x) => {
          if (pixel !== '#') return;
          const symbol = art.rows[lineIndex * lineHeight + y]![left + index * (glyphWidth + letterGap) + x]!;
          const actual = art.legend[symbol];
          if (actual !== expected) violations.push(`line ${lineIndex + 1} letter ${index} ${letter}: ${actual}`);
        }),
      );
    });
  });
  expect([...new Set(violations)]).toEqual([]);
});

test('draws the game name only in Paper, V2, T2, R2 and Y2', () => {
  const art = titleArt();
  const allowed = new Set(['Paper', 'V2', 'T2', 'R2', 'Y2']);
  const used = new Set(
    art.rows.flatMap((row) => [...row].filter((symbol) => symbol !== '.')).map((s) => art.legend[s]),
  );
  expect([...used].filter((code) => !allowed.has(code!))).toEqual([]);
});

test.each([
  ['the menu buttons', menuButtonWidth],
  ['ΠΙΣΩ', backWidth],
])('draws %s inside the narrowest column', (_label, width) => {
  expect(width).toBeLessThanOrEqual(180 - 16);
});

test('draws every menu button and both answers at one width', () => {
  const widths = ['continue', 'pick-level', 'new-game', 'yes', 'no'].flatMap((name) =>
    [name, `${name}-pressed`].map((art) => panelArt[art]!.rows[0]!.length),
  );
  expect(new Set(widths)).toEqual(new Set([menuButtonWidth]));
});

test('the page offers ΣΥΝΕΧΕΙΑ, ΕΠΙΠΕΔΑ and ΝΕΟ ΠΑΙΧΝΙΔΙ on the start screen, and ΝΑΙ and ΟΧΙ on the confirmation', () => {
  const page = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const labels = (name: string) =>
    [
      ...new RegExp(`<section class="${name}"[\\s\\S]*?</section>`)
        .exec(page)![0]
        .matchAll(/<button[^>]*>([^<]*)<\/button>/g),
    ].map(([, label]) => label);
  expect(labels('start-screen')).toEqual(['ΣΥΝΕΧΕΙΑ', 'ΕΠΙΠΕΔΑ', 'ΝΕΟ ΠΑΙΧΝΙΔΙ']);
  expect(labels('confirm-modal')).toEqual(['ΝΑΙ', 'ΟΧΙ']);
});

test('draws the confirmation from the font inside the narrowest column', () => {
  const art = confirmArt();
  expect(() => sprite(art)).not.toThrow();
  expect(art.rows[0]!.length).toBeLessThanOrEqual(180 - 16);
});

function startScreen(choices: StartChoices = { canContinue: true, hasProgress: true }) {
  FakeDocument.stubGlobals();
  const root = new FakeDocument();
  const create = (tag: string, name: string) => {
    const created = root.createElement(tag);
    created.className = name;
    return created;
  };
  const screen = create('section', 'start-screen');
  screen.hidden = true;
  const title = create('h1', 'start-title');
  const continueButton = create('button', 'start-continue');
  const pickLevelButton = create('button', 'start-pick-level');
  const newGameButton = create('button', 'start-new-game');
  const hero = create('div', 'start-hero');
  screen.append(title, continueButton, pickLevelButton, newGameButton, hero);
  const confirmModal = create('section', 'confirm-modal');
  confirmModal.hidden = true;
  const yesButton = create('button', 'confirm-yes');
  const noButton = create('button', 'confirm-no');
  const confirmBox = create('div', 'confirm-box');
  confirmBox.append(create('p', 'confirm-text'), yesButton, noButton);
  confirmModal.append(confirmBox);
  root.body.append(screen, confirmModal);
  const subject = new StartScreen(root as unknown as Document);
  const continuing = vi.fn();
  const newGame = vi.fn();
  const pickingLevel = vi.fn();
  subject.whenContinuing(continuing);
  subject.whenNewGame(newGame);
  subject.whenPickingLevel(pickingLevel);
  subject.show(choices);
  const key = (name: string): Event => {
    const event = Object.assign(new Event('keydown', { cancelable: true }), { key: name, repeat: false });
    root.dispatchEvent(event);
    return event;
  };
  return {
    root,
    screen,
    subject,
    hero,
    title,
    continueButton,
    pickLevelButton,
    newGameButton,
    confirmModal,
    yesButton,
    noButton,
    continuing,
    newGame,
    pickingLevel,
    key,
  };
}

test('with no saved progress all three buttons show with only ΝΕΟ ΠΑΙΧΝΙΔΙ enabled, and a choose key starts a new game at once', () => {
  const { continueButton, pickLevelButton, newGameButton, confirmModal, newGame, key } = startScreen({
    canContinue: false,
    hasProgress: false,
  });
  expect([continueButton.hidden, pickLevelButton.hidden, newGameButton.hidden]).toEqual([false, false, false]);
  expect([continueButton.disabled, pickLevelButton.disabled, newGameButton.disabled]).toEqual([true, true, false]);
  expect(key('Enter').defaultPrevented).toBe(true);
  expect(newGame).toHaveBeenCalledOnce();
  expect(confirmModal.hidden).toBe(true);
});

test('with a level left unfinished all three buttons are enabled and ΣΥΝΕΧΕΙΑ has focus', () => {
  const { root, continueButton, pickLevelButton, newGameButton, continuing, key } = startScreen();
  expect([continueButton.disabled, pickLevelButton.disabled, newGameButton.disabled]).toEqual([false, false, false]);
  expect(root.activeElement).toBe(continueButton);
  key('Enter');
  expect(continuing).toHaveBeenCalledOnce();
});

test('with the game finished ΣΥΝΕΧΕΙΑ is disabled and ΕΠΙΠΕΔΑ has focus', () => {
  const { root, continueButton, pickLevelButton } = startScreen({ canContinue: false, hasProgress: true });
  expect([continueButton.disabled, pickLevelButton.disabled]).toEqual([true, false]);
  expect(root.activeElement).toBe(pickLevelButton);
});

test('arrow keys move focus through the buttons and a choose key picks the focused one', () => {
  const { root, continueButton, pickLevelButton, newGameButton, pickingLevel, continuing, key } = startScreen();
  expect(key('ArrowDown').defaultPrevented).toBe(true);
  expect(root.activeElement).toBe(pickLevelButton);
  key('ArrowDown');
  key('ArrowDown');
  expect(root.activeElement).toBe(newGameButton);
  key('ArrowUp');
  key('ArrowUp');
  expect(root.activeElement).toBe(continueButton);
  key('ArrowRight');
  expect(key('z').defaultPrevented).toBe(true);
  expect(pickingLevel).toHaveBeenCalledOnce();
  expect(continuing).not.toHaveBeenCalled();
});

const ditherFrames = 16;

function openModal(page: ReturnType<typeof startScreen>): void {
  page.newGameButton.click();
  for (let frame = 0; frame < ditherFrames; frame++) page.subject.animate(frame);
}

test('with saved progress ΝΕΟ ΠΑΙΧΝΙΔΙ dithers a modal in over the start screen, and ΟΧΙ dithers it out without starting', () => {
  const page = startScreen();
  const { root, screen, confirmModal, noButton, newGameButton, newGame, subject } = page;
  openModal(page);
  expect([screen.hidden, confirmModal.hidden]).toEqual([false, false]);
  expect(root.activeElement).toBe(noButton);
  noButton.click();
  expect(root.activeElement).toBe(newGameButton);
  for (let frame = 1; frame < ditherFrames; frame++) subject.animate(frame);
  expect(confirmModal.hidden).toBe(false);
  subject.animate(0);
  expect([screen.hidden, confirmModal.hidden]).toEqual([false, true]);
  expect(newGame).not.toHaveBeenCalled();
});

test('the answers do nothing until the modal is whole', () => {
  const { newGameButton, yesButton, noButton, confirmModal, newGame, subject } = startScreen();
  newGameButton.click();
  for (let frame = 1; frame < ditherFrames; frame++) subject.animate(frame);
  yesButton.click();
  noButton.click();
  expect(newGame).not.toHaveBeenCalled();
  subject.animate(0);
  yesButton.click();
  expect(newGame).toHaveBeenCalledOnce();
  expect(confirmModal.hidden).toBe(false);
});

test('while the modal is open the keys move only between its answers', () => {
  const page = startScreen();
  openModal(page);
  const { root, yesButton, noButton, key } = page;
  key('ArrowUp');
  key('ArrowUp');
  expect(root.activeElement).toBe(yesButton);
  key('ArrowDown');
  key('ArrowDown');
  expect(root.activeElement).toBe(noButton);
});

test('ΝΑΙ on the confirmation starts a new game, chosen by keys too', () => {
  const page = startScreen();
  openModal(page);
  const { root, yesButton, newGame, key } = page;
  key('ArrowUp');
  expect(root.activeElement).toBe(yesButton);
  key('Enter');
  expect(newGame).toHaveBeenCalledOnce();
});

test('draws ΟΧΙ in the B button colors and ΝΑΙ in the A button colors', () => {
  expect(new Set(Object.values(panelArt.no!.legend))).toContain('W2');
  expect(new Set(Object.values(panelArt.yes!.legend))).toContain('R2');
});

test.each([
  ['standing', 0, heroArt.down.stand],
  ['blinking', 180, heroArt.down.blink!],
] as const)('shows Nuki facing the player %s at frame %i, at her art size', (_pose, frame, art) => {
  const { root, subject, hero } = startScreen();
  subject.animate(frame);
  expect(['--art', '--art-width', '--art-height'].map((name) => hero.style.getPropertyValue(name))).toEqual([
    `url(${artUrl(root as unknown as Document, art)})`,
    String(art.rows[0]!.length),
    String(art.rows.length),
  ]);
});

function titleUrl(root: FakeDocument, keep: (x: number, y: number) => boolean): string {
  const art = titleArt();
  const rows = art.rows.map((row, y) => [...row].map((symbol, x) => (keep(x, y) ? symbol : '.')).join(''));
  return `url(${artUrl(root as unknown as Document, { legend: art.legend, rows })})`;
}

test('reveals the title through the ordered dither, one threshold every 2 frames', () => {
  const { root, subject, title } = startScreen();
  const expected = Array.from({ length: 17 }, (_, shown) => titleUrl(root, (x, y) => ditherThreshold(x, y) < shown));
  const violations: number[] = [];
  for (const frame of [...Array.from({ length: 41 }, (_, frame) => frame), 1000]) {
    subject.animate(frame);
    if (title.style.getPropertyValue('--art') !== expected[Math.min(16, Math.floor(frame / 2))]) violations.push(frame);
  }
  expect(violations).toEqual([]);
});

test('shows no title at frame 0 and the whole title from frame 32 on', () => {
  const { root, subject, title } = startScreen();
  const shownAt = (frame: number) => {
    subject.animate(frame);
    return title.style.getPropertyValue('--art');
  };
  const whole = `url(${artUrl(root as unknown as Document, titleArt())})`;
  expect([shownAt(0), shownAt(32), shownAt(33), shownAt(600)]).toEqual([
    titleUrl(root, () => false),
    whole,
    whole,
    whole,
  ]);
});

test('reopening the start screen replays the title reveal from empty', () => {
  const { root, subject, title } = startScreen();
  for (let frame = 0; frame <= 40; frame += 1) subject.animate(frame);
  subject.animate(0);
  expect(title.style.getPropertyValue('--art')).toBe(titleUrl(root, () => false));
});

test('the buttons work at frame 0 of the title reveal', () => {
  const { subject, continueButton, continuing, pickingLevel, key } = startScreen();
  subject.animate(0);
  continueButton.click();
  key('ArrowDown');
  key('Enter');
  expect([continuing.mock.calls.length, pickingLevel.mock.calls.length]).toEqual([1, 1]);
});
