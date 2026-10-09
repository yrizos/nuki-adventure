import { Outline, wholeTile } from './obstacles';
import { Direction, TilePosition, TilePositions, tileSize, WorldPosition } from './position';

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

export class TreeVariant {
  static readonly NoFruit = new TreeVariant('no fruit');
  static readonly Oranges = new TreeVariant('oranges');
  static readonly Apples = new TreeVariant('apples');
  static readonly Lemons = new TreeVariant('lemons');

  private constructor(readonly name: 'no fruit' | 'oranges' | 'apples' | 'lemons') {}

  equals(other: TreeVariant): boolean {
    return this === other;
  }
}

export class Tree {
  private constructor(
    readonly base: TilePosition,
    readonly variant: TreeVariant,
  ) {}

  static at(base: TilePosition, variant: TreeVariant): Tree {
    return new Tree(base, variant);
  }

  get footprint(): readonly TilePosition[] {
    return [this.base, this.base.neighbor(Direction.Right)];
  }

  covers(position: TilePosition): boolean {
    return this.footprint.some((tile) => tile.equals(position));
  }

  // Canopies that meet only at a corner still read as one group, so they belong to the same cluster.
  sharesClusterWith(other: Tree): boolean {
    return this.footprint.some((tile) =>
      other.footprint.some(
        (neighbor) => Math.abs(tile.column - neighbor.column) <= 1 && Math.abs(tile.row - neighbor.row) <= 1,
      ),
    );
  }

  get obstacle(): Outline {
    return Outline.oval(WorldPosition.within(this.base, tileSize, 26), 18, 12);
  }

  // The canopy rises one tile above the footprint, so whatever lies on that tile is drawn behind it.
  hides(position: TilePosition): boolean {
    return this.covers(position.neighbor(Direction.Down));
  }

  equals(other: Tree): boolean {
    return this.base.equals(other.base) && this.variant.equals(other.variant);
  }
}

export class FlowerVariant {
  static readonly WhiteCoral = new FlowerVariant('white and coral');
  static readonly BlueViolet = new FlowerVariant('blue and violet');
  static readonly WhiteViolet = new FlowerVariant('white and violet');
  static readonly CoralBlue = new FlowerVariant('coral and blue');
  static readonly CoralViolet = new FlowerVariant('coral and violet');
  static readonly WhiteBlue = new FlowerVariant('white and blue');
  static readonly White = new FlowerVariant('white');
  static readonly Coral = new FlowerVariant('coral');
  static readonly Blue = new FlowerVariant('blue');
  static readonly Violet = new FlowerVariant('violet');

  static readonly All: readonly FlowerVariant[] = [
    FlowerVariant.WhiteCoral,
    FlowerVariant.BlueViolet,
    FlowerVariant.WhiteViolet,
    FlowerVariant.CoralBlue,
    FlowerVariant.CoralViolet,
    FlowerVariant.WhiteBlue,
    FlowerVariant.White,
    FlowerVariant.Coral,
    FlowerVariant.Blue,
    FlowerVariant.Violet,
  ];

  private constructor(readonly name: string) {}

  equals(other: FlowerVariant): boolean {
    return this === other;
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

  // A lone post leaves gaps her feet fit through, so the rails reach to every neighbor the fence joins.
  obstacles(joins: (direction: Direction) => boolean): readonly Outline[] {
    const [left, top, right, bottom] = [12, 17, 20, tileSize];
    const outline = (from: number, upper: number, to: number, lower: number): Outline =>
      Outline.spanning(this.position, from, upper, to, lower);
    return [
      outline(left, top, right, bottom),
      ...(joins(Direction.Left) ? [outline(0, top, right, bottom)] : []),
      ...(joins(Direction.Right) ? [outline(left, top, tileSize, bottom)] : []),
      ...(joins(Direction.Up) ? [outline(left, 0, right, bottom)] : []),
      ...(joins(Direction.Down) ? [outline(left, top, right, tileSize)] : []),
    ];
  }

  equals(other: Fence): boolean {
    return this.position.equals(other.position);
  }
}

export class Scenery {
  private readonly blocked: TilePositions;

