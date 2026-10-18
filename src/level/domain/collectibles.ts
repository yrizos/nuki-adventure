import { TilePosition, tileKey } from './position';
import type { LevelSize } from './scenery';

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

  static whole(size: LevelSize): Area {
    return Area.of(
      Array.from({ length: size.columns * size.rows }, (_, index) =>
        TilePosition.at(index % size.columns, Math.floor(index / size.columns)),
      ),
    );
  }

  covers(position: TilePosition): boolean {
    return this.keys.has(tileKey(position));
  }
}

export const orbRadii = { smallest: 4, largest: 6 } as const;
// Color feathers out to the middle of the second tile past a restored area, so three faded tiles keep two circles from meeting.
const fadedGap = 3;

export class Orb {
  private constructor(
    readonly position: TilePosition,
    readonly radius: number,
    readonly restores: Area,
  ) {}

  static at(position: TilePosition, radius: number, size: LevelSize): Orb {
    if (!Number.isInteger(radius) || radius < orbRadii.smallest || radius > orbRadii.largest) {
      throw new RangeError(
        `An orb restores ${orbRadii.smallest} to ${orbRadii.largest} tiles around it, not ${radius}`,
      );
    }
    if (!size.contains(position)) {
      throw new RangeError(`An orb must lie inside the level, at ${position.column}, ${position.row}`);
    }
    const tiles: TilePosition[] = [];
    for (let row = position.row - radius; row <= position.row + radius; row++) {
      for (let column = position.column - radius; column <= position.column + radius; column++) {
        const tile = TilePosition.at(column, row);
        if (size.contains(tile) && (column - position.column) ** 2 + (row - position.row) ** 2 <= radius ** 2)
          tiles.push(tile);
      }
    }
    return new Orb(position, radius, Area.of(tiles));
  }

  touches(other: Orb): boolean {
    const reach = this.radius + other.radius + fadedGap;
    if (
      Math.abs(this.position.column - other.position.column) > reach ||
      Math.abs(this.position.row - other.position.row) > reach
    )
      return false;
    return this.restores.tiles.some((tile) =>
      other.restores.tiles.some(
        (each) => Math.max(Math.abs(tile.column - each.column), Math.abs(tile.row - each.row)) <= fadedGap,
      ),
    );
  }
}
