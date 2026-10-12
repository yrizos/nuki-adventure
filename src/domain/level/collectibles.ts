import { type TilePosition, tileKey } from './position';

export class Area {
  private readonly keys: ReadonlySet<number>;

  private constructor(readonly tiles: readonly TilePosition[]) {
    this.keys = new Set(tiles.map(tileKey));
  }

  static of(tiles: readonly TilePosition[]): Area {
    const area = new Area([...tiles]);
    if (tiles.length === 0) throw new RangeError('An area needs at least one tile');
    if (area.keys.size !== tiles.length) throw new RangeError('An area holds each tile only once');
    return area;
  }

  covers(position: TilePosition): boolean {
    return this.keys.has(tileKey(position));
  }
}

export class KeyMaterial {
  static readonly Gold = new KeyMaterial('gold');
  static readonly Silver = new KeyMaterial('silver');

  private constructor(readonly name: 'gold' | 'silver') {}
}

export class Key {
  private constructor(
    readonly position: TilePosition,
    readonly restores: Area,
    readonly material: KeyMaterial,
  ) {}

  static at(position: TilePosition, restores: Area, material: KeyMaterial = KeyMaterial.Gold): Key {
    return new Key(position, restores, material);
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
