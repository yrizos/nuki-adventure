type Wave = 'square' | 'triangle';

const melody = [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1047, 988, 784, 659, 587];
const melodyNoteLength = 0.25;
const storageKey = 'sound';
// Two close pitches beat against each other, so the steady tone buzzes without a second modulating oscillator.
const humPitches = [440, 446];
const humVolume = 0.03;

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
  private humGain: GainNode | null = null;
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
    this.buzz(last ? [15, 40, 15] : 15);
    this.notes(last ? [1319, 1760, 2093, 2637] : [1319, 1760], last ? 0.09 : 0.06, 'square', 0.08);
  }

  // The last key's pulse is left out because the restoring pattern starts on the same tick and would blur into it.
  key(last = false): void {
    if (!last) this.buzz(60);
    this.notes([1047, 1568, 1319, 2093], 0.07, 'triangle', 0.12);
  }

  // The hum is one continuous voice whose level glides toward each new volume, so moving tick by tick never clicks.
  hum(volume: number): void {
    const context = this.context;
    const output = this.output;
    if (!context || !output) return;
    if (!this.humGain) {
      this.humGain = new GainNode(context, { gain: 0 });
      this.humGain.connect(output);
      for (const frequency of humPitches) {
        const oscillator = new OscillatorNode(context, { type: 'triangle', frequency });
        oscillator.connect(this.humGain);
        oscillator.start();
      }
    }
    this.humGain.gain.setTargetAtTime(volume * humVolume, context.currentTime, 0.1);
  }

  restoring(): void {
    this.buzz([20, 80, 30, 80, 40]);
    this.notes([523, 587, 659, 784, 880, 1047, 1175, 1319], 0.12, 'triangle', 0.15);
  }

  arrival(): void {
    this.notes([784, 1047, 1319, 1568, 2093], 0.14, 'triangle', 0.1);
  }

  // Two quiet high notes nudge the player toward the A button without competing with the key hum.
  // Only the first chime vibrates, since a buzz repeating while the game waits would nag.
  hint(first = false): void {
    if (first) this.buzz(20);
    this.notes([1568, 2093], 0.05, 'triangle', 0.04);
  }

  // A low creak then a knock reads as wood swinging on its hinge and coming to rest.
  gate(): void {
    this.buzz(40);
    this.notes([147, 131, 110, 82], 0.06, 'triangle', 0.18);
  }

  door(): void {
    this.buzz([30, 50, 30, 50, 80]);
    this.notes([784, 659, 523, 392], 0.15, 'square', 0.1);
  }

  // iOS browsers have no vibrate method, so the call is skipped there.
  private buzz(pattern: number | number[]): void {
    if (this.enabled) this.root.navigator.vibrate?.(pattern);
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
