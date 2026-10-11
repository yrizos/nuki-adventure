# Agent Instructions

Scope: every task. Precedence: artifact-specific rules override general writing rules.

## Development Commands

- Commands: [Makefile](Makefile) targets only, never npm scripts directly.
- Before execution: read target/prerequisites; select task-relevant checks.

- Focused tests: `make test-file FILE=<path>`. Full unit suite: `make test`.
- Combined checks: `make check`. Tests and browser build: `make check-push`.
- Markdown edits: follow [.markdownlint.json](.markdownlint.json), then run `make markdown`.

## Check Failures

- Fix failures, including hooks: run configured auto-fixes or `make fix`, inspect edits, fix remaining issues, rerun. Preserve unrelated work. Report a blocker only after exhausting in-scope fixes.
- During implementation, run affected checks only. The primary agent coordinates final project validation.
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
| Substantial prose, documentation, commit bodies, pull request descriptions | [Writing](docs/writing.md) |

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
| `reviewer` | Every explicit code review; every substantial completed change |
| `test-writer` | Optional: requested test design, complex regression, multiple behavioral boundaries, substantial independent test investigation |

- Substantial: three or more changed files, or any changed non-test file under `src/domain` or `src/application`. Independent review is required regardless of implementer; primary never substitutes its own review. Address findings.
- Production edits alone do not trigger `test-writer`. Editing agents may author directly related tests within ownership. `test-writer` edits tests/support only; `reviewer` is read-only.
- Use the shortest sufficient delegation path. Parallel work requires disjoint files, independent outputs, separate responsibilities and no duplicated investigation. Exploration delegation requires genuinely large, independent work.

### Handoffs

- Input only: task, paths/symbols/line references, intended outcome, task-specific constraints, established facts. No conversation history, repeated instructions, retrievable documentation, source dumps or irrelevant investigations.
- Start from supplied facts; investigate further only if insufficient or contradicted by source.
- Output only: changed paths, relevant changes, unresolved integration work, regression evidence when needed. Reviewer: findings only.
- No file contents, full diffs/logs, tool histories, repeated requirements, code explanations or duplicate summaries. No repeated inter-agent progress messages.

## Git

- Before edits: inspect `git status --short` and relevant staged/unstaged diffs. Never discard, overwrite, revert or include unrelated user work.
- Require explicit instruction for branches, commits, tags, rebases, merges or pushes. Require explicit approval for destructive commands, amendments, history rewrites or force-pushes.
- Stage explicit paths only; never `git add .` or `git add -A`. Keep each commit to one logical change; split multiple concerns.
- Never commit secrets, credentials, machine-local configuration, logs, dependencies or generated artifacts unless explicitly tracked by the repository.

When committing is explicitly authorized:

1. Read the commit-message guide through the routing table. Inspect the complete `git diff --cached`; verify every change belongs.
2. Run cryptographically signed `git commit` with installed hooks. Never separately run `pre-commit run --all-files` before committing.
3. On hook failure or edits: inspect auto-fixes, fix failures, stage intended paths, recheck the complete staged diff, retry signed commit. Never bypass hooks or commit failures.
4. On signing failure: stop and report. Never create an unsigned commit.
5. Verify creation and cryptographic signature.

## Code Comments

- Allowed: implementation reasons.
- Forbidden: behavior descriptions, repeated names/signatures, architectural labels without reasons.
- On encountering a what-only comment: remove it.

## Writing

- Use US English; no US idioms/colloquialisms.
- Forbid em dashes, horizontal rules, hashtags, invented facts, filler and repetition.
- Use Markdown headings; never bold/bullets as section dividers or bold for emphasis.
- Match response length to required information. Preserve wording unless a change is necessary.
- Load detailed prose rules through routing; skip for routine messages/handoffs.

### Markdown Artifacts

- Every Markdown file created/edited: optimize for agent execution, not human narrative.
- Express requirements as explicit conditions, constraints, ordered actions and stop/return rules. Use only structures the task needs.
- Remove duplicated instructions and explanatory filler. Preserve requirements, exceptions, evidence and required examples.
- Use directive lists instead of narrative paragraphs for agent instructions; prose paragraph rules do not require narrative wrappers.

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
