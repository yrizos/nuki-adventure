import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { FakeDocument } from '../test-support/fake-document';
import { backWidth, newGameWidth, pickLevelWidth } from './art/panel';
import { sprite } from './picture';
import { StartScreen, titleArt } from './start-screen';

test('draws the game name from palette codes, inside the narrowest column', () => {
  const art = titleArt();
  expect(() => sprite(art)).not.toThrow();
  expect(art.rows[0]!.length).toBeLessThanOrEqual(180 - 16);
});

test.each([
  ['ΝΕΟ ΠΑΙΧΝΙΔΙ', newGameWidth],
  ['ΕΠΙΛΟΓΗ ΕΠΙΠΕΔΟΥ', pickLevelWidth],
  ['ΠΙΣΩ', backWidth],
])('draws the %s button inside the narrowest column', (_label, width) => {
  expect(width).toBeLessThanOrEqual(180 - 16);
});

test('the page offers exactly ΝΕΟ ΠΑΙΧΝΙΔΙ and ΕΠΙΛΟΓΗ ΕΠΙΠΕΔΟΥ on the start screen', () => {
  const page = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const section = /<section class="start-screen"[\s\S]*?<\/section>/.exec(page)![0];
  expect([...section.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map(([, label]) => label)).toEqual([
    'ΝΕΟ ΠΑΙΧΝΙΔΙ',
    'ΕΠΙΛΟΓΗ ΕΠΙΠΕΔΟΥ',
  ]);
});

function startScreen() {
  FakeDocument.stubGlobals();
  const root = new FakeDocument();
  const screen = root.createElement('section');
  screen.className = 'start-screen';
  screen.hidden = true;
  const [title, newGameButton, pickLevelButton] = ['start-title', 'start-new-game', 'start-pick-level'].map((name) => {
    const created = root.createElement(name === 'start-title' ? 'h1' : 'button');
    created.className = name;
    return created;
  });
  screen.append(title!, newGameButton!, pickLevelButton!);
  root.body.append(screen);
  const subject = new StartScreen(root as unknown as Document);
  const newGame = vi.fn();
  const pickingLevel = vi.fn();
  subject.whenNewGame(newGame);
  subject.whenPickingLevel(pickingLevel);
  subject.show();
  const key = (name: string): Event => {
    const event = Object.assign(new Event('keydown', { cancelable: true }), { key: name, repeat: false });
    root.dispatchEvent(event);
    return event;
  };
  return {
    root,
    screen,
    newGameButton: newGameButton!,
    pickLevelButton: pickLevelButton!,
    newGame,
    pickingLevel,
    key,
  };
}

test('shows the start screen with focus on ΝΕΟ ΠΑΙΧΝΙΔΙ', () => {
  const { root, screen, newGameButton } = startScreen();
  expect(screen.hidden).toBe(false);
  expect(root.activeElement).toBe(newGameButton);
});

test.each([
  ['ΝΕΟ ΠΑΙΧΝΙΔΙ', 'newGameButton', 'newGame', 'pickingLevel'],
  ['ΕΠΙΛΟΓΗ ΕΠΙΠΕΔΟΥ', 'pickLevelButton', 'pickingLevel', 'newGame'],
] as const)('clicking %s fires only its listener', (_label, button, fired, silent) => {
  const page = startScreen();
  page[button].click();
  expect(page[fired]).toHaveBeenCalledOnce();
  expect(page[silent]).not.toHaveBeenCalled();
});

test('a choose key on ΝΕΟ ΠΑΙΧΝΙΔΙ starts a new game', () => {
  const { newGame, pickingLevel, key } = startScreen();
  expect(key('Enter').defaultPrevented).toBe(true);
  expect(newGame).toHaveBeenCalledOnce();
  expect(pickingLevel).not.toHaveBeenCalled();
});

test('arrow keys move focus between the two buttons and a choose key picks the focused one', () => {
  const { root, newGameButton, pickLevelButton, newGame, pickingLevel, key } = startScreen();
  expect(key('ArrowDown').defaultPrevented).toBe(true);
  expect(root.activeElement).toBe(pickLevelButton);
  key('ArrowDown');
  expect(root.activeElement).toBe(pickLevelButton);
  key('ArrowUp');
  expect(root.activeElement).toBe(newGameButton);
  key('ArrowRight');
  expect(key('z').defaultPrevented).toBe(true);
  expect(pickingLevel).toHaveBeenCalledOnce();
  expect(newGame).not.toHaveBeenCalled();
});
