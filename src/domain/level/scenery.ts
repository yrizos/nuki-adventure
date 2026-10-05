import { Direction, TilePosition } from './position';

export class Ground {
  static readonly Grass = new Ground('grass', true);
  static readonly Path = new Ground('path', true);
  static readonly Water = new Ground('water', false);

  private constructor(
    readonly name: 'grass' | 'path' | 'water',
    readonly isWalkable: boolean,
  ) {}

  equals(other: Ground): boolean {
    return this === other;
  }
}

export class LevelSize {
  private constructor(
    readonly columns: number,
    readonly rows: number,
  ) {}

  static of(columns: number, rows: number): LevelSize {
    if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 1 || rows < 1) {
      throw new RangeError(`A level needs at least one whole tile, got ${columns} × ${rows}`);
    }
    return new LevelSize(columns, rows);
  }

  contains(position: TilePosition): boolean {
    return position.column >= 0 && position.row >= 0 && position.column < this.columns && position.row < this.rows;
  }

  equals(other: LevelSize): boolean {
    return this.columns === other.columns && this.rows === other.rows;
  }
}

export class Tree {
  private constructor(readonly base: TilePosition) {}

  static at(base: TilePosition): Tree {
    return new Tree(base);
  }

  get footprint(): readonly TilePosition[] {
    return [this.base, this.base.neighbor(Direction.Right)];
  }

  covers(position: TilePosition): boolean {
    return this.footprint.some((tile) => tile.equals(position));
  }

  equals(other: Tree): boolean {
    return this.base.equals(other.base);
  }
}

export class Flower {
  private constructor(readonly position: TilePosition) {}

  static at(position: TilePosition): Flower {
    return new Flower(position);
  }

  equals(other: Flower): boolean {
    return this.position.equals(other.position);
  }
}

export class Fence {
  private constructor(readonly position: TilePosition) {}

  static at(position: TilePosition): Fence {
    return new Fence(position);
  }

  equals(other: Fence): boolean {
    return this.position.equals(other.position);
  }
}

export class Scenery {
  private constructor(
    readonly size: LevelSize,
    private readonly ground: readonly (readonly Ground[])[],
    readonly trees: readonly Tree[],
    readonly flowers: readonly Flower[],
    readonly fences: readonly Fence[],
  ) {}

  static of(
    size: LevelSize,
    ground: readonly (readonly Ground[])[],
    trees: readonly Tree[],
    flowers: readonly Flower[],
    fences: readonly Fence[] = [],
  ): Scenery {
    if (ground.length !== size.rows || ground.some((row) => row.length !== size.columns)) {
      throw new RangeError('Every tile of the level needs ground');
    }
    const groundAt = (position: TilePosition): Ground => ground[position.row]![position.column]!;
    const footprints = trees.flatMap((tree) => tree.footprint);
    footprints.forEach((tile, index) => {
      if (!size.contains(tile) || !groundAt(tile).equals(Ground.Grass)) {
        throw new RangeError(`A tree must stand on grass inside the level, at ${tile.column}, ${tile.row}`);
      }
      if (footprints.findIndex((other) => other.equals(tile)) !== index) {
        throw new RangeError(`Trees overlap at ${tile.column}, ${tile.row}`);
      }
    });
    for (const flower of flowers) {
      if (!size.contains(flower.position) || !groundAt(flower.position).equals(Ground.Grass)) {
        throw new RangeError(`Flowers must grow on grass inside the level, at ${flower.position.column}, ${flower.position.row}`);
      }
    }
    fences.forEach((fence, index) => {
      const { position } = fence;
      if (!size.contains(position) || !groundAt(position).equals(Ground.Grass) || footprints.some((tile) => tile.equals(position))) {
        throw new RangeError(`A fence must stand on open grass inside the level, at ${position.column}, ${position.row}`);
      }
      if (fences.findIndex((other) => other.equals(fence)) !== index) {
        throw new RangeError(`Fences overlap at ${position.column}, ${position.row}`);
      }
    });
    return new Scenery(size, ground.map((row) => [...row]), [...trees], [...flowers], [...fences]);
  }

  groundAt(position: TilePosition): Ground {
    if (!this.size.contains(position)) throw new RangeError(`${position.column}, ${position.row} is outside the level`);
    return this.ground[position.row]![position.column]!;
  }

  isWalkable(position: TilePosition): boolean {
    return (
      this.size.contains(position) &&
      this.groundAt(position).isWalkable &&
      !this.trees.some((tree) => tree.covers(position)) &&
      !this.fences.some((fence) => fence.position.equals(position))
    );
  }
}
