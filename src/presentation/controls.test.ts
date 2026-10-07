import { afterEach, expect, test, vi } from 'vitest';
import { Direction, Heading } from '../domain/level/position';
import { FakeDocument, FakeHTMLElement, stubDisplay } from '../test-support/fake-document';
import { Controls } from './controls';

type Handler = (event: { data: { vector: { x: number; y: number }; force: number } }) => void;
const thumbs: { handlers: Map<string, Handler>; size: number; destroyed: boolean }[] = [];
vi.mock('nipplejs', () => ({
  create: (options: { size: number }) => {
    const thumb = { handlers: new Map<string, Handler>(), size: options.size, destroyed: false };
    thumbs.push(thumb);
    return {
      on: (name: string, handler: Handler) => thumb.handlers.set(name, handler),
      destroy: () => (thumb.destroyed = true),
    };
  },
}));

const toward = (direction: Direction): Heading => Heading.of(direction);

function controlElement(width = 120, left = 0, top = 0, height = width): FakeHTMLElement {
  const element = new FakeHTMLElement('div');
  element.bounds = { left, top, width, height };
  return element;
}

function setup() {
  FakeDocument.stubGlobals();
  const display = stubDisplay(1);
  const keyboard = display.window;
  const panel = controlElement(360, 0, 0, 184);
  const joystick = controlElement();
  joystick.style.paddingLeft = '6px';
  const knob = controlElement(56);
  const buttons = { a: controlElement(56, 272, 32), b: controlElement(56, 208, 96) };
  const html = (element: FakeHTMLElement): HTMLElement => element as unknown as HTMLElement;
  const controls = new Controls(html(panel), html(joystick), html(knob), {
    a: html(buttons.a),
    b: html(buttons.b),
  });
  const key = (type: 'keydown' | 'keyup', name: string, target = keyboard, repeat = false): Event => {
    const event = Object.assign(new Event(type, { cancelable: true }), { key: name, repeat });
    Object.defineProperty(event, 'target', { value: target });
    keyboard.dispatchEvent(event);
    return event;
  };
  const pointer = (type: string, clientX = 60, clientY = 60, pointerId = 1, target = joystick): void => {
    target.dispatchEvent(Object.assign(new Event(type), { pointerId, clientX, clientY }));
  };
  // NippleJS reports the thumb as a fraction of the reach, with up as positive.
  const thumb = (x: number, y: number): void => {
    const current = thumbs.at(-1)!;
    const reach = current.size / 2;
    const distance = Math.hypot(x, y);
    const clamped = distance > reach ? reach / distance : 1;
    const data = { vector: { x: (x * clamped) / reach, y: (-y * clamped) / reach }, force: distance / reach };
    current.handlers.get('start')!({ data });
    current.handlers.get('move')!({ data });
  };
  const slide = (x: number, y: number): void => {
    const current = thumbs.at(-1)!;
    const reach = current.size / 2;
    const data = { vector: { x: x / reach, y: -y / reach }, force: Math.hypot(x, y) / reach };
    current.handlers.get('move')!({ data });
  };
  const lift = (): void => thumbs.at(-1)!.handlers.get('end')!({ data: { vector: { x: 0, y: 0 }, force: 0 } });
  return {
    keyboard,
    panel,
    joystick,
    knob,
    buttons,
    controls,
    key,
    pointer,
    thumb,
    slide,
    lift,
    resize: display.relayout,
  };
}

afterEach(() => {
  thumbs.length = 0;
});

test.each([' ', 'Enter'])('%s on a native button neither presses game buttons nor prevents activation', (name) => {
  const { buttons, controls, key } = setup();
  const target = new FakeHTMLElement('button');
  const down = key('keydown', name, target);
  expect(buttons.a.classList.contains('pressed')).toBe(false);
  expect(buttons.b.classList.contains('pressed')).toBe(false);
  const up = key('keyup', name, target);
  expect(buttons.a.classList.contains('pressed')).toBe(false);
  expect(buttons.b.classList.contains('pressed')).toBe(false);
  expect(controls.takePress('a')).toBe(false);
  expect(controls.takePress('b')).toBe(false);
  expect(down.defaultPrevented).toBe(false);
  expect(up.defaultPrevented).toBe(false);
});

