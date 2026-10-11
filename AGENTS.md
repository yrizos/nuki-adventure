# Agent Instructions

Scope: every task. Precedence: artifact-specific rules override general writing rules.

## Development Commands

- Commands: [Makefile](Makefile) targets only, never npm scripts directly.
- While editing: run affected checks only, `make test-file FILE=<path>`.
- After all edits: run `make check` once.
- Markdown edits: follow [.markdownlint.json](.markdownlint.json), then run `make markdown`.
- `make test` (full unit suite) and `make check-push` (unit tests and browser build) run only when the user requests them or before a push.

## Check Failures

- Fix failures, including hooks: run configured auto-fixes or `make fix`, inspect edits, fix remaining issues, rerun. Preserve unrelated work. Report a blocker only after exhausting in-scope fixes.
- During implementation, run affected checks only. The primary agent runs final validation.
- Do not run the full suite for a handoff or repeat successful checks on unchanged inputs. After further edits, rerun affected checks.
- Bug fixes: write regression test, verify failure for the reported defect, fix, verify pass. The implementing agent may author the test.

## Dependencies

[.npmrc](.npmrc) blocks releases younger than 3 days and unapproved install scripts. Add dependencies only if all hold:

- Stable release, at least 30 days old; project neither deprecated nor archived.
- npm registry source, never Git, URL or local path; exact version.
- User approval for any install scripts.

Security fixes may use younger releases with `--min-release-age=0`; explain why in the commit body.

## Context Loading

- Start with task and affected paths. Locate symbols/headings before bounded reads; follow actual dependencies. Never dump directories or large files to discover structure.
- Read complete applicable sections, all applicable hard constraints and necessary references. Partial reads do not establish irrelevance to other task concerns.
- Skip unrelated material and unchanged context already loaded. Use Markdown links, not eager imports or duplicate rule copies.
- Use known paths directly. Restrict searches to known layers; do not repeat successful searches or delegate direct lookups.
- Capture large command output outside context; show actionable output or success status. Retain failure evidence. Never rerun solely to shorten output.

- Sprite inspection: use `make sprite-inspect MODE=<mode> SPRITE=<name>` for discovery, metadata, frame names, animations and palette usage. Modes: `list`, `summary`, `frames`, `frame`, `animations`, `animation`, `palette`. Select with `FRAME`, `ANIMATION`, literal `FILTER`, `LIMIT` (default 20, maximum 50), `OFFSET` (default 0), `FADED=1` for explicit faded frames.
- Never read complete sprite data files for supported inspection operations. Read only necessary raw source ranges when editing exact declarations or investigating implementation details. Preserve code-authored sprites, never substitute generated pixel art or image assets.

### Test Discovery

1. Identify the behavior/production module and directly related test files.
2. Search declarations and behavior terms within those files. Example: `rg -n '(test|it|describe)(\.[[:alpha:]]+)?\(' src/presentation/world-painter.test.ts`. Use equivalent search if `rg` is unavailable.
3. Read complete relevant test bodies. Locate referenced fixtures/helpers by symbol and read their complete required definitions. Inspect applicable existing test support before creating fixtures.
4. Inspect other tests only to establish needed coverage or reuse conventions. Stop once the relevant test and fixture suffice. Do not read complete large files for discovery, all sibling tests or all test support. Do not recreate helpers or duplicate covered behavior. Follow [Testing](docs/testing.md).

### Documentation Routing

Apply this routing to implementation, testing and review:

