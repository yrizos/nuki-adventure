import { Direction, type TilePosition } from './position';

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
    return this.footprint.some((tile) => tile.equals(position));
  }

  // The door stands three tiles tall, so whatever lies on the two tiles above its footprint is drawn behind it.
  hides(position: TilePosition): boolean {
    const below = position.neighbor(Direction.Down);
    return this.covers(below) || this.covers(below.neighbor(Direction.Down));
  }

  opened(): Door {
    return new Door(this.left, true);
  }

  equals(other: Door): boolean {
    return this.left.equals(other.left) && this.isOpen === other.isOpen;
  }
}
