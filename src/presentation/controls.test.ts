import { afterEach, expect, test, vi } from 'vitest';
import { Direction } from '../domain/level/position';
import { Controls } from './controls';

function controlElement(width = 120): HTMLElement {
  const classes = new Set<string>();
  return Object.assign(new EventTarget(), {
    classList: {
      add: (name: string) => classes.add(name),
      remove: (name: string) => classes.delete(name),
      contains: (name: string) => classes.has(name),
      toggle: (name: string, force: boolean) => (force ? classes.add(name) : classes.delete(name)),
    },
    style: { transform: '' },
    offsetWidth: 56,
    getBoundingClientRect: () => ({ left: 0, top: 0, width, height: width }),
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
  const joystick = controlElement();
  const knob = controlElement(56);
  const buttons = { a: controlElement(56), b: controlElement(56) };
  const controls = new Controls(joystick, knob, buttons);
  const key = (type: 'keydown' | 'keyup', name: string): void => {
    keyboard.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { key: name }));
  };
  const pointer = (type: string, clientX = 60, clientY = 60, pointerId = 1, target = joystick): void => {
    target.dispatchEvent(Object.assign(new Event(type), { pointerId, clientX, clientY }));
  };
  return { keyboard, joystick, knob, buttons, controls, key, pointer, resize: () => resize() };
}

afterEach(() => vi.unstubAllGlobals());

test.each([
  ['ArrowUp', Direction.Up, 'translate(0px, -32px)'],
  ['ArrowDown', Direction.Down, 'translate(0px, 32px)'],
  ['ArrowLeft', Direction.Left, 'translate(-32px, 0px)'],
  ['ArrowRight', Direction.Right, 'translate(32px, 0px)'],
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
  const travel = 32 / Math.SQRT2;
  expect(knob.style.transform).toBe(`translate(${-travel}px, ${-travel}px)`);
  key('keyup', 'ArrowRight');
  expect(controls.direction()).toBe(Direction.UpLeft);
  key('keyup', 'ArrowUp');
  expect(controls.direction()).toBe(Direction.Left);
  expect(knob.style.transform).toBe('translate(-32px, 0px)');
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
  expect(knob.style.transform).toBe('translate(32px, 0px)');
  pointer(release);
  expect(controls.direction()).toBe(Direction.Up);
  expect(knob.style.transform).toBe('translate(0px, -32px)');
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
  const { buttons, key, pointer } = setup();
  key('keydown', 'Z');
  pointer('pointerdown', 0, 0, 1, buttons.a);
  pointer('pointerdown', 0, 0, 2, buttons.a);
  key('keyup', 'z');
  pointer('pointerup', 0, 0, 1, buttons.a);
  expect(buttons.a.classList.contains('pressed')).toBe(true);
  pointer('lostpointercapture', 0, 0, 2, buttons.a);
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
  pointer('pointerdown', 69, 60);
  expect(controls.direction()).toBeNull();
  pointer('pointermove', 70, 60);
  expect(controls.direction()).toBe(Direction.Right);
  pointer('pointerup');
  expect(controls.direction()).toBe(Direction.Up);
});

test('fractional geometry and resizing keep the knob inside the ring', () => {
  const { joystick, knob, key, pointer, resize } = setup();
  joystick.getBoundingClientRect = () => ({ left: 0, top: 0, width: 125, height: 125 } as DOMRect);
  knob.getBoundingClientRect = () => ({ width: 58.333333333333336 } as DOMRect);
  key('keydown', 'ArrowRight');
  const reach = (125 - 58.333333333333336) / 2;
  expect(knob.style.transform).toBe(`translate(${reach}px, 0px)`);
  pointer('pointerdown', 200, 62.5);
  expect(knob.style.transform).toBe(`translate(${reach}px, 0px)`);
  joystick.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 } as DOMRect);
  resize();
  const coordinates = knob.style.transform.match(/-?[\d.]+/g)!.map(Number);
  expect(Math.hypot(...coordinates)).toBeCloseTo((100 - 58.333333333333336) / 2);
});
