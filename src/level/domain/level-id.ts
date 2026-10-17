export class LevelId {
  private constructor(readonly value: string) {}

  static of(value: string): LevelId {
    if (value.trim() === '') throw new RangeError('A level id cannot be empty');
    return new LevelId(value);
  }

  equals(other: LevelId): boolean {
    return this.value === other.value;
  }
}
