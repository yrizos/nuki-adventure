# Animation

Color codes refer to the [palette](palette.md).

## Movement

- The hero moves two pixels per frame at 60 frames per second: 16 frames per cardinal tile, 23 per diagonal tile.
- The camera follows in whole pixels and stops at map edges.
- Pushed objects move at the hero's speed and stay in contact with her.

## Timing

| Animation | Frames | Timing |
| --- | --- | --- |
| Hero walk | 4 per direction | 8 game frames each, one cycle per two cardinal tiles, continuous across tiles and diagonals |
| Hero idle | 2 | Blink of 6 frames every 180, except facing up. Shoulders lift one pixel every 90 |
| Hero push | 2 per direction | 8 game frames each |
| Orb swirl | 8 | 10 game frames each, phases 70 frames apart between orbs |
| Orb float | Sine, whole pixels | 2 pixels up and down over 150 frames, 1 pixel sideways over 60, with the orb's swirl phase. The shadow stays still |
| Orb burst | 6 | 4 game frames each from the pickup, at the orb's last float position. A 1 pixel swell, then a few pixels of its own ramp and Paper drift out and fade. The last frame is empty |
| Orb pop | 8 Paper specks, eased, whole pixels | 2 × 2 specks fly straight out from 12 to 92 pixels from the orb's center and drop out one by one between frames 20 and 35. One color only, no rotation |
| Water | 4 | 15 game frames each, all tiles in sync |
| Pressure plate sinking | 3 | 4 game frames each. Sinks deeper into the ground while pressed and rises in reverse once released. A release partway down rises from the current frame |
| Flowers sway | 2 | 30 game frames each, offset per tile |
| Tree leaves | 1 cluster shift | Every 40 game frames, out of sync between trees |
| Butterfly wings | 2 | 6 game frames each while flying, 30 while resting |
| Butterfly flight | Eased arc, whole pixels | 0.75 pixels per frame, at least 12 frames per flight. The arc lifts 6 pixels, with a 2 pixel flutter of 3 beats. Rests last 36 to 83 frames |
| Bird perch | 6 | Sit with a tail flick every 36 game frames, 6 game frames each |
| Bird ground | 4 per peck, 2 per hop | 6 game frames each. Two pecks, then two hops of a 4 pixel stride |
| Bird flight | 2 wing frames, eased arc, whole pixels | 6 game frames each. 1.5 pixels per frame, at least 18 frames per flight. Visits arc 10 pixels from 160 pixels aside and 112 up, flee flights arc 6 |
| Bird visits | Cycle | 3000 to 3900 frames per cycle, staying 900 to 1199. A sky crossing repeats every 10800 frames, climbing one tile with a 3 pixel wave of 3 beats |
| Light motes | 1 | Rise 1 pixel every 4 frames over 64 pixels, sway 1 pixel every 40, offset per mote |
| Restoring color | 16 thresholds | Front moves 1 tile every 4 frames, crest lasts 8 |
| Leaving a level | 16 thresholds | 3 frames each, 48 total |

## Magical Arrival

The hero materializes at her start over 48 game frames and cannot move until it ends.

| Frames | Animation |
| --- | --- |
| 0 to 15 | Eight Paper light motes with two-position trails spiral inward from about 20 pixels around her body. Hero and shadow are invisible |
| 16 to 39 | The hero appears from her feet upward through the ordered 4 × 4 dither, with a line of Paper pixels on the rising edge. Her shadow appears at frame 16. The motes circle her |
| 40 to 47 | Fully visible. The motes rise, spread and disappear |
| 48 onward | Normal idle and movement |

- Uses existing hero frames in her start facing, the existing light mote and the dither. No art of its own.
- The reveal masks only the hero. Motes stay within about 20 pixels of her, move in whole pixels and keep ordinary depth order.
- No transparency fades, scaling, rotation or blur. Nothing marks the end and no pause follows.

## Intro

The [intro](ui-layout.md#intro) is a still comic page drawn with the game's own art at its one size. Falling apples copy the apple clusters of the apple tree. The sound word Μ Π Ο Υ Μ ! is the game font at three times its size, or twice where three times does not fit the panel, in Y3, Y2 and O2 from top to bottom with an Ink outline.

| Frames | What shows |
| --- | --- |
| Each panel's first 32 | The panel appears through the ordered 4 × 4 dither, one threshold every 2 frames. Earlier panels stay |
| 0, 120, 240, 360, 480 | Panels 1 to 5 start to appear |
| 272 to 293 | Once panel 3 is whole, the whole page trembles in whole pixels, at most 3, and settles |
| 600 to 647 | The whole page darkens to Ink like [leaving a level](rendering.md#leaving-a-level), then the menu screen opens |

## Animation Rules

- Frames of one animation keep the same silhouette area. The hero is the exception, because her frames shift feet and pigtails.
- The hero's head moves at most one pixel.
- Looping tiles line up across tile edges in every frame.
- Stopping on a passing frame shows a settle frame for 8 game frames while her pigtails catch up.
- Arms swing opposite to the legs, one pixel forward and back. Shoulders dip one pixel on passing frames.
- Turning shows the new facing for 2 game frames before she moves.
- Orbs are collected by walking onto them, with no pause, pose or held-orb animation. The burst, the pop and restoration start at once and movement continues. The last orb shows a message that the colors are back.
- No transparency, screen shake, motion blur or glow filters. The [intro](#intro) tremble is the one exception.

## Reduced Motion

When the device asks for reduced motion:

- The game name never shines, and no sparkles or confetti show around it.
- The [intro](#intro) page does not tremble.
- The level picker's scroll buttons jump instead of gliding.

All other animation plays unchanged.
