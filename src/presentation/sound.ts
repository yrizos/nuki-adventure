type Wave = 'square' | 'triangle';

const melody = [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1047, 988, 784, 659, 587];
const melodyNoteLength = 0.25;
const storageKey = 'sound';

// Storage can be unavailable, such as in some private browsing modes, and the switch must still work for the current visit.
function remembered(root: Window): boolean {
  try {
    return root.localStorage.getItem(storageKey) !== 'off';
  } catch {
    return true;
  }
}

function remember(root: Window, on: boolean): void {
  try {
    root.localStorage.setItem(storageKey, on ? 'on' : 'off');
  } catch {}
}

export class Sound {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private enabled: boolean;
  private readonly root: Window;

  constructor(root: Window) {
    this.root = root;
    this.enabled = remembered(root);
    // Browsers keep audio silent until the player interacts with the page. Mobile browsers ignore the press of a touch and only allow audio on its release, so the context is resumed on every interaction until one is accepted.
    const unlockEvents = ['pointerdown', 'pointerup', 'keydown'] as const;
    const unlock = (): void => {
      if (!this.context) {
        this.context = new AudioContext();
        // The music keeps its schedule while muted, so turning sound back on resumes the tune in time instead of restarting it.
        this.output = new GainNode(this.context, { gain: this.enabled ? 1 : 0 });
        this.output.connect(this.context.destination);
        this.music(this.context.currentTime);
      }
      void this.context.resume().then(() => unlockEvents.forEach((type) => root.removeEventListener(type, unlock)));
    };
    unlockEvents.forEach((type) => root.addEventListener(type, unlock));
  }

  get on(): boolean {
    return this.enabled;
  }

  toggle(): void {
    this.enabled = !this.enabled;
    remember(this.root, this.enabled);
    this.output?.gain.setValueAtTime(this.enabled ? 1 : 0, this.output.context.currentTime);
  }

  footstep(): void {
    this.note(110, 0, 0.04, 'triangle', 0.15);
  }

  star(last = false): void {
    this.notes(last ? [1319, 1760, 2093, 2637] : [1319, 1760], last ? 0.09 : 0.06, 'square', 0.08);
  }

  orb(): void {
    this.notes([784, 988, 1175, 1568], 0.08, 'square', 0.1);
  }

  restoring(): void {
    this.notes([523, 587, 659, 784, 880, 1047, 1175, 1319], 0.12, 'triangle', 0.15);
  }

  door(): void {
    this.notes([784, 659, 523, 392], 0.15, 'square', 0.1);
  }

  private music(start: number): void {
    const context = this.context;
    if (!context) return;
    melody.forEach((frequency, index) =>
      this.note(
        frequency,
        start - context.currentTime + index * melodyNoteLength,
        melodyNoteLength * 0.9,
        'triangle',
        0.05,
      ),
    );
    const end = start + melody.length * melodyNoteLength;
    // Scheduling the next pass ahead of time keeps the loop seamless even when the timer fires late.
    setTimeout(() => this.music(end), (end - context.currentTime - 1) * 1000);
  }

  private notes(frequencies: readonly number[], length: number, wave: Wave, volume: number): void {
    frequencies.forEach((frequency, index) => this.note(frequency, index * length, length, wave, volume));
  }

  private note(frequency: number, delay: number, length: number, wave: Wave, volume: number): void {
    const context = this.context;
    const output = this.output;
    if (!context || !output) return;
    const start = context.currentTime + delay;
    const oscillator = new OscillatorNode(context, { type: wave, frequency });
    const gain = new GainNode(context, { gain: volume });
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + length);
    oscillator.connect(gain).connect(output);
    oscillator.start(start);
    oscillator.stop(start + length);
  }
}
