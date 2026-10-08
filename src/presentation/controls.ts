import { create } from 'nipplejs';
import { Direction, Heading } from '../domain/level/position';
import { controlSize } from './art/panel';
import { heldOffset, litArrows, returnOffset, snapTowardCenter, thumbHeading } from './joystick';

const arrowKeys: Readonly<Record<string, Direction>> = {
  ArrowUp: Direction.Up,
  ArrowDown: Direction.Down,
  ArrowLeft: Direction.Left,
  ArrowRight: Direction.Right,
};
const buttonKeys: Readonly<Record<string, 'a' | 'b'>> = { z: 'a', ' ': 'a', x: 'b', Enter: 'b' };

function isInteractiveKeyboardTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    ((target instanceof HTMLElement && target.isContentEditable) ||
      target.closest(
        'button, a, input, select, textarea, summary, audio[controls], video[controls], [tabindex], [role="button"], [role="link"], [role="textbox"], [role="checkbox"], [role="radio"], [role="switch"], [role="slider"], [role="spinbutton"], [role="combobox"], [role="listbox"], [role="option"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="tab"], [role="treeitem"], [role="searchbox"]',
      ) !== null)
  );
}

export class Controls {
  private readonly heldArrows: Direction[] = [];
  private joystickHeading: Heading | null = null;
  private joystickHeld = false;
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
      const lit = this.joystickHeld
        ? this.joystickHeading && litArrows(this.joystickHeading)
        : this.keyboardDirection();
      joystick.dataset.direction = lit?.name ?? '';
    };
    const updateButton = (button: 'a' | 'b'): void => {
      buttons[button].classList.toggle('pressed', heldKeys[button].size + heldPointers[button].size > 0);
    };
    const updateKeyboardJoystick = (): void => {
      if (this.joystickHeld) return;
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
      if (isInteractiveKeyboardTarget(event.target)) return;
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
      if (isInteractiveKeyboardTarget(event.target)) return;
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
      this.joystickHeld = false;
      this.joystickHeading = null;
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

    let thumb: ReturnType<typeof create> | null = null;
    // The thumb's reach and center follow the ring, so the joystick is rebuilt whenever the ring resizes or moves.
    const listen = (): void => {
      thumb?.destroy();
      thumb = create({
        zone: joystick,
        mode: 'static',
        position: { left: '50%', top: '50%' },
        size: 2 * reach(),
        dataOnly: true,
      });
      thumb.on('start', () => {
        this.joystickHeld = true;
        joystick.classList.add('active');
      });
      thumb.on('move', ({ data }: { data: { vector: { x: number; y: number }; force: number } }) => {
        if (!this.joystickHeld) return;
        const { x, y } = data.vector;
        const radius = reach();
        place(x * radius, -y * radius);
        this.joystickHeading = thumbHeading(x, -y, data.force, this.joystickHeading !== null);
        showDirection();
      });
      thumb.on('end', () => {
        this.joystickHeld = false;
        this.joystickHeading = null;
        updateKeyboardJoystick();
      });
    };
    listen();
    const rebuild = (): void => {
      this.joystickHeld = false;
      this.joystickHeading = null;
      listen();
      updateKeyboardJoystick();
    };
    new ResizeObserver(rebuild).observe(joystick);
    // nipplejs never recenters a dataOnly joystick, and entering fullscreen can move the ring without resizing it.
    window.addEventListener('resize', rebuild);
  }

  // A held button acts once, so reading a press clears it until the button goes down again.
  takePress(button: 'a' | 'b'): boolean {
    return this.freshPresses.delete(button);
  }

  heading(): Heading | null {
    if (this.joystickHeld) return this.joystickHeading;
    const direction = this.keyboardDirection();
    return direction && Heading.of(direction);
  }

  private keyboardDirection(): Direction | null {
    const horizontal = this.heldArrows.findLast((direction) => direction.columnStep !== 0) ?? null;
    const vertical = this.heldArrows.findLast((direction) => direction.rowStep !== 0) ?? null;
    return Direction.combine(horizontal, vertical);
  }
}
