import { Direction } from '../domain/level/position';
import { controlSize } from './art/panel';
import { heldOffset, returnOffset, snapTowardCenter, steer } from './joystick';

const arrowKeys: Readonly<Record<string, Direction>> = {
  ArrowUp: Direction.Up,
  ArrowDown: Direction.Down,
  ArrowLeft: Direction.Left,
  ArrowRight: Direction.Right,
};
const buttonKeys: Readonly<Record<string, 'a' | 'b'>> = { z: 'a', ' ': 'a', x: 'b', Enter: 'b' };

export class Controls {
  private readonly heldArrows: Direction[] = [];
  private joystickDirection: Direction | null = null;
  private joystickPointer: number | null = null;
  private readonly freshPresses = new Set<'a' | 'b'>();
  readonly advance: () => void;

  constructor(
    panel: HTMLElement,
    joystick: HTMLElement,
    knob: HTMLElement,
    buttons: Readonly<Record<'a' | 'b', HTMLElement>>,
  ) {
    const heldKeys = { a: new Set<string>(), b: new Set<string>() };
    const heldPointers = { a: new Set<number>(), b: new Set<number>() };
    const pointerButtons = new Map<number, 'a' | 'b'>();
    let pointerPosition: { clientX: number; clientY: number } | null = null;
    const reach = (): number => {
      const rim = Number.parseFloat(getComputedStyle(joystick).paddingLeft) || 0;
      return Math.max(0, (joystick.getBoundingClientRect().width - 2 * rim - knob.getBoundingClientRect().width) / 2);
    };
    let offset = { x: 0, y: 0 };
    let returning: { readonly x: number; readonly y: number; frame: number } | null = null;
    const pixelSize = (): number => knob.getBoundingClientRect().width / controlSize;
    const show = (x: number, y: number): void => {
      const pixel = pixelSize();
      knob.style.transform = `translate(${snapTowardCenter(x, pixel)}px, ${snapTowardCenter(y, pixel)}px)`;
    };
    const place = (x: number, y: number): void => {
      returning = null;
      offset = { x, y };
      show(x, y);
    };
    const recenter = (): void => {
      if (offset.x !== 0 || offset.y !== 0) returning = { ...offset, frame: 0 };
      offset = { x: 0, y: 0 };
    };
    this.advance = (): void => {
      if (!returning) return;
      const position = returnOffset(returning, returning.frame, pixelSize());
      if (!position) {
        knob.style.transform = '';
        returning = null;
        return;
      }
      show(position.x, position.y);
      returning.frame++;
    };
    const showDirection = (): void => {
      joystick.dataset.direction = this.direction()?.name ?? '';
    };
    const updateButton = (button: 'a' | 'b'): void => {
      buttons[button].classList.toggle('pressed', heldKeys[button].size + heldPointers[button].size > 0);
    };
    const updateKeyboardJoystick = (): void => {
      if (this.joystickPointer !== null) return;
      const direction = this.keyboardDirection();
      joystick.classList.toggle('active', direction !== null);
      showDirection();
      if (!direction) {
        recenter();
        return;
      }
      const offset = heldOffset(direction, reach());
      place(offset.x, offset.y);
    };
    window.addEventListener('keydown', (event) => {
      const arrow = arrowKeys[event.key];
      const button = buttonKeys[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (arrow) {
        if (!this.heldArrows.includes(arrow)) this.heldArrows.push(arrow);
        updateKeyboardJoystick();
      } else if (button) {
        if (!event.repeat) this.freshPresses.add(button);
        heldKeys[button].add(event.key.toLowerCase());
        updateButton(button);
      } else {
        return;
      }
      event.preventDefault();
    });
    window.addEventListener('keyup', (event) => {
      const arrow = arrowKeys[event.key];
      const button = buttonKeys[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (arrow) {
        const index = this.heldArrows.indexOf(arrow);
        if (index !== -1) this.heldArrows.splice(index, 1);
        updateKeyboardJoystick();
      }
      if (button) {
        heldKeys[button].delete(event.key.toLowerCase());
        updateButton(button);
      }
    });
    window.addEventListener('blur', () => {
      this.heldArrows.length = 0;
      this.joystickPointer = null;
      pointerPosition = null;
      this.joystickDirection = null;
      updateKeyboardJoystick();
      for (const button of ['a', 'b'] as const) {
        heldKeys[button].clear();
        heldPointers[button].clear();
        updateButton(button);
      }
      pointerButtons.clear();
    });

    const nearestButton = (event: { clientX: number; clientY: number }): 'a' | 'b' => {
      const distance = (name: 'a' | 'b'): number => {
        const bounds = buttons[name].getBoundingClientRect();
        return Math.hypot(
          event.clientX - (bounds.left + bounds.width / 2),
          event.clientY - (bounds.top + bounds.height / 2),
        );
      };
      return distance('a') <= distance('b') ? 'a' : 'b';
    };
    // Children often miss small targets, so the whole right half of the panel presses the nearest button.
    panel.addEventListener('pointerdown', (event) => {
      const bounds = panel.getBoundingClientRect();
      if (event.clientX < bounds.left + bounds.width / 2) return;
      const name = nearestButton(event);
      panel.setPointerCapture(event.pointerId);
      pointerButtons.set(event.pointerId, name);
      this.freshPresses.add(name);
      heldPointers[name].add(event.pointerId);
      updateButton(name);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
      panel.addEventListener(type, (event) => {
        const name = pointerButtons.get(event.pointerId);
        if (!name) return;
        pointerButtons.delete(event.pointerId);
        heldPointers[name].delete(event.pointerId);
        updateButton(name);
      });
    }
    panel.addEventListener('contextmenu', (event) => event.preventDefault());

    const move = (event: { clientX: number; clientY: number }): void => {
      const ring = joystick.getBoundingClientRect();
      const steered = steer(
        event.clientX - (ring.left + ring.width / 2),
        event.clientY - (ring.top + ring.height / 2),
        reach(),
      );
      place(steered.offset.x, steered.offset.y);
      this.joystickDirection = steered.direction;
      showDirection();
    };
    const release = (event: PointerEvent): void => {
      if (event.pointerId !== this.joystickPointer) return;
      this.joystickPointer = null;
      pointerPosition = null;
      this.joystickDirection = null;
      updateKeyboardJoystick();
    };
    joystick.addEventListener('pointerdown', (event) => {
      if (this.joystickPointer !== null) return;
      this.joystickPointer = event.pointerId;
      pointerPosition = event;
      joystick.setPointerCapture(event.pointerId);
      joystick.classList.add('active');
      move(event);
    });
    joystick.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.joystickPointer) return;
      pointerPosition = event;
      move(event);
    });
    joystick.addEventListener('pointerup', release);
    joystick.addEventListener('pointercancel', release);
    joystick.addEventListener('lostpointercapture', release);
    new ResizeObserver(() => {
      if (pointerPosition) move(pointerPosition);
      else updateKeyboardJoystick();
    }).observe(joystick);
  }

  // A held button acts once, so reading a press clears it until the button goes down again.
  takePress(button: 'a' | 'b'): boolean {
    return this.freshPresses.delete(button);
  }

  direction(): Direction | null {
    return this.joystickPointer !== null ? this.joystickDirection : this.keyboardDirection();
  }

  private keyboardDirection(): Direction | null {
    const horizontal = this.heldArrows.findLast((direction) => direction.columnStep !== 0) ?? null;
    const vertical = this.heldArrows.findLast((direction) => direction.rowStep !== 0) ?? null;
    return Direction.combine(horizontal, vertical);
  }
}