test.each(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])(
  '%s on an interactive target leaves movement and joystick visuals unchanged',
  (name) => {
    const { joystick, knob, controls, key } = setup();
    const direction = joystick.dataset.direction;
    const transform = knob.style.transform;
    const event = key('keydown', name, new FakeHTMLElement('button'));
    expect(controls.heading()).toBeNull();
    expect(joystick.classList.contains('active')).toBe(false);
    expect(joystick.dataset.direction).toBe(direction);
    expect(knob.style.transform).toBe(transform);
    expect(event.defaultPrevented).toBe(false);
  },
);

test.each([
  ['button', () => new FakeHTMLElement('button')],
  ['anchor', () => new FakeHTMLElement('a', { href: '/level' })],
  ['input', () => new FakeHTMLElement('input')],
  ['select', () => new FakeHTMLElement('select')],
  ['textarea', () => new FakeHTMLElement('textarea')],
  ['summary', () => new FakeHTMLElement('summary')],
  ['button child', () => new FakeHTMLElement('span', {}, new FakeHTMLElement('button'))],
  ['tabindex zero', () => new FakeHTMLElement('div', { tabindex: '0' })],
  ['tabindex negative', () => new FakeHTMLElement('div', { tabindex: '-1' })],
  ['tabindex ancestor', () => new FakeHTMLElement('span', {}, new FakeHTMLElement('div', { tabindex: '0' }))],
  ...['button', 'link', 'textbox', 'checkbox', 'slider', 'combobox'].map(
    (role) => [`${role} role`, () => new FakeHTMLElement('div', { role })] as const,
  ),
] as const)('%s owns keyboard input instead of the game', (_label, target) => {
  const { controls, key } = setup();
  const event = key('keydown', 'ArrowUp', target());
  expect(controls.heading()).toBeNull();
  expect(event.defaultPrevented).toBe(false);
});

test.each([
  ['empty', () => new FakeHTMLElement('div', { contenteditable: '' })],
  ['true', () => new FakeHTMLElement('div', { contenteditable: 'true' })],
  ['plaintext-only', () => new FakeHTMLElement('div', { contenteditable: 'plaintext-only' })],
  ...['', 'true', 'plaintext-only'].map(
    (value) =>
      [
        `inherited ${value || 'empty'}`,
        () => new FakeHTMLElement('span', {}, new FakeHTMLElement('div', { contenteditable: value })),
      ] as const,
  ),
  [
    'invalid inherits true',
    () =>
      new FakeHTMLElement(
        'span',
        { contenteditable: 'invalid' },
        new FakeHTMLElement('div', { contenteditable: 'true' }),
      ),
  ],
] as const)('contenteditable %s owns keyboard input', (_label, target) => {
  const { buttons, joystick, knob, controls, key } = setup();
  const element = target();
  const direction = joystick.dataset.direction;
  const transform = knob.style.transform;
  const event = key('keydown', 'z', element);
  expect(buttons.a.classList.contains('pressed')).toBe(false);
  expect(controls.takePress('a')).toBe(false);
  expect(event.defaultPrevented).toBe(false);
  const arrow = key('keydown', 'ArrowUp', element);
  expect(controls.heading()).toBeNull();
  expect(joystick.classList.contains('active')).toBe(false);
  expect(joystick.dataset.direction).toBe(direction);
  expect(knob.style.transform).toBe(transform);
  expect(arrow.defaultPrevented).toBe(false);
});

