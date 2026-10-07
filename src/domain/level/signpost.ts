import { Outline } from './obstacles';
import { Direction, type TilePosition, tileSize } from './position';

export class SignpostText {
  private constructor(readonly value: string) {}

  static of(value: string): SignpostText {
    if (value.trim() === '') throw new RangeError('A signpost needs something written on it');
    return new SignpostText(value);
  }

  equals(other: SignpostText): boolean {
    return this.value === other.value;
  }
}

export class Signpost {
  private constructor(
    readonly position: TilePosition,
    readonly text: SignpostText,
  ) {}

  static at(position: TilePosition, text: SignpostText): Signpost {
    return new Signpost(position, text);
  }

  get obstacle(): Outline {
    return Outline.spanning(this.position, 13, 19, 19, tileSize);
  }

  // The board is read from the side or from in front, so standing on any of the four touching tiles is enough.
  // The post is narrower than its tile, so her feet can also stand on the signpost's own tile.
  isReadableFrom(position: TilePosition): boolean {
    return (
      this.position.equals(position) ||
      [Direction.Up, Direction.Down, Direction.Left, Direction.Right].some((direction) =>
        this.position.neighbor(direction).equals(position),
      )
    );
  }

  equals(other: Signpost): boolean {
    return this.position.equals(other.position) && this.text.equals(other.text);
  }
}
