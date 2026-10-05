type Wave = 'square' | 'triangle';

const melody = [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1047, 988, 784, 659, 587];
const melodyNoteLength = 0.25;

export class Sound {
  private context: AudioContext | null = null;

  constructor(root: Window) {
    // Browsers keep audio silent until the player interacts with the page, so the first touch or key press unlocks it.
    const unlock = (): void => {
      if (this.context) return;
      this.context = new AudioContext();
      this.music(this.context.currentTime);
    };
    root.addEventListener('pointerdown', unlock, { once: true });
    root.addEventListener('keydown', unlock, { once: true });
  }

  footstep(): void {
    this.note(110, 0, 0.04, 'triangle', 0.15);
  }

  star(): void {
    this.notes([1319, 1760], 0.06, 'square', 0.08);
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
    melody.forEach((frequency, index) => this.note(frequency, start - context.currentTime + index * melodyNoteLength, melodyNoteLength * 0.9, 'triangle', 0.05));
    const end = start + melody.length * melodyNoteLength;
    // Scheduling the next pass ahead of time keeps the loop seamless even when the timer fires late.
    setTimeout(() => this.music(end), (end - context.currentTime - 1) * 1000);
  }

  private notes(frequencies: readonly number[], length: number, wave: Wave, volume: number): void {
    frequencies.forEach((frequency, index) => this.note(frequency, index * length, length, wave, volume));
  }

  private note(frequency: number, delay: number, length: number, wave: Wave, volume: number): void {
    const context = this.context;
    if (!context) return;
    const start = context.currentTime + delay;
    const oscillator = new OscillatorNode(context, { type: wave, frequency });
    const gain = new GainNode(context, { gain: volume });
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + length);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + length);
  }
}
