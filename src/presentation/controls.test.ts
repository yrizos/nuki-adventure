import { afterEach, expect, test, vi } from 'vitest';
import { Direction } from '../domain/level/position';
import { Controls } from './controls';

function controlElement(width = 120, left = 0, top = 0, height = width): HTMLElement {
  const classes = new Set<string>();
  return Object.assign(new EventTarget(), {
    classList: {
      add: (name: string) => classes.add(name),
      remove: (name: string) => classes.delete(name),
      contains: (name: string) => classes.has(name),
      toggle: (name: string, force: boolean) => (force ? classes.add(name) : classes.delete(name)),
    },
    style: { transform: '' },
    dataset: {},
    offsetWidth: 56,
    getBoundingClientRect: () => ({ left, top, width, height }),
    setPointerCapture: vi.fn(),
    hasPointerCapture: () => true,
  }) as unknown as HTMLElement;
}

function setup() {
  const keyboard = new EventTarget();
  vi.stubGlobal('window', keyboard);
  let resize = (): void => {};
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resize = callback; }
    observe() {}
  });
  vi.stubGlobal('getComputedStyle', () => ({ paddingLeft: '6px' }));
  const panel = controlElement(360, 0, 0, 184);
  const joystick = controlElement();
  const knob = controlElement(56);
  const buttons = { a: controlElement(56, 272, 32), b: controlElement(56, 208, 96) };
  const controls = new Controls(panel, joystick, knob, buttons);
  const key = (type: 'keydown' | 'keyup', name: string): void => {
    keyboard.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { key: name }));
  };
  const pointer = (type: string, clientX = 60, clientY = 60, pointerId = 1, target = joystick): void => {
    target.dispatchEvent(Object.assign(new Event(type), { pointerId, clientX, clientY }));
  };
  return { keyboard, panel, joystick, knob, buttons, controls, key, pointer, resize: () => resize() };
}

afterEach(() => vi.unstubAllGlobals());

test.each([
  ['ArrowUp', Direction.Up, 'translate(0px, -26px)'],
  ['ArrowDown', Direction.Down, 'translate(0px, 26px)'],
  ['ArrowLeft', Direction.Left, 'translate(-26px, 0px)'],
  ['ArrowRight', Direction.Right, 'translate(26px, 0px)'],
])('%s moves the knob with the hero and recenters on release', (arrow, direction, transform) => {
  const { joystick, knob, controls, key } = setup();
  key('keydown', arrow);
  expect(controls.direction()).toBe(direction);
  expect(knob.style.transform).toBe(transform);
  expect(joystick.classList.contains('active')).toBe(true);
  key('keyup', arrow);
  expect(controls.direction()).toBeNull();
  expect(knob.style.transform).toBe('');
  expect(joystick.classList.contains('active')).toBe(false);
});

test('perpendicular held arrows combine and releasing one restores the remaining arrow', () => {
  const { knob, controls, key } = setup();
  key('keydown', 'ArrowLeft');
  key('keydown', 'ArrowUp');
  key('keydown', 'ArrowLeft');
  expect(controls.direction()).toBe(Direction.UpLeft);
  const travel = 18;
  expect(knob.style.transform).toBe(`translate(${-travel}px, ${-travel}px)`);
  key('keyup', 'ArrowRight');
  expect(controls.direction()).toBe(Direction.UpLeft);
  key('keyup', 'ArrowUp');
  expect(controls.direction()).toBe(Direction.Left);
  expect(knob.style.transform).toBe('translate(-26px, 0px)');
});

test.each([
  ['ArrowLeft', 'ArrowRight', Direction.Left, Direction.Right],
  ['ArrowUp', 'ArrowDown', Direction.Up, Direction.Down],
])('the latest opposite arrow wins over %s until %s is released', (previous, latest, previousDirection, latestDirection) => {
  const { controls, key } = setup();
  key('keydown', previous);
  key('keydown', latest);
  key('keydown', previous);
  expect(controls.direction()).toBe(latestDirection);
  key('keyup', latest);
  expect(controls.direction()).toBe(previousDirection);
  key('keyup', previous);
  expect(controls.direction()).toBeNull();
});

test.each(['pointerup', 'pointercancel'])('touch owns the knob until %s restores keyboard input', (release) => {
  const { knob, controls, key, pointer } = setup();
  pointer('pointerdown', 92, 60);
  key('keydown', 'ArrowUp');
  expect(controls.direction()).toBe(Direction.Right);
  expect(knob.style.transform).toBe('translate(26px, 0px)');
  pointer(release);
  expect(controls.direction()).toBe(Direction.Up);
  expect(knob.style.transform).toBe('translate(0px, -26px)');
});