test.each([
  ['false', () => new FakeHTMLElement('div', { contenteditable: 'false' })],
  ['invalid', () => new FakeHTMLElement('div', { contenteditable: 'invalid' })],
  [
    'false overrides editable ancestor',
    () =>
      new FakeHTMLElement(
        'span',
        { contenteditable: 'false' },
        new FakeHTMLElement('div', { contenteditable: 'true' }),
      ),
  ],
  [
    'invalid inherits false',
    () =>
      new FakeHTMLElement(
        'span',
        { contenteditable: 'invalid' },
        new FakeHTMLElement('div', { contenteditable: 'false' }),
      ),
  ],
] as const)('contenteditable %s remains a gameplay target', (_label, target) => {
  const { buttons, controls, key } = setup();
  const element = target();
  expect(key('keydown', 'z', element).defaultPrevented).toBe(true);
  expect(buttons.a.classList.contains('pressed')).toBe(true);
  expect(controls.takePress('a')).toBe(true);
  key('keyup', 'z', element);
  expect(buttons.a.classList.contains('pressed')).toBe(false);
});

test.each([
  ['ArrowUp', Direction.Up, 'translate(0px, -26px)'],
  ['ArrowDown', Direction.Down, 'translate(0px, 26px)'],
  ['ArrowLeft', Direction.Left, 'translate(-26px, 0px)'],
  ['ArrowRight', Direction.Right, 'translate(26px, 0px)'],
])('%s on a gameplay element moves and releases the joystick', (name, direction, transform) => {
  const { joystick, knob, controls, key } = setup();
  const target = new FakeHTMLElement('canvas');
  expect(key('keydown', name, target).defaultPrevented).toBe(true);
  expect(controls.heading()).toEqual(toward(direction));
  expect(joystick.classList.contains('active')).toBe(true);
  expect(joystick.dataset.direction).toBe(direction.name);
  expect(knob.style.transform).toBe(transform);
  key('keyup', name, target);
  expect(controls.heading()).toBeNull();
  expect(joystick.classList.contains('active')).toBe(false);
  expect(joystick.dataset.direction).toBe('');
  for (let frame = 0; frame < 4; frame++) controls.advance();
  expect(knob.style.transform).toBe('');
});

test.each([
  ['Z', 'a'],
  ['z', 'a'],
  [' ', 'a'],
  ['X', 'b'],
  ['x', 'b'],
  ['Enter', 'b'],
] as const)('%s on a gameplay element queues one press and holds %s until release', (name, button) => {
  const { buttons, controls, key } = setup();
  const target = new FakeHTMLElement('canvas');
  expect(key('keydown', name, target).defaultPrevented).toBe(true);
  expect(buttons[button].classList.contains('pressed')).toBe(true);
  expect(controls.takePress(button)).toBe(true);
  expect(controls.takePress(button)).toBe(false);
  expect(key('keydown', name, target, true).defaultPrevented).toBe(true);
  expect(controls.takePress(button)).toBe(false);
  expect(buttons[button].classList.contains('pressed')).toBe(true);
  key('keyup', name, target);
  expect(buttons[button].classList.contains('pressed')).toBe(false);
});

test.each([
  [' ', 'a'],
  ['Enter', 'b'],
] as const)('returning to gameplay after UI %s has no stale %s press', (name, button) => {
  const { buttons, controls, key } = setup();
  const target = new FakeHTMLElement('button');
  key('keydown', name, target);
  key('keyup', name, target);
  key('keydown', 'ArrowUp', new FakeHTMLElement('canvas'));
  expect(controls.takePress(button)).toBe(false);
  expect(buttons[button].classList.contains('pressed')).toBe(false);
  key('keydown', name, new FakeHTMLElement('canvas'));
  expect(controls.takePress(button)).toBe(true);
  expect(controls.takePress(button)).toBe(false);
});

test.each(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])(
  'UI keyup for %s preserves game-owned movement and joystick visuals',
  (name) => {
    const { joystick, knob, controls, key } = setup();
    key('keydown', name);
    const heading = controls.heading();
    const direction = joystick.dataset.direction;
    const transform = knob.style.transform;
    expect(key('keyup', name, new FakeHTMLElement('button')).defaultPrevented).toBe(false);
    expect(controls.heading()).toEqual(heading);
    expect(joystick.classList.contains('active')).toBe(true);
    expect(joystick.dataset.direction).toBe(direction);
    expect(knob.style.transform).toBe(transform);
    key('keyup', name);
    expect(controls.heading()).toBeNull();
  },
);

