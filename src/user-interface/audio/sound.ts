type Wave = 'square' | 'triangle' | 'sine';
export type Track = 'end' | 'game';

interface Tune {
  readonly notes: readonly number[];
  readonly spacing: number;
  readonly length: number;
  readonly attack: number;
  readonly wave: Wave;
  readonly volume: number;
}

// The end tune is slow sine notes that swell in and ring past the next one, so it flows where the game tune bounces.
const tunes: Readonly<Record<Track, Tune>> = {
  game: {
    notes: [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1047, 988, 784, 659, 587],
    spacing: 0.25,
    length: 0.225,
    attack: 0,
    wave: 'triangle',
    volume: 0.05,
  },
  end: {
    notes: [262, 330, 392, 440, 392, 330, 294, 330, 220, 262, 330, 392, 330, 294, 262, 196],
    spacing: 1,
    length: 2.5,
    attack: 0.4,
    wave: 'sine',
    volume: 0.06,
  },
};
const tuneFadeOut = 1;
const tuneFadeIn = 0.5;
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
  private track: Track | null = null;
  private tuneGain: GainNode | null = null;
  private tuneTimer: ReturnType<typeof setTimeout> | undefined;
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
        this.playTune();
      }
      void this.context.resume().then(() => unlockEvents.forEach((type) => root.removeEventListener(type, unlock)));
    };
    unlockEvents.forEach((type) => root.addEventListener(type, unlock));
  }

  music(track: Track | null): void {
    if (track === this.track) return;
    this.track = track;
    this.playTune();
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

  // The last orb's pulse is left out because the restoring pattern starts on the same tick and would blur into it.
  orb(last = false): void {
    if (!last) this.buzz(90);
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
    this.buzz([30, 80, 45, 80, 60]);
    this.notes([523, 587, 659, 784, 880, 1047, 1175, 1319], 0.12, 'triangle', 0.15);
  }

  arrival(): void {
    this.notes([784, 1047, 1319, 1568, 2093], 0.14, 'triangle', 0.1);
  }

  // Two quiet high notes nudge the player toward the A button without competing with the orb hum.
  // Only the first chime vibrates, since a buzz repeating while the game waits would nag.
  hint(first = false): void {
    if (first) this.buzz(30);
    this.notes([1568, 2093], 0.05, 'triangle', 0.04);
  }

  // A low creak then a knock reads as wood swinging on its hinge and coming to rest.
  gate(): void {
    this.buzz(60);
    this.notes([147, 131, 110, 82], 0.06, 'triangle', 0.18);
  }

  // A square chirp over a stone thud sets the plate apart from the wooden gate creak and the bright chime of an orb.
  plate(pressed: boolean): void {
    if (pressed) {
      this.buzz(40);
      this.note(73, 0, 0.08, 'triangle', 0.2);
      this.notes([392, 523, 784], 0.05, 'square', 0.06);
    } else this.notes([523, 330], 0.05, 'square', 0.04);
  }

  door(): void {
    this.buzz([45, 50, 45, 50, 120]);
    this.notes([784, 659, 523, 392], 0.15, 'square', 0.1);
  }

  // iOS browsers have no vibrate method, so the call is skipped there. The sound switch leaves vibration on, so muted players still feel the game.
  private buzz(pattern: number | number[]): void {
    this.root.navigator.vibrate?.(pattern);
  }

  // The old tune fades out while the new one fades in, so changing screens never cuts a note off.
  private playTune(): void {
    const context = this.context;
    const output = this.output;
    if (!context || !output) return;
    clearTimeout(this.tuneTimer);
    const now = context.currentTime;
    const old = this.tuneGain;
    if (old) {
      old.gain.setValueAtTime(old.gain.value, now);
      old.gain.linearRampToValueAtTime(0, now + tuneFadeOut);
      setTimeout(() => old.disconnect(), tuneFadeOut * 1000);
    }
    this.tuneGain = null;
    if (!this.track) return;
    const gain = new GainNode(context, { gain: 0 });
    gain.gain.linearRampToValueAtTime(1, now + tuneFadeIn);
    gain.connect(output);
    this.tuneGain = gain;
    this.loopTune(gain, tunes[this.track], now);
  }

  private loopTune(gain: GainNode, tune: Tune, start: number): void {
    const context = gain.context;
    tune.notes.forEach((frequency, index) => {
      const begin = start + index * tune.spacing;
      const oscillator = new OscillatorNode(context, { type: tune.wave, frequency });
      // Exponential ramps cannot start from or reach zero, so near-silent gains stand in for silence.
      const envelope = new GainNode(context, { gain: tune.attack ? 0.0001 : tune.volume });
      if (tune.attack) envelope.gain.setValueAtTime(0.0001, begin);
      envelope.gain.linearRampToValueAtTime(tune.volume, begin + tune.attack);
      envelope.gain.exponentialRampToValueAtTime(0.001, begin + tune.length);
      oscillator.connect(envelope).connect(gain);
      oscillator.start(begin);
      oscillator.stop(begin + tune.length);
    });
    const end = start + tune.notes.length * tune.spacing;
    // Scheduling the next pass ahead of time keeps the loop seamless even when the timer fires late.
    this.tuneTimer = setTimeout(() => this.loopTune(gain, tune, end), (end - context.currentTime - 1) * 1000);
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
