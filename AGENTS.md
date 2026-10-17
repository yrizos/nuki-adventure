# Agent Instructions

Scope: every task. Docs linked below override this file on their own subject.

## Development Commands

- Use [Makefile](Makefile) targets only, never npm scripts directly.
- While editing: `make test-file FILE=<path>` on affected tests.
- After all edits: `make check` once.
- Markdown edits: `make markdown`.
- `make test` (full unit suite) runs only when the user requests it or before a push.
- Level picker card maps: `make level-map LEVEL=<level id|all>` writes PNGs to `test-output/level-maps/`.

## Check Failures

- On failure: run `make fix`, inspect its edits, fix the rest and rerun the failed check. Preserve unrelated work. Report a blocker only after in-scope fixes run out.
- Never repeat a successful check on unchanged inputs. The primary agent runs final validation.
- Bug fixes follow [When Tests Are Written](docs/testing.md#when-tests-are-written).

## Dependencies

[.npmrc](.npmrc) enforces release age, exact versions and install-script approval. Add a dependency only if:

- It is a stable release at least 30 days old, and the project is neither deprecated nor archived.
- It comes from the npm registry, never Git or a URL.
- The user approved any install scripts.

Security fixes may use younger releases with `--min-release-age=0`. Explain why in the commit body.

## Context Loading

- Locate symbols and headings before bounded reads. Never dump directories or large files to discover structure.
- Read complete applicable sections, including all applicable hard constraints.
- Keep large command output out of context. Show actionable output or success status, and keep failure evidence.

### Sprite Inspection

- `make sprite-inspect MODE=<list|summary|frames|frame|animations|animation|palette> SPRITE=<name>`. Selectors: `FRAME`, `ANIMATION`, literal `FILTER`, `LIMIT` (default 20, maximum 50), `OFFSET` (default 0), `FADED=1` for faded frames.
- Never read complete sprite data files for what the tool supports. Read raw source ranges only to edit exact declarations.

### Test Discovery

1. Identify the production module and its directly related test files.
2. Search declarations within those files, such as `rg -n '(test|it|describe)(\.[[:alpha:]]+)?\(' src/user-interface/world/world-painter.test.ts`.
3. Read complete relevant test bodies and the complete definitions of fixtures they use. Reuse existing test support before creating fixtures.
4. Read other tests only to establish coverage or conventions. Stop once the relevant test and fixtures suffice.

### Documentation Routing

| Concern | Load |
| --- | --- |
| Where new code goes, folders, dependencies between them | [Code organization](docs/code-organization.md) |
| Domain or application models, aggregate invariants, the context map | [Domain model](docs/domain-model.md) |
| New or changed domain terminology | Relevant [glossary](docs/glossary.md) entries |
| Tests | [Testing](docs/testing.md) |
| Levels | All [Hard Constraints](docs/level-design.md#hard-constraints), applicable guidance |
| Sprites | Applicable [visual style](docs/visual-style.md) and [palette](docs/palette.md) sections |
| Rendering | Applicable [visual style](docs/visual-style.md) sections |
| User interface layout | Applicable [layout](docs/ui-layout.md) sections |
| Colors or contrast | [Palette](docs/palette.md). Hex values live in `assets/sprites/palette.js` |
| Commit preparation, only when explicitly instructed | [Commit messages](docs/commit-messages.md), before writing the message |
| Markdown edits, substantial prose, commit bodies, pull request descriptions | [Writing](docs/writing.md) |

## Delegation

Do the work yourself unless a row below matches. Documentation is always primary work. `Own:` limits delegated agents, not the primary agent.

| Agent | Delegate when |
| --- | --- |
| `level-designer` | New complete level, redesign, substantial route, difficulty or object-placement changes |
| `sprite-artist` | New sprite, several animation frames, substantial pixel-art design |
| `renderer` | Multi-module rendering pipeline, substantial camera or viewport work, coordinated rendering and animation |
| `reviewer` | [Review Policy](#review-policy) requires it, or a specific unresolved risk warrants it |
| `test-writer` | Optional: requested test design, complex regressions, multiple behavioral boundaries |

- Editing agents may write directly related tests within their ownership.
- Run agents in parallel only with disjoint files and independent outputs.

### Review Policy

Independent review is required for explicit review requests and for task changes that:

- Change behavior in non-test production files under any `domain/` or `application/` folder of `src/level/` or `src/progress/`.
- Change stored representation, serialization, migration, compatibility or malformed-storage recovery in `src/progress/infrastructure/local-progress-repository.ts`. Review saved-progress compatibility.
- Change dependencies between contexts or layers, responsibility placement, a context's `index.ts`, composition-root responsibilities or infrastructure injection.
- Change shared contracts: exported interfaces, public cross-module signatures, domain events, persistence schemas, value objects or application ports.
- Coordinate behavior changes across layers.
- Change lint, type, build, hook or npm configuration.

Not triggers on their own: formatting, comments, docs, tests, local user interface fixes, sprite edits, existing-level corrections, single-layer refactors and new levels on existing mechanics. Judge the task's actual changes, never file names or size. The primary agent never replaces mandatory review with its own assessment and addresses every finding.

### Handoffs

- Pass the task, paths and symbols, expected outcome and task-specific constraints. Link requirements instead of copying them. Link the applicable document sections, never whole documents.
- Before the first review, record `git stash create` output as the snapshot hash. If it prints nothing, the tree is clean and `HEAD` is the snapshot. Re-reviews after fixes pass that hash, the earlier findings and any new untracked paths, so the reviewer reads only the delta. Request a full review again only when the fix rewrote most of the reviewed change.
- Return changed paths, unresolved integration work, blockers and regression evidence when needed. Reviewers return findings only.

## Git

- Before edits: inspect `git status --short` and relevant diffs. Never discard, overwrite, revert or include unrelated work.
- Branches, commits, tags, rebases, merges and pushes need explicit instruction. Destructive commands, amendments, history rewrites and force-pushes need explicit approval.
- Never commit secrets, machine-local configuration or generated artifacts.

## Code Comments

- A comment states a reason the code cannot show: a constraint, a tradeoff, an external API quirk or why a constant has its value.
- Never narrate behavior, restate a name, signature, expression or return value, or label architecture without a reason.
- Never copy values that code holds. Name the constant instead.
- State a rationale once, at the code that owns the decision. Tests do not repeat production rationale.
- Add a reason comment where a magic number or workaround would make a reader ask why.
- When editing code, update or remove comments the edit made stale.
- A new file, type or export gets no comment that says what it is. Its name and its folder say that.
- A rule that a doc states or a lint rule enforces gets no comment repeating it. A design decision made in the current task is not a reason for a comment either.

## Writing

- Chat replies: US English, no idioms, em dashes, horizontal rules, hashtags, invented facts, filler or repetition. Match length to the required information.

## Architecture

- [Code organization](docs/code-organization.md) decides where every file goes and what it may import. Read it before adding a file or a folder.
- `make lint` enforces it through [.oxlintrc.json](.oxlintrc.json) and [scripts/check-layout.mjs](scripts/check-layout.mjs).
