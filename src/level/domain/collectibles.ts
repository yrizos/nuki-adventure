import { TilePosition, tileKey } from './position';
import type { LevelSize } from './scenery';

// The lookups live beside the areas, so two areas of the same tiles stay equal whether or not either has been asked.
const keysOfAreas = new WeakMap<Area, ReadonlySet<number>>();

export class Area {
  private constructor(readonly tiles: readonly TilePosition[]) {}

  static of(tiles: readonly TilePosition[]): Area {
    const area = new Area([...tiles]);
    if (tiles.length === 0) throw new RangeError('An area needs at least one tile');
    if (area.tileKeys().size !== tiles.length) throw new RangeError('An area holds each tile only once');
    return area;
  }

  // A search tries many orb circles and asks few of them what they cover, so the lookup is built on the first question.
  // The tiles come from a walk over distinct positions, so there is nothing to check.
  static ofDistinct(tiles: readonly TilePosition[]): Area {
    return new Area(tiles);
  }

  static whole(size: LevelSize): Area {
    return Area.ofDistinct(
      Array.from({ length: size.columns * size.rows }, (_, index) =>
        TilePosition.at(index % size.columns, Math.floor(index / size.columns)),
      ),
    );
  }

  covers(position: TilePosition): boolean {
    return this.tileKeys().has(tileKey(position));
  }

  private tileKeys(): ReadonlySet<number> {
    let keys = keysOfAreas.get(this);
    if (!keys) {
      keys = new Set(this.tiles.map(tileKey));
      keysOfAreas.set(this, keys);
    }
    return keys;
  }
}

export const orbRadii = { smallest: 4, largest: 6 } as const;
// Color feathers out to the middle of the second tile past a restored area, so three faded tiles keep two circles from meeting.
const fadedGap = 3;

interface Span {
  readonly first: number;
  readonly last: number;
}

// A circle holds one unbroken run of columns in each row, so two circles are compared run by run instead of tile by tile.
// The runs live beside the orbs, so two orbs of the same circle stay equal whether or not they have been compared.
const spansOfOrbs = new WeakMap<Orb, ReadonlyMap<number, Span>>();

function spansOf(orb: Orb): ReadonlyMap<number, Span> {
  let spans = spansOfOrbs.get(orb);
  if (!spans) {
    const rows = new Map<number, Span>();
    for (const { column, row } of orb.restores.tiles) {
      const span = rows.get(row);
      rows.set(
        row,
        span
          ? { first: Math.min(span.first, column), last: Math.max(span.last, column) }
          : { first: column, last: column },
      );
    }
    spans = rows;
    spansOfOrbs.set(orb, spans);
  }
  return spans;
}

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
    return new Orb(position, radius, Area.ofDistinct(tiles));
  }

  touches(other: Orb): boolean {
    const reach = this.radius + other.radius + fadedGap;
    if (
      Math.abs(this.position.column - other.position.column) > reach ||
      Math.abs(this.position.row - other.position.row) > reach
    )
      return false;
    const theirs = spansOf(other);
    for (const [row, mine] of spansOf(this)) {
      for (let near = row - fadedGap; near <= row + fadedGap; near++) {
        const span = theirs.get(near);
        if (span && Math.max(mine.first - span.last, span.first - mine.last) <= fadedGap) return true;
      }
    }
    return false;
  }
}
