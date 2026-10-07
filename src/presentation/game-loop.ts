const frameLength = 1000 / 60;

export class GameLoop {
  private pending = 0;

  constructor(
    private readonly tick: () => void,
    private readonly render: (tickProgress: number) => void,
    private previous: number,
  ) {}

  advance(now: number): void {
    // A frame's timestamp can come from before the loop started, which must not leave the loop owing time.
    this.pending = Math.max(0, Math.min(this.pending + now - this.previous, frameLength * 10));
    this.previous = now;
    while (this.pending >= frameLength) {
      this.tick();
      this.pending -= frameLength;
    }
    this.render(this.pending / frameLength);
  }
}