test('losing focus clears movement and recenters the joystick', () => {
  const { keyboard, joystick, knob, controls, key, pointer } = setup();
  key('keydown', 'ArrowUp');
  pointer('pointerdown', 92, 60);
  keyboard.dispatchEvent(new Event('blur'));
  expect(controls.direction()).toBeNull();
  expect(knob.style.transform).toBe('');
  expect(joystick.classList.contains('active')).toBe(false);
});

test.each([['z', ' ', 'a'], ['x', 'Enter', 'b']] as const)('overlapping %s and %s keep %s pressed until both release', (first, second, button) => {
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

test('only the owning pointer can move or release the joystick', () => {
  const { controls, pointer } = setup();
  pointer('pointerdown', 92, 60, 1);
  pointer('pointerdown', 60, 28, 2);
  pointer('pointermove', 60, 28, 2);
  pointer('pointercancel', 60, 28, 2);
  expect(controls.direction()).toBe(Direction.Right);
  pointer('lostpointercapture', 92, 60, 1);
  expect(controls.direction()).toBeNull();
});

test('a held joystick inside the dead zone does not fall back to keyboard movement', () => {
  const { controls, key, pointer } = setup();
  key('keydown', 'ArrowUp');
  pointer('pointerdown', 67, 60);
  expect(controls.direction()).toBeNull();
  pointer('pointermove', 70, 60);
  expect(controls.direction()).toBe(Direction.Right);
  pointer('pointerup');
  expect(controls.direction()).toBe(Direction.Up);
});

test('fractional geometry and resizing keep the knob inside the ring on whole panel pixels', () => {
  const { joystick, knob, key, pointer, resize } = setup();
  const pixel = 58.333333333333336 / 28;
  joystick.getBoundingClientRect = () => ({ left: 0, top: 0, width: 125, height: 125 } as DOMRect);
  knob.getBoundingClientRect = () => ({ width: 58.333333333333336 } as DOMRect);
  key('keydown', 'ArrowRight');
  const reach = (125 - 12 - 58.333333333333336) / 2;
  const snapped = Math.trunc(reach / pixel) * pixel;
  expect(knob.style.transform).toBe(`translate(${snapped}px, 0px)`);
  pointer('pointerdown', 200, 62.5);
  expect(knob.style.transform).toBe(`translate(${snapped}px, 0px)`);
  joystick.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 } as DOMRect);
  resize();
  const coordinates = knob.style.transform.match(/-?[\d.]+/g)!.map(Number);
  expect(Math.hypot(...coordinates)).toBeLessThanOrEqual((100 - 12 - 58.333333333333336) / 2);
  for (const coordinate of coordinates) expect(coordinate / pixel).toBeCloseTo(Math.round(coordinate / pixel));
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
  [0, Direction.Right],
  [29, Direction.Right],
  [31, Direction.DownRight],
  [59, Direction.DownRight],
  [61, Direction.Down],
  [90, Direction.Down],
  [-29, Direction.Right],
  [-31, Direction.UpRight],
  [151, Direction.Left],
  [-119, Direction.Up],
  [-121, Direction.UpLeft],
  [-149, Direction.UpLeft],
  [-151, Direction.Left],
])('a thumb at %s degrees moves %s, with 60 degree straight sectors', (degrees, direction) => {
  const { controls, pointer } = setup();
  const angle = (degrees * Math.PI) / 180;
  pointer('pointerdown', 60 + 25 * Math.cos(angle), 60 + 25 * Math.sin(angle));
  expect(controls.direction()).toBe(direction);
});

test.each([
  [['ArrowUp'], 'up'],
  [['ArrowDown', 'ArrowLeft'], 'down-left'],
])('holding %s marks the joystick with %s so its arrows light up', (arrows, direction) => {
  const { joystick, key } = setup();
  for (const arrow of arrows) key('keydown', arrow);
  expect(joystick.dataset.direction).toBe(direction);
});

test('touch steering marks the joystick direction and clears it on release', () => {
  const { joystick, pointer } = setup();
  pointer('pointerdown', 60, 30);
  expect(joystick.dataset.direction).toBe('up');
  pointer('pointerup');
  expect(joystick.dataset.direction).toBe('');
});
