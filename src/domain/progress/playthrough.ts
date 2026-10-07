import { type StarCount } from '../shared/star-count';

export class PlayTime {
  private constructor(readonly frames: number) {}

  static ofFrames(frames: number): PlayTime {
    if (!Number.isInteger(frames) || frames < 0)
      throw new RangeError(`A play time needs a whole number of frames of zero or more, got ${frames}`);
    return new PlayTime(frames);
  }

  isShorterThan(other: PlayTime): boolean {
    return this.frames < other.frames;
  }

  equals(other: PlayTime): boolean {
    return this.frames === other.frames;
  }
}

export class Playthrough {
  private constructor(
    readonly time: PlayTime,
    readonly collectedStars: StarCount,
    readonly starCount: StarCount,
  ) {}

  static of(time: PlayTime, collectedStars: StarCount, starCount: StarCount): Playthrough {
    if (collectedStars.value > starCount.value)
      throw new RangeError(`A playthrough cannot collect ${collectedStars.value} of ${starCount.value} stars`);
    return new Playthrough(time, collectedStars, starCount);
  }

  // Stars collected from a level that has since gained or lost stars say nothing about the level as it is now.
  isBetterThan(other: Playthrough): boolean {
    if (!this.starCount.equals(other.starCount)) return true;
    if (this.collectedStars.value !== other.collectedStars.value)
      return this.collectedStars.value > other.collectedStars.value;
    return this.time.isShorterThan(other.time);
  }

  equals(other: Playthrough): boolean {
    return (
      this.time.equals(other.time) &&
      this.collectedStars.equals(other.collectedStars) &&
      this.starCount.equals(other.starCount)
    );
  }
}
