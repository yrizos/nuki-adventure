# Testing

Unit tests must catch every behavior regression on a local machine within seconds, using Vitest and Node.js built-ins only.

## Speed

- A slow test is fixed by profiling it and removing the cost it measures, not by moving it out of the default run. There is no fast subset, no separately run slow suite and no raised timeout.
- Prefer a behavior-preserving production speed-up when the game pays the same cost, such as a repeated list scan or an object rebuilt every frame.
- No test asserts on its own duration, because timing depends on the machine.
- Profile a file with `--cpu-prof` before changing it for speed. Keep a change only if the profile shows the cost dropped.
- Profile every test file that takes more than one second in a full run.
- Membership checks in searches and sweeps use a `Set` or `TilePositions`, never a list scan such as `reached.some((tile) => tile.equals(neighbor))`.
- An expensive search that depends only on fixed level data runs once per file and is shared by the tests that read it.
- A whole-level playthrough runs once. A level's own test file does not repeat a scenario that the shared authored-level tests already cover for every level.

## One Test Per Behavior

- Test each behavior once, at the highest public entry point that reaches it: the game session, then `WorldPainter.paint`, then `Level.tick()` or `GameProgress`, then the module.
- Keep a lower-level test only for a boundary or case the higher test cannot reach.
- Before adding a test, search for one that already checks the behavior. Extend it instead of adding a copy.
- When two tests overlap, merge the checks only one of them makes into the other and delete the copy.
- A level's own test file checks only what is specific to that level. A check that applies to every level goes in the `authoredLevels` loop of `src/infrastructure/authored-levels.test.ts`.
- Production code exists only for the game. Delete a method or export that only tests call, together with its tests.

## What Each Layer Tests

- Domain: business rules and invariants. Aggregates are tested through their public API (`Level.tick()`, `GameProgress`). Value objects are tested for their own validation and behavior, and for equality only where the game compares them.
- Application: orchestration only. Services run against in-memory repositories and real aggregates.
- Infrastructure: adapters at their boundary. Storage round trips, malformed and unavailable storage, layout parsing and the content of every authored level.
- Presentation: session flow with explicit frame advancement, rendering through pixels, and controls and screens through a fake document.

## Test Doubles

- Domain objects are always real. They are never mocked.
- Browser APIs are replaced by one shared set of fakes in `src/test-support`: a fake document, a stub `AudioContext` and in-memory storage.
- `vi.fn` is used only for presentation ports such as sound and controls.
- Tests reuse sibling fixtures before adding new ones.

## Determinism

- Time advances only through explicit frames. Randomness comes only from an injected shuffle.
- No test depends on another. `vite.config.mjs` shuffles order and restores mocks and globals.

## Invariants

Invariants are checked exhaustively over enumerated inputs, not with a few examples.

- One test covers one sweep. It loops over every input, collects its violations with plain comparisons and asserts once on the list. Each violation names its input.
- `test.each` splits only by a small fixed dimension, such as the authored level or the gate state. It never generates a test per tile, per pixel or per step sequence, because per-test overhead then dominates the run time.

- Every [level design hard constraint](level-design.md#hard-constraints) added gets a deterministic test over every authored level.
- In every authored level, every tile that touches a fenced enclosure from outside, corners included, is open ground with no stone or woodland.
- In every authored level, the hero starts on each walkable tile of the playable area and moves in each of the eight directions. She never ends inside an obstacle or outside the level. The door stays closed until every key is collected.
- In every authored level, every open tile is reachable from the start, with the gate and any boulder counted as passable.
- In every authored level, no key or star spot lies on the start or the eight tiles around it.
- In every authored level with a swing gate, the sweep runs three times: with the gate closed from every tile on each side, where she never enters a tile on the other side, and with the gate open from every tile.
- A swing gate moves from closed through opening to open, and from open through closing to closed. A swing in progress can reverse. Any other request changes nothing and emits no event. It blocks its whole tile through the last of its sixteen opening frames and lets the hero through on the next frame.
- The magical arrival advances only through explicit frames. Through its last frame the hero does not move, collect anything or complete the level, and its frames add no play time. A held direction moves her on the first playable frame.
- Every short sequence of reaching and completing levels keeps unlocked levels unlocked and sets the last playthrough of each completed level. Every resulting progress state survives a save and load.

## Rendering

- Whole pictures are compared with `pixelDifference` from `src/test-support/pictures.ts`, never with `toEqual`, which is too slow on pixel arrays.
- A check over every pixel of a frame compares plainly, records the first invalid pixel of each frame and asserts once on the list, as invariants do.
- A small set of whole-frame hashes are the approved baselines. Changing one requires looking at the new image.
- Rules such as palette colors, faded contrast, restoration boundaries and door passability have their own pixel assertions, so accepting a new baseline cannot hide a broken rule.
- On a hash mismatch, the actual frame is written as a Portable Network Graphics (PNG) image to the ignored `test-output` folder and named in the failure message.

## When Tests Are Written

- Bug fix: a regression test that fails for the reported reason comes before the fix.
- Timing rules: one frame before, at and after each boundary.

## What Is Not Tested

- Private state, call order and the arguments passed to a callback.
- A test file per source file when a public entry point already covers the behavior.
- Test helpers, except `pixelDifference`, which decides every picture comparison.
- `equals` methods and other code that only tests call.