test('UI keyup during joystick touch preserves the game-owned arrow restored on lift', () => {
  const { controls, key, thumb, lift } = setup();
  key('keydown', 'ArrowUp');
  thumb(32, 0);
  key('keyup', 'ArrowUp', new FakeHTMLElement('button'));
  expect(controls.heading()).toEqual(toward(Direction.Right));
  lift();
  expect(controls.heading()).toEqual(toward(Direction.Up));
});

test.each([
  ['z', 'a', 300, 60],
  ['x', 'b', 236, 124],
] as const)('UI keyup for %s preserves game-owned %s after its touch releases', (name, button, clientX, clientY) => {
  const { panel, buttons, controls, key, pointer } = setup();
  key('keydown', name);
  pointer('pointerdown', clientX, clientY, 1, panel);
  expect(controls.takePress(button)).toBe(true);
  expect(key('keyup', name, new FakeHTMLElement('input')).defaultPrevented).toBe(false);
  expect(buttons[button].classList.contains('pressed')).toBe(true);
  expect(controls.takePress(button)).toBe(false);
  pointer('pointerup', clientX, clientY, 1, panel);
  expect(buttons[button].classList.contains('pressed')).toBe(true);
  key('keyup', name);
  expect(buttons[button].classList.contains('pressed')).toBe(false);
});

test.each([
  ['ArrowUp', Direction.Up, 'translate(0px, -26px)'],
  ['ArrowDown', Direction.Down, 'translate(0px, 26px)'],
  ['ArrowLeft', Direction.Left, 'translate(-26px, 0px)'],
  ['ArrowRight', Direction.Right, 'translate(26px, 0px)'],
])('%s moves the knob with the hero and recenters on release', (arrow, direction, transform) => {
  const { joystick, knob, controls, key } = setup();
  key('keydown', arrow);
  expect(controls.heading()).toEqual(toward(direction));
  expect(knob.style.transform).toBe(transform);
  expect(joystick.classList.contains('active')).toBe(true);
  key('keyup', arrow);
  expect(controls.heading()).toBeNull();
  for (let frame = 0; frame < 4; frame++) controls.advance();
  expect(knob.style.transform).toBe('');
  expect(joystick.classList.contains('active')).toBe(false);
});

test('perpendicular held arrows combine and releasing one restores the remaining arrow', () => {
  const { knob, controls, key } = setup();
  key('keydown', 'ArrowLeft');
  key('keydown', 'ArrowUp');
  key('keydown', 'ArrowLeft');
  expect(controls.heading()).toEqual(toward(Direction.UpLeft));
  const travel = 18;
  expect(knob.style.transform).toBe(`translate(${-travel}px, ${-travel}px)`);
  key('keyup', 'ArrowRight');
  expect(controls.heading()).toEqual(toward(Direction.UpLeft));
  key('keyup', 'ArrowUp');
  expect(controls.heading()).toEqual(toward(Direction.Left));
  expect(knob.style.transform).toBe('translate(-26px, 0px)');
});

test.each([
  ['ArrowLeft', 'ArrowRight', Direction.Left, Direction.Right],
  ['ArrowUp', 'ArrowDown', Direction.Up, Direction.Down],
])(
  'the latest opposite arrow wins over %s until %s is released',
  (previous, latest, previousDirection, latestDirection) => {
    const { controls, key } = setup();
    key('keydown', previous);
    key('keydown', latest);
    key('keydown', previous);
    expect(controls.heading()).toEqual(toward(latestDirection));
    key('keyup', latest);
    expect(controls.heading()).toEqual(toward(previousDirection));
    key('keyup', previous);
    expect(controls.heading()).toBeNull();
  },
);

