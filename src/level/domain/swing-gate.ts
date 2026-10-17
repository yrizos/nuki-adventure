import type { LevelAction } from './level-action';
import { Outline, wholeTile } from './obstacles';
import { Direction, type TilePosition, tileSize } from './position';

type SwingGateState = 'closed' | 'opening' | 'open' | 'closing';

// A leaf always swings away from the side she approaches, hinged on its west post in a row of fence or its north post in a column, so only the approach is configured.
const leafThickness = 3;

const gateSwingLength = 16;

export class SwingGate {
  private constructor(
    readonly position: TilePosition,
    readonly state: SwingGateState,
    readonly approachSide: Direction,
    readonly swung = 0,
  ) {}

  readonly actions: readonly LevelAction[] = ['operate'];

  static closedAt(position: TilePosition, approachSide: Direction = Direction.Down): SwingGate {
    if (!approachSide.equals(Direction.Down) && !approachSide.equals(Direction.Left))
      throw new RangeError(`A gate is approached from the south or the west, not ${approachSide.name}`);
    return new SwingGate(position, 'closed', approachSide);
  }

  get approach(): TilePosition {
    return this.position.neighbor(this.approachSide);
  }

  get swing(): Direction {
    return this.approachSide.opposite;
  }

  private get inColumn(): boolean {
    return this.approachSide.equals(Direction.Left);
  }

  get isOpen(): boolean {
    return this.state === 'open';
  }

  covers(position: TilePosition): boolean {
    return this.position.equals(position);
  }

  hides(position: TilePosition): boolean {
    const swung = this.position.neighbor(this.swing);
    return [this.position, swung, ...(this.inColumn ? [swung.neighbor(Direction.Up)] : [])].some((tile) =>
      tile.equals(position),
    );
  }

  // Children rarely stop on the exact tile in front, so any tile beside the passage on either side will do.
  operableFrom(tile: TilePosition): boolean {
    const across = this.inColumn ? tile.column - this.position.column : tile.row - this.position.row;
    const along = this.inColumn ? tile.row - this.position.row : tile.column - this.position.column;
    return Math.abs(across) === 1 && Math.abs(along) <= 1;
  }

  // The leaf sweeps between its shut and open places, so feet touching either would be swung into.
  clearOf(feet: Outline): boolean {
    return [wholeTile(this.position), ...this.openLeaf].every((leaf) => !leaf.overlaps(feet));
  }

  requestOpen(): SwingGate {
    return this.state === 'closed' ? this.with('opening') : this;
  }

  requestClose(): SwingGate {
    return this.state === 'open' ? this.with('closing') : this;
  }

  get isSwinging(): boolean {
    return this.state === 'opening' || this.state === 'closing';
  }

  // The frame the swing starts on counts as its first, so a swing lasts exactly gateSwingLength frames.
  swingOn(): SwingGate {
    if (!this.isSwinging) return this;
    if (this.swung + 1 < gateSwingLength) return this.with(this.state, this.swung + 1);
    return this.with(this.state === 'opening' ? 'open' : 'closed');
  }

  // The leaf keeps the passage shut until it has finished opening, and from the moment it starts closing, so the crossing never looks shut while it lets her through.
  get obstacles(): readonly Outline[] {
    return this.isOpen ? this.openLeaf : [wholeTile(this.position)];
  }

  private get openLeaf(): readonly Outline[] {
    const swung = this.position.neighbor(this.swing);
    if (this.inColumn)
      return [
        Outline.spanning(this.position, tileSize / 2, 0, tileSize, leafThickness),
        Outline.spanning(swung, 0, 0, tileSize / 2, leafThickness),
      ];
    return [
      Outline.spanning(this.position, 0, 0, leafThickness, 22),
      Outline.spanning(swung, 0, 12, leafThickness, tileSize),
    ];
  }

  // A swing turned back halfway keeps the passage shut, because the leaf blocks it while opening and while closing.
  // Turning back starts from the leaf's current angle instead of jumping to the far end.
  reverse(): SwingGate {
    if (this.state === 'opening') return this.with('closing', gateSwingLength - 1 - this.swung);
    if (this.state === 'closing') return this.with('opening', gateSwingLength - 1 - this.swung);
    return this;
  }

  private with(state: SwingGateState, swung = 0): SwingGate {
    return new SwingGate(this.position, state, this.approachSide, swung);
  }
}