  private constructor(
    readonly size: LevelSize,
    private readonly ground: readonly (readonly Ground[])[],
    readonly trees: readonly Tree[],
    readonly flowers: readonly Flower[],
    readonly fences: readonly Fence[],
    readonly flowerVariants: readonly FlowerVariant[],
  ) {
    this.blocked = TilePositions.of([
      ...trees.flatMap((tree) => tree.footprint),
      ...fences.map((fence) => fence.position),
    ]);
  }

  static of(
    size: LevelSize,
    ground: readonly (readonly Ground[])[],
    trees: readonly Tree[],
    flowers: readonly Flower[],
    fences: readonly Fence[] = [],
    flowerVariants: readonly FlowerVariant[] = FlowerVariant.All,
  ): Scenery {
    if (flowerVariants.length === 0 || new Set(flowerVariants).size !== flowerVariants.length) {
      throw new RangeError('Scenery needs a nonempty selection of distinct flower variants');
    }
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
    for (const tree of trees) {
      const other = trees.find(
        (neighbor) => neighbor.sharesClusterWith(tree) && !neighbor.variant.equals(tree.variant),
      );
      if (other) {
        throw new RangeError(
          `Trees in one cluster need the same variant, at ${tree.base.column}, ${tree.base.row} and ${other.base.column}, ${other.base.row}`,
        );
      }
    }
    for (const flower of flowers) {
      if (!size.contains(flower.position) || !groundAt(flower.position).equals(Ground.Grass)) {
        throw new RangeError(
          `Flowers must grow on grass inside the level, at ${flower.position.column}, ${flower.position.row}`,
        );
      }
    }
    fences.forEach((fence, index) => {
      const { position } = fence;
      if (
        !size.contains(position) ||
        !groundAt(position).equals(Ground.Grass) ||
        footprints.some((tile) => tile.equals(position))
      ) {
        throw new RangeError(
          `A fence must stand on open grass inside the level, at ${position.column}, ${position.row}`,
        );
      }
      if (fences.findIndex((other) => other.equals(fence)) !== index) {
        throw new RangeError(`Fences overlap at ${position.column}, ${position.row}`);
      }
    });
    return new Scenery(
      size,
      ground.map((row) => [...row]),
      [...trees],
      [...flowers],
      [...fences],
      [...flowerVariants],
    );
  }

  groundAt(position: TilePosition): Ground {
    if (!this.size.contains(position)) throw new RangeError(`${position.column}, ${position.row} is outside the level`);
    return this.ground[position.row]![position.column]!;
  }

  obstacles(joinsFence: (position: TilePosition) => boolean): readonly Outline[] {
    const { columns, rows } = this.size;
    const width = columns * tileSize;
    const height = rows * tileSize;
    const water: Outline[] = [];
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const tile = TilePosition.at(column, row);
        if (!this.groundAt(tile).isWalkable) water.push(wholeTile(tile));
      }
    }
    const joins = (fence: Fence) => (direction: Direction) => {
      const neighbor = fence.position.neighbor(direction);
      return joinsFence(neighbor) || this.fences.some((other) => other.position.equals(neighbor));
    };
    return [
      Outline.box(WorldPosition.at(-tileSize / 2, height / 2), tileSize, height + 2 * tileSize),
      Outline.box(WorldPosition.at(width + tileSize / 2, height / 2), tileSize, height + 2 * tileSize),
      Outline.box(WorldPosition.at(width / 2, -tileSize / 2), width + 2 * tileSize, tileSize),
      Outline.box(WorldPosition.at(width / 2, height + tileSize / 2), width + 2 * tileSize, tileSize),
      ...water,
      ...this.trees.map((tree) => tree.obstacle),
      ...this.fences.flatMap((fence) => fence.obstacles(joins(fence))),
    ];
  }

  isWalkable(position: TilePosition): boolean {
    return this.size.contains(position) && this.groundAt(position).isWalkable && !this.blocked.covers(position);
  }
}
