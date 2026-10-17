import type { StarCount } from '../../level';

export class PlayTime {
  private constructor(readonly frames: number) {}

  static ofFrames(frames: number): PlayTime {
    if (!Number.isInteger(frames) || frames < 0)
      throw new RangeError(`A play time needs a whole number of frames of zero or more, got ${frames}`);
    return new PlayTime(frames);
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
}
