import { vi } from 'vitest';
import { memoryStorage } from './memory-storage';

class StubAudioNode {
  readonly outputs: StubAudioNode[] = [];

  constructor(readonly context: StubAudioContext) {}

  connect<T extends StubAudioNode>(target: T): T {
    this.outputs.push(target);
    return target;
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
  constructor(
    context: StubAudioContext,
    readonly options: { frequency: number },
  ) {
    super(context);
  }

  // Time never advances in the stub, so audibility is captured when the note starts and a later gain change cannot rewrite what was already played.
  start(): void {
    this.context.started.push({ frequency: this.options.frequency, audible: this.reachesSpeakers() });
  }

  stop(): void {}
}

export class StubAudioContext {
  readonly currentTime = 0;
  readonly destination = new StubAudioNode(this);
  readonly started: { readonly frequency: number; readonly audible: boolean }[] = [];

  resume(): Promise<void> {
    return Promise.resolve();
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
  const root = Object.assign(new EventTarget(), { localStorage });
  return {
    root: root as unknown as Window,
    localStorage,
    interact: (): void => void root.dispatchEvent(new Event('pointerup')),
    audio: (): StubAudioContext | undefined => contexts.at(-1),
  };
}
