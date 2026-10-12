import type { LevelAction } from './level-action';
import { Outline, wholeTile } from './obstacles';
import { Direction, type TilePosition, tileSize } from './position';

type SwingGateState = 'closed' | 'opening' | 'open' | 'closing';

// Only a leaf hinged on its west post and swinging north exists, so the geometry is fixed rather than configured.
const leafThickness = 3;

export class SwingGate {
  private constructor(
    readonly position: TilePosition,
    readonly state: SwingGateState,
  ) {}

  readonly actions: readonly LevelAction[] = ['operate'];

  static closedAt(position: TilePosition): SwingGate {
    return new SwingGate(position, 'closed');
  }

  get approach(): TilePosition {
    return this.position.neighbor(Direction.Down);
  }

  get isOpen(): boolean {
    return this.state === 'open';
  }

  covers(position: TilePosition): boolean {
    return this.position.equals(position);
  }

  // Children rarely stop on the exact tile in front, so any tile beside the passage on either side will do.
  operableFrom(tile: TilePosition): boolean {
    return Math.abs(tile.row - this.position.row) === 1 && Math.abs(tile.column - this.position.column) <= 1;
  }

  // The leaf sweeps between its shut and open places, so feet touching either would be swung into.
  clearOf(feet: Outline): boolean {
    return [wholeTile(this.position), ...this.openLeaf].every((leaf) => !leaf.overlaps(feet));
  }

  requestOpen(): SwingGate {
    return this.state === 'closed' ? new SwingGate(this.position, 'opening') : this;
  }

  finishOpening(): SwingGate {
    return this.state === 'opening' ? new SwingGate(this.position, 'open') : this;
  }

  requestClose(): SwingGate {
    return this.state === 'open' ? new SwingGate(this.position, 'closing') : this;
  }

  finishClosing(): SwingGate {
    return this.state === 'closing' ? new SwingGate(this.position, 'closed') : this;
  }

  // The leaf keeps the passage shut until it has finished opening, and from the moment it starts closing, so the crossing never looks shut while it lets her through.
  get obstacles(): readonly Outline[] {
    return this.isOpen ? this.openLeaf : [wholeTile(this.position)];
  }

  private get openLeaf(): readonly Outline[] {
    const north = this.position.neighbor(Direction.Up);
    return [
      Outline.spanning(this.position, 0, 0, leafThickness, 22),
      Outline.spanning(north, 0, 12, leafThickness, tileSize),
    ];
  }

  equals(other: SwingGate): boolean {
    return this.position.equals(other.position) && this.state === other.state;
  }
}
