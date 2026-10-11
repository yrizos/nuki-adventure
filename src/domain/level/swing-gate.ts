import { Outline, wholeTile } from './obstacles';
import { Direction, type TilePosition, tileSize } from './position';

type SwingGateState = 'closed' | 'opening' | 'open';

// Only a leaf hinged on its west post and swinging north exists, so the geometry is fixed rather than configured.
const leafThickness = 3;

export class SwingGate {
  private constructor(
    readonly position: TilePosition,
    readonly state: SwingGateState,
  ) {}

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

  requestOpen(): SwingGate {
    return this.state === 'closed' ? new SwingGate(this.position, 'opening') : this;
  }

  finishOpening(): SwingGate {
    return this.state === 'opening' ? new SwingGate(this.position, 'open') : this;
  }

  // The leaf keeps the passage shut until it has finished swinging, so the crossing never opens before it looks open.
  get obstacles(): readonly Outline[] {
    if (!this.isOpen) return [wholeTile(this.position)];
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
