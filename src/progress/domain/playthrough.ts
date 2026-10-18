export class PlayTime {
  private constructor(readonly frames: number) {}

  static ofFrames(frames: number): PlayTime {
    if (!Number.isInteger(frames) || frames < 0)
      throw new RangeError(`A play time needs a whole number of frames of zero or more, got ${frames}`);
    return new PlayTime(frames);
  }
}

export class Playthrough {
  private constructor(readonly time: PlayTime) {}

  static of(time: PlayTime): Playthrough {
    return new Playthrough(time);
  }
}
