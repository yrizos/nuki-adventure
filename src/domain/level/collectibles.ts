import type { TilePosition } from './position';

export class Area {
  private readonly keys: ReadonlySet<string>;

  private constructor(readonly tiles: readonly TilePosition[]) {
    this.keys = new Set(tiles.map((tile) => `${tile.column},${tile.row}`));
  }

  static of(tiles: readonly TilePosition[]): Area {
    const area = new Area([...tiles]);
    if (tiles.length === 0) throw new RangeError('An area needs at least one tile');
    if (area.keys.size !== tiles.length) throw new RangeError('An area holds each tile only once');
    return area;
  }

  covers(position: TilePosition): boolean {
    return this.keys.has(`${position.column},${position.row}`);
  }

  equals(other: Area): boolean {
    return this.tiles.length === other.tiles.length && this.tiles.every((tile) => other.covers(tile));
  }
}

export class Key {
  private constructor(
    readonly position: TilePosition,
    readonly restores: Area,
  ) {}

  static at(position: TilePosition, restores: Area): Key {
    return new Key(position, restores);
  }

  equals(other: Key): boolean {
    return this.position.equals(other.position) && this.restores.equals(other.restores);
  }
}

export class Star {
  private constructor(readonly position: TilePosition) {}

  static at(position: TilePosition): Star {
    return new Star(position);
  }

  equals(other: Star): boolean {
    return this.position.equals(other.position);
  }
}
