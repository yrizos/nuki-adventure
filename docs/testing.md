# Testing

Unit tests must catch every behavior regression on a local machine within seconds, using Vitest and Node.js built-ins only.

## What Each Layer Tests

- Domain: business rules and invariants. Aggregates are tested through their public API (`Level.tick()`, `Level.read()`, `GameProgress`). Value objects are tested for their own validation, equality and behavior.
- Application: orchestration only. Services run against in-memory repositories and real aggregates.
- Infrastructure: adapters at their boundary. Storage round trips, malformed and unavailable storage, layout parsing and the content of every authored level.
- Presentation: session flow with explicit frame advancement, rendering through pixels, and controls and screens through a fake document.

## Test Doubles

- Domain objects are always real. They are never mocked.
- Browser APIs are replaced by one shared set of fakes in `src/test-support`: a fake document, a stub `AudioContext` and in-memory storage.
- `vi.fn` is used only for presentation ports such as sound, controls and level end.
- Tests reuse sibling fixtures before adding new ones.

## Determinism

- Time advances only through explicit frames. Randomness comes only from an injected shuffle.
- Tests run in shuffled order, and mocks and stubbed globals are restored after each test, so no test may depend on another.

## Invariants

Invariants are checked exhaustively over enumerated inputs with `test.each`, not with a few examples.

- In every authored level, the hero starts on each walkable tile of the playable area and moves in each of the eight directions. She never ends inside an obstacle or outside the level. The door stays closed until every orb is collected.
- Every short sequence of reaching and completing levels keeps unlocked levels unlocked and never worsens a best playthrough. Every resulting progress state survives a save and load.

## Rendering

- A small set of whole-frame hashes are the approved baselines. Changing one requires looking at the new image.
- Rules such as palette colors, faded contrast, restoration boundaries and door passability have their own pixel assertions, so accepting a new baseline cannot hide a broken rule.
- On a hash mismatch, the actual frame is written as a Portable Network Graphics (PNG) image to the ignored `test-output` folder and named in the failure message.

## When Tests Are Written

- Bug fix: a regression test that fails for the reported reason comes before the fix.
- New or changed behavior: tests land with the change.
- Refactoring: the existing behavior tests pass unchanged before and after.
- Timing rules: one frame before, at and after each boundary.

## What Is Not Tested

- Private state and call order.
- A test file per source file, when a public entry point already covers the behavior.
- Coverage percentages, or tests added only to raise a count.
