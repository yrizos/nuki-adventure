import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { FakeDocument } from '../testing/fake-document';
import { backWidth, menuButtonWidth, panelArt } from '../graphics/panel';
import { sprite } from '../graphics/picture';
import { artUrl } from '../graphics/canvas-art';
import { ditherThreshold } from '../graphics/ordered-dither';
import { confirmArt } from './confirm-modal';
import { StartScreen, type StartChoices } from './start-screen';
import { sparkleMargin, titleArt, titleShineArts, titleSparkleArts } from './title-logo';

test('draws the game name from palette codes, inside the narrowest column', () => {
  const art = titleArt();
  expect(() => sprite(art)).not.toThrow();
  expect(art.rows[0]!.length).toBeLessThanOrEqual(180 - 16);
});

test('draws the game name only in its rainbow, sticker, outline and shadow colors', () => {
  const art = titleArt();
  const allowed = new Set([
    'Paper',
    'Ink',
    ...['R', 'O', 'Y', 'T', 'V', 'P'].flatMap((ramp) => [1, 2, 3].map((step) => `${ramp}${step}`)),
    'G2',
    'G3',
    'G4',
  ]);
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
  const page = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
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
  const sparkles = create('span', 'start-sparkles');
  title.append(sparkles);
  const continueButton = create('button', 'start-continue');
  const pickLevelButton = create('button', 'start-pick-level');
  const newGameButton = create('button', 'start-new-game');
  screen.append(title, continueButton, pickLevelButton, newGameButton);
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
    title,
    sparkles,
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
  for (let frame = 1; frame < ditherFrames; frame++) subject.animate(frame);
  expect(confirmModal.hidden).toBe(false);
  subject.animate(0);
  expect([screen.hidden, confirmModal.hidden]).toEqual([false, true]);
  expect(root.activeElement).toBe(newGameButton);
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

function titleUrl(root: FakeDocument, keep: (x: number, y: number) => boolean): string {
  const art = titleArt();
  const rows = art.rows.map((row, y) => [...row].map((symbol, x) => (keep(x, y) ? symbol : '.')).join(''));
  return `url(${artUrl(root as unknown as Document, { legend: art.legend, rows })})`;
}

test('reveals the title through the ordered dither, one threshold every 2 frames', () => {
  const { root, subject, title } = startScreen();
  const expected = Array.from({ length: 17 }, (_, shown) => titleUrl(root, (x, y) => ditherThreshold(x, y) < shown));
  const violations: number[] = [];
  for (let frame = 0; frame <= 40; frame++) {
    subject.animate(frame);
    if (title.style.getPropertyValue('--art') !== expected[Math.min(16, Math.floor(frame / 2))]) violations.push(frame);
  }
  expect(violations).toEqual([]);
});

test('shows no title at frame 0 and the whole title from frame 32 until the first shine at frame 212', () => {
  const { root, subject, title } = startScreen();
  const shownAt = (frame: number) => {
    subject.animate(frame);
    return title.style.getPropertyValue('--art');
  };
  const whole = `url(${artUrl(root as unknown as Document, titleArt())})`;
  expect([shownAt(0), shownAt(32), shownAt(33), shownAt(211)]).toEqual([
    titleUrl(root, () => false),
    whole,
    whole,
    whole,
  ]);
});

test('sweeps the shine across the title one step per frame, then rests for 180 frames before the next sweep', () => {
  const { root, subject, title } = startScreen();
  const shines = titleShineArts().map((art) => `url(${artUrl(root as unknown as Document, art)})`);
  const whole = `url(${artUrl(root as unknown as Document, titleArt())})`;
  const end = 212 + shines.length;
  const shownAt = (frame: number) => {
    subject.animate(frame);
    return title.style.getPropertyValue('--art');
  };
  expect([shownAt(212), shownAt(213), shownAt(end - 1), shownAt(end), shownAt(end + 179), shownAt(end + 180)]).toEqual([
    shines[0],
    shines[1],
    shines.at(-1),
    whole,
    whole,
    shines[0],
  ]);
});

test('the shine crosses every letter and lights only letter pixels, in Paper and the light step of each ramp', () => {
  const art = titleArt();
  const code = (x: number, y: number) => art.legend[art.rows[y]?.[x] ?? '.'];
  // V1 is both the violet dark step and the shadow. Shadow columns run down to the empty edge, and letters end on the outline.
  const isLetter = (x: number, y: number): boolean => {
    if (['Paper', 'Ink', undefined].includes(code(x, y))) return false;
    let below = y;
    while (code(x, below) === 'V1') below++;
    return code(x, below) !== undefined;
  };
  const lit = new Set<string>();
  const violations = new Set<string>();
  for (const shine of titleShineArts()) {
    shine.rows.forEach((row, y) =>
      [...row].forEach((symbol, x) => {
        const before = code(x, y)!;
        const after = shine.legend[symbol];
        if (after === before) return;
        lit.add(`${x},${y}`);
        const ramp = before[0];
        if (!isLetter(x, y)) violations.add(`${before} at ${x},${y}`);
        else if (after !== 'Paper' && after !== `${ramp}${ramp === 'G' ? 4 : 3}`)
          violations.add(`${before} to ${after}`);
      }),
    );
  }
  const unlit = art.rows.flatMap((row, y) =>
    [...row].flatMap((_, x) => (isLetter(x, y) && !lit.has(`${x},${y}`) ? [`${x},${y}`] : [])),
  );
  expect([[...violations], unlit]).toEqual([[], []]);
});

test('draws the sparkles inside the narrowest column, only on the dark around the game name, in Paper and light ramp steps', () => {
  const title = titleArt();
  const sparkleArts = titleSparkleArts();
  const allowed = new Set(['Paper', 'R3', 'Y3', 'G4', 'T3', 'P3']);
  const violations = new Set<string>();
  for (const sparkle of sparkleArts) {
    expect(() => sprite(sparkle)).not.toThrow();
    sparkle.rows.forEach((row, y) =>
      [...row].forEach((symbol, x) => {
        if (symbol === '.') return;
        if (!allowed.has(sparkle.legend[symbol]!)) violations.add(`${sparkle.legend[symbol]} at ${x},${y}`);
        if ((title.rows[y - sparkleMargin]?.[x - sparkleMargin] ?? '.') !== '.')
          violations.add(`over the logo at ${x},${y}`);
      }),
    );
  }
  expect(sparkleArts[0]!.rows[0]!.length).toBeLessThanOrEqual(180 - 16);
  expect([...violations]).toEqual([]);
});

test('lights one sparkle at a time, every spot in turn, each growing to a star and shrinking back', () => {
  const sparkleArts = titleSparkleArts();
  const lit = (art: (typeof sparkleArts)[number]) =>
    art.rows.flatMap((row, y) => [...row].flatMap((symbol, x) => (symbol === '.' ? [] : [[x, y] as const])));
  const sizes = sparkleArts.map((art) => lit(art).length);
  const centers = sparkleArts.flatMap((art) => {
    const pixels = lit(art);
    if (pixels.length === 0) return [];
    const xs = pixels.map(([x]) => x);
    const ys = pixels.map(([, y]) => y);
    return [`${(Math.min(...xs) + Math.max(...xs)) / 2},${(Math.min(...ys) + Math.max(...ys)) / 2}`];
  });
  const sizesPerSparkle = 15;
  expect([sizes.length % sizesPerSparkle, new Set(centers).size]).toEqual([0, 5]);
  for (let start = 0; start < sizes.length; start += sizesPerSparkle)
    expect(sizes.slice(start, start + sizesPerSparkle)).toEqual([1, 5, 9, 5, 1, ...Array<number>(10).fill(0)]);
});

test('shows no sparkles until the title is whole, then steps them every 4 frames and loops', () => {
  const { root, subject, sparkles } = startScreen();
  const urls = titleSparkleArts().map((art) => `url(${artUrl(root as unknown as Document, art)})`);
  const dark = urls.at(-1);
  const shownAt = (frame: number) => {
    subject.animate(frame);
    return sparkles.style.getPropertyValue('--art');
  };
  const cycle = urls.length * 4;
  expect([shownAt(0), shownAt(31), shownAt(32), shownAt(35), shownAt(36), shownAt(40), shownAt(32 + cycle)]).toEqual([
    dark,
    dark,
    urls[0],
    urls[0],
    urls[1],
    urls[2],
    urls[0],
  ]);
  subject.hide();
  subject.show({ canContinue: true, hasProgress: true });
  expect(shownAt(0)).toBe(dark);
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
