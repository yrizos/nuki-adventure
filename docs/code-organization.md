# Code Organization

This file is the single source for where code goes and what it may import. `make lint` enforces it through [.oxlintrc.json](../.oxlintrc.json) and [scripts/check-layout.mjs](../scripts/check-layout.mjs).

## Top Level

| Path | What it is |
| --- | --- |
| `src/level/` | Bounded context. Everything inside one level, including the authored levels. |
| `src/progress/` | Bounded context. What the game remembers between visits. |
| `src/user-interface/` | The browser client. It uses both contexts and belongs to neither. |
| `src/main.ts` | The composition root. It wires adapters into the contexts and starts the user interface. |
| `assets/sprites/` | Sprite data and previews. It is art, not application code, so it lives outside `src/`. |

The [domain model](domain-model.md#context-map) describes how the two contexts relate.

## Folders

| Folder | Holds | Never holds |
| --- | --- | --- |
| `src/level/domain/` | Rules of a level: aggregates, entities, value objects, events, repository and port interfaces. | Browser APIs, libraries other than zod, randomness, rendering. |
| `src/level/application/` | Use cases that load a level, call it and return a read-only view. | Rules, adapters, browser APIs. |
| `src/level/infrastructure/` | Adapters that implement level ports (collision library, shuffle, repository). | Rules, authored levels. |
| `src/level/content/` | Authored levels, the layout parser and the catalog. | Rules the `Level` aggregate should enforce, adapters. |
| `src/level/testing/` | Test helpers that build or walk levels. | Production code. |
| `src/progress/domain/` | Rules of saved progress: aggregate, value objects, repository interface. | Browser APIs, storage formats. |
| `src/progress/application/` | Use cases that load progress, change it and save it. | Rules, storage details. |
| `src/progress/infrastructure/` | Storage adapters and the stored format. | Rules. |
| `src/progress/testing/` | Test helpers for progress and storage fakes. | Production code. |
| `src/user-interface/<area>/` | Drawing, screens, input, audio and the game loop. One subfolder per area: `shell`, `navigation`, `session`, `page`, `screens`, `world`, `input`, `audio`, `graphics`. | Game rules, value object construction for a context, imports of context internals. |
| `src/user-interface/testing/` | Browser fakes and picture helpers for user interface tests. | Production code. |
| `src/main.ts` | Wiring of adapters into contexts and the call that starts the user interface. | Anything else. |
| `assets/sprites/<name>/` | One sprite's `data.js` and `preview.html`. | Code that the game logic depends on. |

### User Interface Areas

| Area | Holds |
| --- | --- |
| `shell` | The composition of the game: `startGame`, the game loop and the game view. |
| `navigation` | Which screen is open, the moves between screens and what each move shows, hides and plays. |
| `session` | Running one level: its phases, the messages, the action button prompts and their wobble. |
| `page` | The browser page around the game: DOM lookup, the page switches, the viewport layout and page lifecycle. |
| `screens` | The intro, the menu screen, level picker, end screen, confirmation, message box and their menus. |
| `world` | Everything drawn for a level. One subfolder per concern: `painting` (the painter and the obstacle overlay), `dressing` (scenery and ambient life), `transition` (restoration and arrival) and `hero` (the hero's animation). Geometry shared by all of them sits beside the subfolders. |
| `input` | The joystick, the action buttons and holding to skip the intro. |
| `audio` | Music and sound effects. |
| `graphics` | Pixel grids, pictures, the palette, dithering, the font, panel art and the sprite library. |

## Where New Code Goes

Answer these in order. Stop at the first yes.

1. Is it a rule about what can happen inside a level? Put it in `src/level/domain/`.
2. Is it a rule about what the game remembers between visits? Put it in `src/progress/domain/`.
3. Is it a use case the user interface calls? Put it in the `application/` folder of the context whose aggregate it changes. One use case changes one aggregate.
4. Does it talk to a library or browser API on behalf of a context? Put it in that context's `infrastructure/` and define the port it implements in that context's `domain/`.
5. Is it a new authored level? Add a file to `src/level/content/` and an entry to `catalog.ts`.
6. Is it drawing, sound, input or a screen? Put it in the matching `src/user-interface/` subfolder. Create a new subfolder only for an area that fits none of the six.
7. Is it sprite art? Add `assets/sprites/<name>/`.
8. Is it only used by tests? Put it in the `testing/` folder of the area it fakes or builds.

## A New Bounded Context

Add a top-level folder under `src/` only when the code has its own glossary terms, its own aggregate with its own invariants and its own reasons to change. Give it the same `index.ts`, `domain/`, `application/`, `infrastructure/` and `testing/` structure. Add it to the [context map](domain-model.md#context-map), to the lint rules and to the layout check in the same change.

## Dependencies

- `progress` depends on `level`. `level` never depends on `progress`.
- Outside code reaches a context only through its `index.ts`.
- Inside a context, `domain` depends on nothing else in the context. `application`, `infrastructure` and `content` depend on `domain`.
- Only `src/main.ts` imports `infrastructure`.
- Only tests import `testing`.
- Tests may import any internal file of any context to build fixtures.

## Public Entries

- `src/level/index.ts` exports the `PlayLevel` use case, `LevelView`, the level events, the catalog of authored levels, `LevelId`, `StarCount` and the read-only value objects the user interface draws.
- `src/progress/index.ts` exports the `ManageProgress` use case and the types of its views.
- A new export goes into an entry only when code outside the context needs it. Classes that outside code must not construct are exported as types.

## Shared Code

There is no shared kernel. A type used by both contexts belongs to the context that owns its meaning, and the other context imports it through `index.ts`. Never create a shared or utilities folder.

## Naming

- File names are kebab case and name the concept they hold, using [glossary](glossary.md) terms.
- A file never repeats its folder's name (`content/first.ts`, not `content/first-level.ts`).
- Tests sit beside the file they test and share its name with `.test.ts`.
