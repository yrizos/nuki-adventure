import { vi } from 'vitest';
import { memoryStorage } from './memory-storage';

class StubAudioNode {
  readonly outputs: StubAudioNode[] = [];

  constructor(readonly context: StubAudioContext) {}

  connect<T extends StubAudioNode>(target: T): T {
    this.outputs.push(target);
    return target;
  }

  disconnect(): void {
    this.outputs.length = 0;
  }

  reachesSpeakers(): boolean {
    return this === this.context.destination || this.outputs.some((output) => output.reachesSpeakers());
  }
}

class StubAudioParam {
  constructor(public value: number) {}

  setValueAtTime(value: number): void {
    this.value = value;
  }

  exponentialRampToValueAtTime(): void {}

  linearRampToValueAtTime(value: number): void {
    this.value = value;
  }

  setTargetAtTime(value: number): void {
    this.value = value;
  }
}

class StubGainNode extends StubAudioNode {
  readonly gain: StubAudioParam;

  constructor(context: StubAudioContext, options: { gain?: number } = {}) {
    super(context);
    this.gain = new StubAudioParam(options.gain ?? 1);
  }

  override reachesSpeakers(): boolean {
    return this.gain.value > 0 && super.reachesSpeakers();
  }
}

class StubOscillatorNode extends StubAudioNode {
  stopped = false;

  constructor(
    context: StubAudioContext,
    readonly options: { frequency: number },
  ) {
    super(context);
  }

  // Time never advances in the stub, so audibility is captured when the note starts and a later gain change cannot rewrite what was already played.
  start(): void {
    this.context.started.push({ frequency: this.options.frequency, audible: this.reachesSpeakers() });
    this.context.oscillators.push(this);
  }

  // Notes are stopped as soon as they are scheduled, so only a continuous voice is left unstopped.
  stop(): void {
    this.stopped = true;
  }
}

export class StubAudioContext {
  readonly currentTime = 0;
  readonly destination = new StubAudioNode(this);
  readonly started: { readonly frequency: number; readonly audible: boolean }[] = [];
  readonly oscillators: StubOscillatorNode[] = [];

  resume(): Promise<void> {
    return Promise.resolve();
  }

  sounding(): number[] {
    return this.oscillators
      .filter((oscillator) => !oscillator.stopped && oscillator.reachesSpeakers())
      .map((oscillator) => oscillator.options.frequency);
  }

  heard(): number[] {
    return this.started.filter((note) => note.audible).map((note) => note.frequency);
  }
}

export function audioWindow(localStorage: Storage = memoryStorage()) {
  const contexts: StubAudioContext[] = [];
  vi.stubGlobal(
    'AudioContext',
    class extends StubAudioContext {
      constructor() {
        super();
        contexts.push(this);
      }
    },
  );
  vi.stubGlobal('GainNode', StubGainNode);
  vi.stubGlobal('OscillatorNode', StubOscillatorNode);
  const vibrate = vi.fn((_pattern: number | number[]) => true);
  const root = Object.assign(new EventTarget(), { localStorage, navigator: { vibrate } });
  return {
    root: root as unknown as Window,
    localStorage,
    vibrate,
    interact: (): void => void root.dispatchEvent(new Event('pointerup')),
    audio: (): StubAudioContext | undefined => contexts.at(-1),
  };
}
