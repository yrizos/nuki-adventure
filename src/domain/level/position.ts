export class Direction {
  static readonly Up = new Direction('up', 0, -1);
  static readonly Down = new Direction('down', 0, 1);
  static readonly Left = new Direction('left', -1, 0);
  static readonly Right = new Direction('right', 1, 0);
  static readonly UpLeft = new Direction('up-left', -1, -1);
  static readonly UpRight = new Direction('up-right', 1, -1);
  static readonly DownLeft = new Direction('down-left', -1, 1);
  static readonly DownRight = new Direction('down-right', 1, 1);

  private constructor(
    readonly name: 'up' | 'down' | 'left' | 'right' | 'up-left' | 'up-right' | 'down-left' | 'down-right',
    readonly columnStep: number,
    readonly rowStep: number,
  ) {}

  static combine(horizontal: Direction | null, vertical: Direction | null): Direction | null {
    if (!horizontal) return vertical;
    if (!vertical) return horizontal;
    if (vertical === Direction.Up) return horizontal === Direction.Left ? Direction.UpLeft : Direction.UpRight;
    return horizontal === Direction.Left ? Direction.DownLeft : Direction.DownRight;
  }

  get horizontal(): Direction | null {
    return this.columnStep < 0 ? Direction.Left : this.columnStep > 0 ? Direction.Right : null;
  }

  get vertical(): Direction | null {
    return this.rowStep < 0 ? Direction.Up : this.rowStep > 0 ? Direction.Down : null;
  }

  get facing(): Direction {
    return this.vertical ?? this;
  }

  get isDiagonal(): boolean {
    return this.columnStep !== 0 && this.rowStep !== 0;
  }

  equals(other: Direction): boolean {
    return this === other;
  }
}

export class TilePosition {
  private constructor(
    readonly column: number,
    readonly row: number,
  ) {}

  static at(column: number, row: number): TilePosition {
    if (!Number.isInteger(column) || !Number.isInteger(row)) {
      throw new RangeError(`A tile position needs whole numbers, got ${column}, ${row}`);
    }
    return new TilePosition(column, row);
  }

  neighbor(direction: Direction): TilePosition {
    return new TilePosition(this.column + direction.columnStep, this.row + direction.rowStep);
  }

  equals(other: TilePosition): boolean {
    return this.column === other.column && this.row === other.row;
  }
}

export const tileSize = 32;

export class WorldPosition {
  private constructor(
    readonly x: number,
    readonly y: number,
  ) {}

  static at(x: number, y: number): WorldPosition {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new RangeError(`A world position needs finite numbers, got ${x}, ${y}`);
    }
    return new WorldPosition(x, y);
  }

  static within(tile: TilePosition, x: number, y: number): WorldPosition {
    return WorldPosition.at(tile.column * tileSize + x, tile.row * tileSize + y);
  }

  moved(heading: Heading, distance: number): WorldPosition {
    return WorldPosition.at(this.x + heading.x * distance, this.y + heading.y * distance);
  }

  get tile(): TilePosition {
    return TilePosition.at(Math.floor(this.x / tileSize), Math.floor(this.y / tileSize));
  }

  equals(other: WorldPosition): boolean {
    return this.x === other.x && this.y === other.y;
  }
}

export class Heading {
  private constructor(
    readonly x: number,
    readonly y: number,
  ) {}

  static toward(x: number, y: number): Heading {
    const length = Math.hypot(x, y);
    if (!(length > 0) || !Number.isFinite(length)) throw new RangeError(`A heading needs a direction, got ${x}, ${y}`);
    return new Heading(x / length, y / length);
  }

  static of(direction: Direction): Heading {
    return Heading.toward(direction.columnStep, direction.rowStep);
  }

  alignment(direction: Direction): number {
    return this.x * direction.columnStep + this.y * direction.rowStep;
  }

  equals(other: Heading): boolean {
    return this.x === other.x && this.y === other.y;
  }
}