test('touch owns the knob until it lifts and restores keyboard input', () => {
  const { knob, controls, key, thumb, lift } = setup();
  thumb(32, 0);
  key('keydown', 'ArrowUp');
  expect(controls.heading()).toEqual(toward(Direction.Right));
  expect(knob.style.transform).toBe('translate(26px, 0px)');
  lift();
  expect(controls.heading()).toEqual(toward(Direction.Up));
  expect(knob.style.transform).toBe('translate(0px, -26px)');
});

test('losing focus clears movement and recenters the joystick', () => {
  const { keyboard, joystick, knob, controls, key, thumb } = setup();
  key('keydown', 'ArrowUp');
  thumb(32, 0);
  keyboard.dispatchEvent(new Event('blur'));
  expect(controls.heading()).toBeNull();
  for (let frame = 0; frame < 4; frame++) controls.advance();
  expect(knob.style.transform).toBe('');
  expect(joystick.classList.contains('active')).toBe(false);
});

test.each([
  ['z', ' ', 'a'],
  ['x', 'Enter', 'b'],
] as const)('overlapping %s and %s keep %s pressed until both release', (first, second, button) => {
  const { buttons, key } = setup();
  key('keydown', first);
  key('keydown', second);
  key('keyup', first);
  expect(buttons[button].classList.contains('pressed')).toBe(true);
  key('keyup', second);
  expect(buttons[button].classList.contains('pressed')).toBe(false);
});

test('button touch and keyboard presses have independent ownership', () => {
  const { panel, buttons, key, pointer } = setup();
  key('keydown', 'Z');
  pointer('pointerdown', 300, 60, 1, panel);
  pointer('pointerdown', 300, 60, 2, panel);
  key('keyup', 'z');
  pointer('pointerup', 0, 0, 1, panel);
  expect(buttons.a.classList.contains('pressed')).toBe(true);
  pointer('lostpointercapture', 0, 0, 2, panel);
  expect(buttons.a.classList.contains('pressed')).toBe(false);
});

test('a held joystick inside the dead zone does not fall back to keyboard movement', () => {
  const { controls, key, thumb, slide, lift } = setup();
  key('keydown', 'ArrowUp');
  thumb(7, 0);
  expect(controls.heading()).toBeNull();
  slide(10, 0);
  expect(controls.heading()).toEqual(toward(Direction.Right));
  lift();
  expect(controls.heading()).toEqual(toward(Direction.Up));
});

test('the hero starts walking at thirty percent of the reach and stops only below twenty five', () => {
  const { controls, thumb, slide } = setup();
  thumb(26 * 0.29, 0);
  expect(controls.heading()).toBeNull();
  slide(26 * 0.31, 0);
  expect(controls.heading()).not.toBeNull();
  slide(26 * 0.26, 0);
  expect(controls.heading()).not.toBeNull();
  slide(26 * 0.24, 0);
  expect(controls.heading()).toBeNull();
  slide(26 * 0.29, 0);
  expect(controls.heading()).toBeNull();
});

test.each([0, 17, 44, 90, 133, -29, -151])(
  'a thumb at %s degrees steers the hero along that exact angle',
  (degrees) => {
    const { controls, thumb } = setup();
    const angle = (degrees * Math.PI) / 180;
    thumb(20 * Math.cos(angle), 20 * Math.sin(angle));
    const heading = controls.heading()!;
    expect(heading.x).toBeCloseTo(Math.cos(angle));
    expect(heading.y).toBeCloseTo(Math.sin(angle));
  },
);

test('a resized ring rebuilds the joystick with the new reach and keeps the knob on whole panel pixels', () => {
  const { joystick, knob, key, resize } = setup();
  const pixel = 58.333333333333336 / 28;
  joystick.bounds = { left: 0, top: 0, width: 125, height: 125 };
  knob.bounds = { ...knob.bounds, width: 58.333333333333336 };
  resize();
  const reach = (125 - 12 - 58.333333333333336) / 2;
  expect(thumbs.at(-1)!.size).toBeCloseTo(2 * reach);
  expect(thumbs.at(-2)!.destroyed).toBe(true);
  key('keydown', 'ArrowRight');
  expect(knob.style.transform).toBe(`translate(${Math.trunc(reach / pixel) * pixel}px, 0px)`);
});

