import { Direction } from '../domain/level/position';

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

  constructor(joystick: HTMLElement, knob: HTMLElement, buttons: Readonly<Record<'a' | 'b', HTMLElement>>) {
    const heldKeys = { a: new Set<string>(), b: new Set<string>() };
    const heldPointers = { a: new Set<number>(), b: new Set<number>() };
    let pointerPosition: { clientX: number; clientY: number } | null = null;
    const reach = (): number => Math.max(0, (joystick.getBoundingClientRect().width - knob.getBoundingClientRect().width) / 2);
    const updateButton = (button: 'a' | 'b'): void => {
      buttons[button].classList.toggle('pressed', heldKeys[button].size + heldPointers[button].size > 0);
    };
    const updateKeyboardJoystick = (): void => {
      if (this.joystickPointer !== null) return;
      const direction = this.keyboardDirection();
      joystick.classList.toggle('active', direction !== null);
      if (!direction) {
        knob.style.transform = '';
        return;
      }
      const travel = reach() / (direction.isDiagonal ? Math.SQRT2 : 1);
      const horizontal = direction.columnStep * travel;
      const vertical = direction.rowStep * travel;
      knob.style.transform = `translate(${horizontal}px, ${vertical}px)`;
    };
    window.addEventListener('keydown', (event) => {
      const arrow = arrowKeys[event.key];
      const button = buttonKeys[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (arrow) {
        if (!this.heldArrows.includes(arrow)) this.heldArrows.push(arrow);
        updateKeyboardJoystick();
      } else if (button) {
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
    });

    for (const name of ['a', 'b'] as const) {
      const button = buttons[name];
      button.addEventListener('pointerdown', (event) => {
        button.setPointerCapture(event.pointerId);
        heldPointers[name].add(event.pointerId);
        updateButton(name);
      });
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
        button.addEventListener(type, (event) => {
          heldPointers[name].delete(event.pointerId);
          updateButton(name);
        });
      }
    }

    const move = (event: { clientX: number; clientY: number }): void => {
      const ring = joystick.getBoundingClientRect();
      const travel = reach();
      let x = event.clientX - (ring.left + ring.width / 2);
      let y = event.clientY - (ring.top + ring.height / 2);
      const distance = Math.hypot(x, y);
      if (distance > travel) {
        x = (x / distance) * travel;
        y = (y / distance) * travel;
      }
      knob.style.transform = `translate(${x}px, ${y}px)`;
      // A dead zone keeps a resting thumb from walking the hero by accident.
      if (travel === 0 || distance < travel * 0.3) this.joystickDirection = null;
      else {
        const threshold = Math.tan(Math.PI / 8);
        const horizontal = Math.abs(x) > Math.abs(y) * threshold ? (x > 0 ? Direction.Right : Direction.Left) : null;
        const vertical = Math.abs(y) > Math.abs(x) * threshold ? (y > 0 ? Direction.Down : Direction.Up) : null;
        this.joystickDirection = Direction.combine(horizontal, vertical);
      }
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

  direction(): Direction | null {
    return this.joystickPointer !== null ? this.joystickDirection : this.keyboardDirection();
  }

  private keyboardDirection(): Direction | null {
    const horizontal = this.heldArrows.findLast((direction) => direction.columnStep !== 0) ?? null;
    const vertical = this.heldArrows.findLast((direction) => direction.rowStep !== 0) ?? null;
    return Direction.combine(horizontal, vertical);
  }
}
