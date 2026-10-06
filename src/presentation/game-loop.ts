const frameLength = 1000 / 60;

export class GameLoop {
  private pending = 0;

  constructor(
    private readonly tick: () => void,
    private readonly render: () => void,
    private previous: number,
  ) {}

  advance(now: number): void {
    this.pending = Math.min(this.pending + now - this.previous, frameLength * 10);
    this.previous = now;
    while (this.pending >= frameLength) {
      this.tick();
      this.pending -= frameLength;
    }
    this.render();
  }
}