test.each([
  [300, 60, 'a'],
  [236, 124, 'b'],
  [190, 160, 'b'],
  [355, 10, 'a'],
  [268, 92, 'a'],
] as const)('a touch at %s, %s in the right half presses the nearest button, %s', (clientX, clientY, button) => {
  const { panel, buttons, pointer } = setup();
  pointer('pointerdown', clientX, clientY, 1, panel);
  expect(buttons[button].classList.contains('pressed')).toBe(true);
  expect(buttons[button === 'a' ? 'b' : 'a'].classList.contains('pressed')).toBe(false);
  pointer('pointerup', clientX, clientY, 1, panel);
  expect(buttons[button].classList.contains('pressed')).toBe(false);
});

test('a touch in the left half of the panel presses no button', () => {
  const { panel, buttons, pointer } = setup();
  pointer('pointerdown', 179, 60, 1, panel);
  expect(buttons.a.classList.contains('pressed')).toBe(false);
  expect(buttons.b.classList.contains('pressed')).toBe(false);
});

test('losing focus releases buttons held by touch', () => {
  const { keyboard, panel, buttons, pointer } = setup();
  pointer('pointerdown', 300, 60, 1, panel);
  keyboard.dispatchEvent(new Event('blur'));
  expect(buttons.a.classList.contains('pressed')).toBe(false);
});

test('holding a finger on the panel opens no context menu', () => {
  const { panel } = setup();
  const event = new Event('contextmenu', { cancelable: true });
  panel.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
});

test.each([
  [['ArrowUp'], 'up'],
  [['ArrowDown', 'ArrowLeft'], 'down-left'],
])('holding %s marks the joystick with %s so its arrows light up', (arrows, direction) => {
  const { joystick, key } = setup();
  for (const arrow of arrows) key('keydown', arrow);
  expect(joystick.dataset.direction).toBe(direction);
});

test.each([
  [0, -20, 'up'],
  [20, -20, 'up-right'],
  [20, -5, 'right'],
])('a thumb at %s, %s lights the %s arrows and clears them on release', (x, y, lit) => {
  const { joystick, thumb, lift } = setup();
  thumb(x, y);
  expect(joystick.dataset.direction).toBe(lit);
  lift();
  expect(joystick.dataset.direction).toBe('');
});

test('a released knob glides home over four frames and overshoots by one panel pixel', () => {
  const { knob, controls, key } = setup();
  key('keydown', 'ArrowUp');
  key('keyup', 'ArrowUp');
  expect(knob.style.transform).toBe('translate(0px, -26px)');
  const frames = Array.from({ length: 5 }, () => {
    controls.advance();
    return knob.style.transform;
  });
  expect(frames).toEqual(['translate(0px, -12px)', 'translate(0px, -2px)', 'translate(0px, 2px)', '', '']);
});

test('pressing again during the return takes the knob straight to the new direction', () => {
  const { knob, controls, key } = setup();
  key('keydown', 'ArrowUp');
  key('keyup', 'ArrowUp');
  controls.advance();
  key('keydown', 'ArrowRight');
  expect(knob.style.transform).toBe('translate(26px, 0px)');
  controls.advance();
  expect(knob.style.transform).toBe('translate(26px, 0px)');
});

test('a released touch glides the knob home as well', () => {
  const { knob, controls, thumb, lift } = setup();
  thumb(40, 0);
  lift();
  controls.advance();
  expect(knob.style.transform).toBe('translate(12px, 0px)');
  for (let frame = 0; frame < 3; frame++) controls.advance();
  expect(knob.style.transform).toBe('');
});