| Concern | Load |
| --- | --- |
| Domain/application models or aggregate invariants | [Domain model](docs/domain-model.md) |
| New or changed domain terminology | Relevant [glossary](docs/glossary.md) entries |
| Tests | [Testing](docs/testing.md) |
| Levels | Complete [Hard Constraints](docs/level-design.md#hard-constraints), applicable design guidance |
| Sprites | Applicable [visual style](docs/visual-style.md) and [palette](docs/palette.md) sections |
| Rendering | Applicable [visual style](docs/visual-style.md) sections |
| User interface layout | Applicable [layout](docs/ui-layout.md) sections |
| Colors or contrast | Applicable [palette](docs/palette.md) sections; authoritative color source |
| Explicitly authorized commit preparation only | [Commit messages](docs/commit-messages.md), before preparing the message |
| Every Markdown edit, substantial prose, commit bodies, pull request descriptions | [Writing](docs/writing.md) |

## Delegation

- Primary implementation: cohesive module plus related tests; defined behavior; no new domain concept or architecture boundary changes; no specialist design; no useful independent exploration.
- Documentation: primary.
- `Own:` restricts delegated specialists, not primary edits.

Use existing [.claude/agents](.claude/agents) definitions:

| Agent | Delegate when |
| --- | --- |
| `level-designer` | New complete level, redesign, substantial route/difficulty/object-placement changes |
| `sprite-artist` | New sprite, several animation frames, substantial pixel-art design |
| `renderer` | Multi-module rendering pipeline, substantial camera/viewport work, coordinated rendering and animation |
| `reviewer` | [Review Policy](#review-policy) requires review, or a specific unresolved risk warrants it |
| `test-writer` | Optional: requested test design, complex regression, multiple behavioral boundaries, substantial independent test investigation |

- Production edits alone do not trigger `test-writer`. Editing agents may author directly related tests within ownership. `test-writer` edits tests/support only; `reviewer` is read-only.
- Use the shortest sufficient delegation path. Parallel work requires disjoint files, independent outputs, separate responsibilities and no duplicated investigation. Exploration delegation requires genuinely large, independent work.

### Review Policy

- Require independent review for explicit code review requests and these task changes:
  - Behavioral changes to non-test production files under `src/domain/` or `src/application/`, including invariants, aggregates, orchestration and domain contracts.
  - Changes to stored representation, serialization/deserialization, migration, compatibility or recovery from malformed/unavailable storage in `src/infrastructure/local-progress-repository.ts`. Review existing saved-progress compatibility.
  - Changed layer dependencies, responsibility placement, cross-layer interfaces, composition-root responsibilities or infrastructure injection.
  - Changed shared production contracts: exported interfaces, public cross-module signatures, domain events, persistence schemas, value objects or application ports.
  - Coordinated behavior changes across layers that affect their interactions or contracts.
  - Enforcement or execution changes in `.oxlintrc.json`, `tsconfig.json`, `vite.config.mjs` or `.pre-commit-config.yaml`.
- Exclude pure formatting and comments from behavioral triggers. Assess actual task changes, not unrelated working-tree edits or a high-risk filename alone.
- File or line count never triggers review. Documentation, tests, local presentation fixes, sprite/preview edits, existing-level corrections and implementation-only refactorings within one layer do not independently require review.
- New levels using established mechanics plus registration in `src/index.ts` do not themselves change architecture or cross-layer behavior.
- Primary must not substitute its assessment for mandatory independent review. Address findings. Optional review must identify a specific unresolved risk.

### Handoffs

- Supply only task, relevant paths/symbols/line references, expected outcome, source-supported facts and additional task-specific constraints. Omit empty fields. No mandatory template.
- Pass locations and module responsibilities, not source dumps. Link necessary canonical requirements instead of copying root, specialist or domain instructions.
- Continue from established facts and locations. Investigate again only if insufficient, stale or contradicted. Follow-ups contain only new information and outstanding work. Reuse agent context when available without requiring it.
- Return changed paths, unresolved integration work, blockers and specific regression evidence when needed. Reviewers return findings only.
- Exclude conversation/reasoning history, searches, rejected hypotheses, full diffs/logs, repeated requirements, redundant summaries and repeated progress messages.

## Git

- Before edits: inspect `git status --short` and relevant staged/unstaged diffs. Never discard, overwrite, revert or include unrelated user work.
- Require explicit instruction for branches, commits, tags, rebases, merges or pushes. Require explicit approval for destructive commands, amendments, history rewrites or force-pushes.
- Never commit secrets, credentials, machine-local configuration, logs, dependencies or generated artifacts unless explicitly tracked by the repository.
- WHEN explicitly instructed to commit: load [Commit messages](docs/commit-messages.md) and follow its procedure.

## Code Comments

- Allowed: implementation reasons.
- Forbidden: behavior descriptions, repeated names/signatures, architectural labels without reasons.
- On encountering a what-only comment: remove it.

## Writing

- Chat replies: US English; no idioms or colloquialisms; no em dashes, horizontal rules, hashtags, invented facts, filler or repetition; match response length to required information.
- Every Markdown document created or edited, substantial prose, commit bodies and pull request descriptions: follow [Writing](docs/writing.md).

## Architecture

### Source Layout

- Organize `src` by domain-driven design (DDD) layer, never feature: `domain`, `application`, `infrastructure`, `presentation`.
- Domain subdivisions: bounded contexts. Shared kernel: `src/domain/shared`.

### Layer Dependencies

- Domain: domain only. Every other layer may depend on domain.
- Application: application and domain only.
- Infrastructure: infrastructure and domain only.
- Presentation: presentation, application and domain only; never infrastructure.
- Domain/application forbid `window`, `document`, `localStorage`, `performance`, `requestAnimationFrame`, `Math.random`.
- Tests may build fixtures from any layer. [.oxlintrc.json](.oxlintrc.json) enforces boundaries through `make lint`.
- Only `src/index.ts`, the composition root, may depend on every layer. It selects infrastructure implementations and passes them to presentation.
