import { vi } from 'vitest';

// Only the selector forms the presentation layer uses are parsed, so an unexpected form fails loudly instead of matching wrongly.
const selectorPattern = /^([\w-]+)?(?:\.([\w-]+))?(?:\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\])?$/;

export class FakeElement extends EventTarget {
  readonly tagName: string;
  readonly children: FakeElement[] = [];
  ownerDocument: FakeDocument | null = null;
  private readonly attributes: Map<string, string>;

  constructor(
    tag: string,
    attributes: Readonly<Record<string, string>> = {},
    public parentElement: FakeElement | null = null,
  ) {
    super();
    this.tagName = tag.toUpperCase();
    this.attributes = new Map(Object.entries(attributes));
  }

  get className(): string {
    return this.getAttribute('class') ?? '';
  }

  set className(value: string) {
    this.setAttribute('class', value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  // The class list reads and writes the class attribute, so selectors and class checks always agree.
  get classList() {
    const names = (): string[] => this.className.split(' ').filter(Boolean);
    const add = (...tokens: string[]): void => void (this.className = [...new Set([...names(), ...tokens])].join(' '));
    const remove = (...tokens: string[]): void =>
      void (this.className = names()
        .filter((name) => !tokens.includes(name))
        .join(' '));
    return {
      add,
      remove,
      contains: (token: string): boolean => names().includes(token),
      toggle: (token: string, force = !names().includes(token)): boolean => {
        if (force) add(token);
        else remove(token);
        return force;
      },
    };
  }

  matches(selectors: string): boolean {
    return selectors.split(',').some((selector) => {
      const match = selectorPattern.exec(selector.trim());
      if (!match) throw new Error(`Unsupported test selector: ${selector}`);
      const [, tag, className, attribute, value] = match;
      if (tag && this.tagName !== tag.toUpperCase()) return false;
      if (className && !this.className.split(' ').includes(className)) return false;
      if (attribute && this.getAttribute(attribute) === null) return false;
      if (value !== undefined && this.getAttribute(attribute!) !== value) return false;
      return true;
    });
  }

  closest(selectors: string): FakeElement | null {
    return this.matches(selectors) ? this : (this.parentElement?.closest(selectors) ?? null);
  }

  append(...children: FakeElement[]): void {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }

  replaceChildren(...children: FakeElement[]): void {
    this.children.length = 0;
    this.append(...children);
  }

  querySelectorAll(selectors: string): FakeElement[] {
    return this.children.flatMap((child) => [
      ...(child.matches(selectors) ? [child] : []),
      ...child.querySelectorAll(selectors),
    ]);
  }

  querySelector(selectors: string): FakeElement | null {
    return this.querySelectorAll(selectors)[0] ?? null;
  }
}

export class FakeStyle {
  transform = '';
  paddingLeft = '';
  width = '';
  height = '';
  private readonly properties = new Map<string, string>();

  setProperty(name: string, value: string): void {
    this.properties.set(name, value);
  }

  getPropertyValue(name: string): string {
    return this.properties.get(name) ?? '';
  }
}

export class FakeHTMLElement extends FakeElement {
  hidden = false;
  disabled = false;
  type = '';
  bounds = { left: 0, top: 0, width: 0, height: 0 };
  readonly style = new FakeStyle();
  readonly dataset: Record<string, string | undefined> = {};
  readonly capturedPointers = new Set<number>();

  setPointerCapture(pointerId: number): void {
    this.capturedPointers.add(pointerId);
  }

  getBoundingClientRect(): { left: number; top: number; width: number; height: number } {
    return { ...this.bounds };
  }

  get isContentEditable(): boolean {
    const value = this.getAttribute('contenteditable')?.toLowerCase();
    if (value === '' || value === 'true' || value === 'plaintext-only') return true;
    if (value === 'false') return false;
    return this.parentElement instanceof FakeHTMLElement && this.parentElement.isContentEditable;
  }

  focus(): void {
    if (this.ownerDocument) this.ownerDocument.activeElement = this;
  }

  // A browser ignores click() on a disabled control, so the fake does too.
  click(): void {
    if (!this.disabled) this.dispatchEvent(new Event('click'));
  }
}

export class FakeCanvasElement extends FakeHTMLElement {
  width = 300;
  height = 150;

  readonly context = {
    imageSmoothingEnabled: true,
    shown: null as FakeImageData | null,
    putImageData(image: FakeImageData): void {
      this.shown = image;
    },
  };

  getContext(): FakeCanvasElement['context'] {
    return this.context;
  }

  toDataURL(): string {
    return 'data:,';
  }
}

export class FakeImageData {
  readonly data: Uint8ClampedArray;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}

export class FakeDocument extends EventTarget {
  readonly body: FakeHTMLElement;
  activeElement: FakeElement | null = null;

  constructor() {
    super();
    this.body = this.createElement('body');
  }

  createElement(tag: string): FakeHTMLElement {
    const created = tag === 'canvas' ? new FakeCanvasElement(tag) : new FakeHTMLElement(tag);
    created.ownerDocument = this;
    return created;
  }

  querySelector(selectors: string): FakeElement | null {
    return this.body.querySelector(selectors);
  }

  querySelectorAll(selectors: string): FakeElement[] {
    return this.body.querySelectorAll(selectors);
  }

  // Lets the code under test use instanceof checks and ImageData as it would in a browser. Undo with vi.unstubAllGlobals.
  static stubGlobals(): void {
    vi.stubGlobal('Element', FakeElement);
    vi.stubGlobal('HTMLElement', FakeHTMLElement);
    vi.stubGlobal('ImageData', FakeImageData);
  }
}

// The display reports its pixel ratio and layout changes through callbacks, so tests trigger them explicitly instead of waiting for a browser.
export function stubDisplay(devicePixelRatio: number) {
  const display = { devicePixelRatio, ratioQueries: [] as EventTarget[] };
  const observers: (() => void)[] = [];
  const window = Object.defineProperties(new EventTarget(), {
    devicePixelRatio: { get: () => display.devicePixelRatio },
    matchMedia: {
      value: (): EventTarget => {
        const query = new EventTarget();
        display.ratioQueries.push(query);
        return query;
      },
    },
  });
  vi.stubGlobal('window', window);
  // Tests set layout styles inline, so the computed style is the inline style.
  vi.stubGlobal('getComputedStyle', (element: FakeHTMLElement) => element.style);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        observers.push(callback);
      }
      observe(): void {}
    },
  );
  return {
    window,
    relayout: (): void => observers.forEach((observer) => observer()),
    changeRatio: (ratio: number): void => {
      display.devicePixelRatio = ratio;
      display.ratioQueries.at(-1)!.dispatchEvent(new Event('change'));
    },
  };
}
