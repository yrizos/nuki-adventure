import type { LevelAction } from './level-action';
import { Outline } from './obstacles';
import { type Direction, type TilePosition, tileSize, WorldPosition } from './position';

const pixelsPerTick = 2;

export class Boulder {
  private constructor(
    readonly position: TilePosition,
    readonly heading: Direction | null,
    readonly travelled: number,
  ) {}

  static at(position: TilePosition): Boulder {
    return new Boulder(position, null, 0);
  }

  readonly actions: readonly LevelAction[] = ['push', 'pull'];

  get isSliding(): boolean {
    return this.heading !== null;
  }

  get destination(): TilePosition {
    return this.heading ? this.position.neighbor(this.heading) : this.position;
  }

  // Both tiles stay taken while it slides, so nothing can step into the one it is leaving or the one it is entering.
  covers(tile: TilePosition): boolean {
    return this.position.equals(tile) || this.destination.equals(tile);
  }

  slide(heading: Direction): Boulder {
    return this.isSliding ? this : new Boulder(this.position, heading, 0);
  }

  advance(): Boulder {
    if (!this.heading) return this;
    const travelled = this.travelled + pixelsPerTick;
    return travelled >= tileSize ? Boulder.at(this.destination) : new Boulder(this.position, this.heading, travelled);
  }

  get progress(): number {
    return this.travelled / tileSize;
  }

  get place(): WorldPosition {
    const { columnStep, rowStep } = this.heading ?? { columnStep: 0, rowStep: 0 };
    return WorldPosition.within(this.position, columnStep * this.travelled, rowStep * this.travelled);
  }

  get obstacle(): Outline {
    return Outline.oval(WorldPosition.within(this.position, 16, 18), 28, 28);
  }
}
