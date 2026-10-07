export class StarCount {
  private constructor(readonly value: number) {}

  static of(value: number): StarCount {
    if (!Number.isInteger(value) || value < 0)
      throw new RangeError(`A star count needs a whole number of zero or more, got ${value}`);
    return new StarCount(value);
  }

  equals(other: StarCount): boolean {
    return this.value === other.value;
  }
}
