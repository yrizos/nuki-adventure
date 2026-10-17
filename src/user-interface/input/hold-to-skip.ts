// Only presses that start while it listens count, so a key or finger still down from before never skips by itself.
export class HoldToSkip {
  private listening = false;
  private readonly keys = new Set<string>();
  private readonly pointers = new Set<number>();

  constructor(keyboard: EventTarget, surface: HTMLElement) {
    keyboard.addEventListener('keydown', (event) => {
      const { key, code, repeat, metaKey } = event as KeyboardEvent;
      // Escape leaves the scene on its own, and a key pressed with Meta is a browser shortcut rather than a hold.
      if (!this.listening || repeat || metaKey || key === 'Escape' || key === 'Meta') return;
      this.keys.add(code || key);
    });
    keyboard.addEventListener('keyup', (event) => {
      const { key, code } = event as KeyboardEvent;
      // macOS sends no keyup for keys released while Meta is down, so letting go of Meta lets go of every key.
      if (key === 'Meta') this.keys.clear();
      else this.keys.delete(code || key);
    });
    keyboard.addEventListener('blur', () => this.release());
    surface.addEventListener('pointerdown', (event) => {
      if (!this.listening) return;
      const { pointerId } = event;
      // Capturing the pointer delivers its release even when the finger or mouse leaves the page first.
      surface.setPointerCapture(pointerId);
      this.pointers.add(pointerId);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const)
      surface.addEventListener(type, (event) => this.pointers.delete(event.pointerId));
  }

  get isHeld(): boolean {
    return this.keys.size + this.pointers.size > 0;
  }

  listen(): void {
    this.release();
    this.listening = true;
  }

  stop(): void {
    this.release();
    this.listening = false;
  }

  private release(): void {
    this.keys.clear();
    this.pointers.clear();
  }
}
