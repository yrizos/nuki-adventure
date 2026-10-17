import { Outline } from './obstacles';
import { Direction, type TilePosition, tileSize } from './position';

export class Door {
  private constructor(
    readonly left: TilePosition,
    readonly isOpen: boolean,
  ) {}

  static closedAt(left: TilePosition): Door {
    return new Door(left, false);
  }

  get footprint(): readonly TilePosition[] {
    const middle = this.left.neighbor(Direction.Right);
    return [this.left, middle, middle.neighbor(Direction.Right)];
  }

  covers(position: TilePosition): boolean {
    return (
      position.row === this.left.row && position.column >= this.left.column && position.column <= this.left.column + 2
    );
  }

  hides(position: TilePosition): boolean {
    const below = position.neighbor(Direction.Down);
    return this.covers(below) || this.covers(below.neighbor(Direction.Down));
  }

  // The closed door fills its tiles, so her feet never stand on a door tile until it opens.
  get obstacle(): Outline {
    return Outline.spanning(this.left, 0, 0, 3 * tileSize, tileSize);
  }

  opened(): Door {
    return new Door(this.left, true);
  }
}
