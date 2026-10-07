import type { TilePosition } from './position';

export class OrbColor {
  static readonly Red = new OrbColor('red');
  static readonly Blue = new OrbColor('blue');
  static readonly Violet = new OrbColor('violet');
  static readonly Teal = new OrbColor('teal');

  private constructor(readonly name: 'red' | 'blue' | 'violet' | 'teal') {}

  equals(other: OrbColor): boolean {
    return this === other;
  }
}

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

export class Orb {
  private constructor(
    readonly position: TilePosition,
    readonly color: OrbColor,
    readonly restores: Area,
  ) {}

  static at(position: TilePosition, color: OrbColor, restores: Area): Orb {
    return new Orb(position, color, restores);
  }

  equals(other: Orb): boolean {
    return (
      this.position.equals(other.position) && this.color.equals(other.color) && this.restores.equals(other.restores)
    );
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
