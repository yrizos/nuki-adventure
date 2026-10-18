import { type TilePosition, tileSize, WorldPosition } from './position';

export class Outline {
  private constructor(
    readonly form: 'box' | 'oval',
    readonly center: WorldPosition,
    readonly width: number,
    readonly height: number,
  ) {}

  static box(center: WorldPosition, width: number, height: number): Outline {
    return Outline.of('box', center, width, height);
  }

  static oval(center: WorldPosition, width: number, height: number): Outline {
    return Outline.of('oval', center, width, height);
  }

  private static of(form: 'box' | 'oval', center: WorldPosition, width: number, height: number): Outline {
    if (!(width > 0) || !(height > 0) || !Number.isFinite(width) || !Number.isFinite(height)) {
      throw new RangeError(`An outline needs a positive size, got ${width} × ${height}`);
    }
    return new Outline(form, center, width, height);
  }

  // Edges are given within one tile, which is how the art they follow is measured.
  static spanning(tile: TilePosition, left: number, top: number, right: number, bottom: number): Outline {
    return Outline.box(WorldPosition.within(tile, (left + right) / 2, (top + bottom) / 2), right - left, bottom - top);
  }

  at(center: WorldPosition): Outline {
    return new Outline(this.form, center, this.width, this.height);
  }

  contains(point: WorldPosition): boolean {
    const across = (point.x - this.center.x) / (this.width / 2);
    const along = (point.y - this.center.y) / (this.height / 2);
    return this.form === 'box' ? Math.abs(across) < 1 && Math.abs(along) < 1 : across ** 2 + along ** 2 < 1;
  }

  // Bounding boxes are compared, so an oval counts as touching a little early, which errs on the side of keeping clear.
  overlaps(other: Outline): boolean {
    return (
      Math.abs(this.center.x - other.center.x) < (this.width + other.width) / 2 &&
      Math.abs(this.center.y - other.center.y) < (this.height + other.height) / 2
    );
  }
}

export interface Obstacles {
  walk(feet: Outline, to: WorldPosition): WorldPosition;
}

export type PlaceObstacles = (outlines: readonly Outline[]) => Obstacles;

export function wholeTile(tile: TilePosition): Outline {
  return Outline.spanning(tile, 0, 0, tileSize, tileSize);
}
