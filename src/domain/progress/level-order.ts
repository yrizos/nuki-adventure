import type { LevelId } from '../shared/level-id';

export class LevelOrder {
  private constructor(private readonly sequence: readonly LevelId[]) {}

  static of(levels: readonly LevelId[]): LevelOrder {
    if (levels.length === 0) throw new RangeError('A level order needs at least one level');
    if (levels.some((level, index) => levels.findIndex((other) => other.equals(level)) !== index))
      throw new RangeError('A level order holds each level once');
    return new LevelOrder([...levels]);
  }

  get levels(): readonly LevelId[] {
    return [...this.sequence];
  }

  get first(): LevelId {
    return this.sequence[0]!;
  }

  includes(level: LevelId): boolean {
    return this.sequence.some((candidate) => candidate.equals(level));
  }

  after(level: LevelId): LevelId | null {
    const index = this.sequence.findIndex((candidate) => candidate.equals(level));
    return index >= 0 ? (this.sequence[index + 1] ?? null) : null;
  }
}
