import { Direction, type TilePosition } from './position';

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

  // The board is read from the side or from in front, so standing on any of the four touching tiles is enough.
  isBeside(position: TilePosition): boolean {
    return [Direction.Up, Direction.Down, Direction.Left, Direction.Right].some((direction) =>
      this.position.neighbor(direction).equals(position),
    );
  }

  equals(other: Signpost): boolean {
    return this.position.equals(other.position) && this.text.equals(other.text);
  }
}
