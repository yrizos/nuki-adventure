const frameLength = 1000 / 60;

export class GameLoop {
  private pending = 0;
  private resting = false;

  constructor(
    private readonly tick: () => void,
    private readonly render: (tickProgress: number) => void,
    private previous: number,
  ) {}

  // A hidden page stops play, so the time it was away must not be caught up when it comes back.
  rest(): void {
    this.resting = true;
  }

  advance(now: number): void {
    if (this.resting) {
      this.resting = false;
      this.pending = 0;
      this.previous = now;
    }
    // A frame's timestamp can come from before the loop started, which must not leave the loop owing time. The cap keeps a long pause, such as a background tab, from fast-forwarding the game.
    this.pending = Math.max(0, Math.min(this.pending + now - this.previous, frameLength * 10));
    this.previous = now;
    while (this.pending >= frameLength) {
      this.tick();
      this.pending -= frameLength;
    }
    this.render(this.pending / frameLength);
  }
}
