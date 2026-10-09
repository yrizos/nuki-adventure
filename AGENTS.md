# Agent Instructions

These instructions apply to every task in this repository.

When a section defines specific rules for an artifact, such as commit messages or code comments, those rules take precedence over the general writing rules.

## Development Commands

Use the [Makefile](Makefile) targets for project commands instead of invoking their npm scripts directly. Read the Makefile for current commands and prerequisites, and run only targets needed for the requested task.

- `make install` checks project dependencies and installs the configured Git hooks.
- `make hooks` installs Git hooks without checking or installing npm dependencies.
- `make dev` starts the development server.
- `make build` typechecks and builds the browser application.
- `make test` runs unit tests, and `make test-watch` runs them in watch mode.
- `make typecheck`, `make lint`, `make format`, `make markdown`, and `make audit` run individual checks.
- `make fix` applies all available code and Markdown lint fixes. It attempts both fixers even if one fails and exits with a failure status if either fails.
- `make check` runs the combined checks without building.
- `make check-push` runs tests and the browser build.

## Check Failures

Fix check and hook failures; do not merely report them. Run configured auto-fix hooks or `make fix`, inspect changes, fix remaining issues manually, and rerun until checks pass. Preserve unrelated work; report a blocker only after exhausting fixes within scope.

## Dependencies

[.npmrc](.npmrc) blocks releases younger than 3 days and install scripts not approved in `allowScripts`. Add a new dependency only when all of these hold:

- It is a stable release at least 30 days old, and the project is not deprecated or archived.
- It comes from the npm registry, not from Git, a URL or a local path.
- Its version is exact.
- The user has approved its install scripts, if it has any.

A security fix may use a younger release with `--min-release-age=0`, and its commit body must say why.

## Markdown

Follow the rules configured in [.markdownlint.json](.markdownlint.json) when editing Markdown and run `make markdown` afterward. The pre-commit hook rejects commits with Markdown lint violations.

## User Interface

Read [docs/ui-layout.md](docs/ui-layout.md), which defines layout, sizing, orientation, styling, and controls, before implementing, reviewing, or testing those behaviors.

Use [docs/palette.md](docs/palette.md) as the color source of truth when implementing, reviewing, or testing game art, interface colors, or contrast.

Read [docs/visual-style.md](docs/visual-style.md) before implementing, reviewing, or testing game art, rendering, or animation.

## Level Design

Read [docs/level-design.md](docs/level-design.md) before designing, reviewing, or testing levels.

## Testing

Read [docs/testing.md](docs/testing.md) before writing, reviewing, or changing tests.

## Delegation

Delegate when the requested work edits paths owned by an editing agent in [.claude/agents](.claude/agents). Each editing agent lists its owned paths in its `Own:` line.

- Send every request to review changes to `reviewer`. The primary agent never reviews work itself.
- Start every bug fix with `test-writer`, whatever the size of the fix. It writes a failing regression test, then the primary agent or owning specialist fixes the code.
- After adding or changing behavior, send coverage to `test-writer`.
- Only `test-writer` adds tests. Another agent edits an existing test only when its own change breaks that test.
- Keep any other work in the primary agent when it changes under 20 lines in a single file.
- After a substantial change, run `reviewer` last and address its findings. A change is substantial when it touches 3 or more files, or any non-test file under `src/domain` or `src/application`.
- Split work spanning several specialists by owned path and run independent parts in parallel.
- Pass a specialist the task, the intended behavior and facts already established. Do not repeat its rules, because its agent file holds them.
- Specialists return to the primary agent, which integrates the results and reports.

## Git

### Before Changing Files

- Inspect `git status --short` and the relevant staged and unstaged diffs.
- Preserve existing user changes. Never discard, overwrite, revert, or include unrelated work.

### Actions That Require Explicit Instruction

- Do not create branches, commits, tags, rebases, merges, or pushes unless explicitly requested.
- Never run destructive commands such as `git reset --hard`, `git clean -fd`, or `git checkout --` without explicit approval.
- Never amend commits, rewrite history, or force-push without explicit approval.

### Staging

- Stage explicit paths only. Never use `git add .` or `git add -A`.
- Do not commit secrets, credentials, machine-local configuration, logs, dependencies, or generated artifacts unless the repository explicitly tracks them.
- Keep each commit atomic and limited to one logical change. If the staged diff contains multiple concerns, split it before committing.

### Commit Procedure

Follow these steps in order for every commit.

1. Run `git diff --cached` and verify that every staged change belongs to the intended commit.
2. Invoke `git commit` with a cryptographic signature and let the installed Git hooks run the checks. Do not run `pre-commit run --all-files` separately before committing.
3. If a hook fails or modifies files, inspect auto-fixes, fix remaining failures, stage only intended paths, recheck `git diff --cached`, and retry the signed commit. Never bypass hooks or commit with failures.
4. Never create an unsigned commit. If signing fails, stop and report the error.
5. Verify that the commit was created and is cryptographically signed.

## Commit Messages

Use Conventional Commits in the form `<type>: <subject>`, followed by an optional body. Write the message from the full output of `git diff --cached`, never from the conversation, a single file or a filtered summary.

### Type

The type names why the change exists across the whole diff. Documentation and tests that ship with a code change never decide it.

- `feat`: adds user-visible behavior.
- `fix`: corrects incorrect behavior.
- `refactor`: restructures code without changing behavior.
- `perf`: makes code faster without changing behavior.
- `test`: changes tests, test support or test configuration only.
- `docs`: changes documentation only, including this file and agent files.
- `build`: changes dependencies, the Makefile, Git hooks, or compiler, bundler, linter or formatter configuration.
- `ci`: changes `.github/workflows` only.
- `chore`: changes nothing above, such as the license or Git attributes.
- `revert`: reverts an earlier commit.

### Subject and Body

- Write the subject in imperative mood and lowercase, without a trailing period, in 72 characters or fewer.
- Name the change itself in the subject. Do not list files, contents or sections.
- Add a body when the reason is not obvious from the subject. It explains the problem that made the change necessary, never the diff.
- Mark a breaking change with `!` and a `BREAKING CHANGE:` footer.
- Never claim that tests passed or that behavior changed unless you verified it.

### Good Examples

- `bbd8a53 feat: pick five of fifteen star spots each time a level starts` touches the glossary, the level design guide, the domain, three level layouts and their tests. The new gameplay rule decides the type.
- `683a269 build: run check hooks only when their inputs change` changes only `.pre-commit-config.yaml`. Git hooks are build tooling.
- `f875632 ci: filter deployments by app and build input changes` changes only `.github/workflows`.
- `1d5b694 test: raise the per-test timeout for slow whole-level tests` changes `vite.config.mjs`, but only for the tests. Its body gives the problem: "Whole-level and pixel tests take several seconds each and exceeded the 5 second default when the machine was busy, so the pre-commit hook failed on different tests each run."
- `5a3b198 fix: rebuild joystick on window resize` names the corrected behavior.
- `13a8e2c perf: use packed pixel writes for rendering` names the speedup without listing changed files.

### Bad Examples

- `70737b8 docs: add Star Spot to glossary` was written from the first file in a diff that changed level rules across 15 files. It was amended to `bbd8a53`.
- `76c8c47 chore: add pre-commit configuration with various hooks for linting, testing, and security checks` uses `chore` for Git hooks, which are `build`, and lists contents.
- `6fc894c chore: update .editorconfig for Makefile and add Makefile for build automation` uses `chore` for the Makefile and joins two changes.
- `52f3150 fix: delay door access and correct flower rendering` joins two unrelated fixes that belong in separate commits.
- `e034513 docs: enhance UI layout and visual style documentation with control panel scaling, measurements, and updated element sizes` runs past 72 characters, uses the vague verb "enhance" and lists contents.
- The body of `8b4cad1` narrates the diff in past tense, starting with "Added package.json with scripts and dependencies".

## Code Comments

- Comments must explain why the code is written as it is, never what the code does.
- Do not write comments that describe behavior, repeat names or signatures, or label code and architectural roles without giving a reason.
- When you encounter a comment that only explains what the code does, remove it immediately. Keep only comments that explain the reason for an implementation choice.

## Writing

These rules apply to all prose you produce, including documentation, commit message bodies, pull request descriptions, and messages.

### Style

- Use US English spelling, but avoid US idioms and colloquialisms.
- Never use em dashes. Rewrite the sentence so it does not need one instead of substituting commas, parentheses, or periods.
- Keep one register throughout a passage. Do not open with a sentence fragment and then switch to full sentences.
- Expand acronyms and jargon on first use.

### Density

- Be concise without being terse. Cut filler, hedges, throat-clearing, and restatements of a point already made.
- Keep the transitions and connective words that make prose flow. Do not compensate for brevity with short, choppy declarative sentences.
- Cut empty intensifiers that add no information.
- Do not re-name a subject that is already clear from the previous sentence.
- Prefer the stronger, more committed word when it sharpens a point.

### Structure

- Keep paragraphs to two or three sentences, and vary their length naturally.
- Give each paragraph one job, two at most.
- Use lists for content that is genuinely list-shaped, such as parallel items, discrete steps, or enumerable concerns. Use prose for reasoning that flows.
- Separate sections with real Markdown headings. Never use bold text as a pseudo-heading or bullet lists as section dividers.
- Do not use bold text for emphasis.
- Do not use horizontal rules or hashtags.

### Content

- Never invent facts, figures, or details that were not provided or verified.
- State issues plainly and stop. Do not editorialize, add soft closers, or pad with persuasion.
- When editing someone else's text, preserve their word choices and voice, and fix only what is actually broken.
- When asked to remove text, remove it without replacing it with filler.
- Structure pull request descriptions around what changed, why, how it was tested, and any known risks.

## Architecture

### Source Layout

Organize `src` by DDD layer, not by feature.

- `src/domain`: the domain layer, organized by bounded context, with the shared kernel in `src/domain/shared`.
- `src/application`: the application layer.
- `src/infrastructure`: the infrastructure layer.
- `src/presentation`: the presentation layer.

### Layer Dependencies

- Every other layer may depend on the domain layer.
- The domain layer must never depend on another layer.
- The application layer depends only on the application and domain layers.
- The infrastructure layer depends only on the infrastructure and domain layers.
- The presentation layer depends on the presentation, application and domain layers, never on infrastructure.
- Domain and application code never use `window`, `document`, `localStorage`, `performance`, `requestAnimationFrame` or `Math.random`.
- Tests are exempt, so they can build fixtures from any layer.
- [.oxlintrc.json](.oxlintrc.json) enforces these rules, so `make lint` fails on a violation.
- `src/index.ts` is the composition root. It chooses the infrastructure implementations and passes them to the presentation layer, and it is the only module that may depend on every layer.

### Domain Model

- Model the domain with aggregate roots, entities, and value objects.
- Use DDD terminology when describing the design.
- Use domain value objects only. Never use primitives in the domain.
- Always favor immutable value objects over native types. Never take the quickest way.

### Naming and Ubiquitous Language

- Use [the glossary](docs/glossary.md) for domain names and meanings in code and documentation. Update it before introducing or changing domain terminology only, not technical or implementation terminology.
- Name code after the language of the domain, not after technical concepts.
- Names must describe the concept in a completely unambiguous way.
- Do not use jargon in names.
- Use one term per concept within a bounded context.
- When the domain language changes, rename the code to match.

### Bounded Contexts

- Give each bounded context an explicit boundary.
- A term means exactly one thing inside its bounded context.
- Share code between bounded contexts only through the shared kernel.

### Aggregates

- The aggregate root is the only entry point to an aggregate. Code outside the aggregate never holds references to its inner entities.
- Enforce every aggregate invariant inside the aggregate.
- Keep aggregates small, including only what must stay consistent together.
- Reference other aggregates by identity only.
- Change only one aggregate per application service operation.
- `Level` creates and owns its `Hero` from the starting position and facing it is given. Code outside the aggregate reads the hero through the immutable `HeroState` and moves it only through `Level.tick()` and `Level.read()`.

### Entities

- An entity is defined by its identity, not by its attributes.
- Compare entities by identity.

### Value Objects

- A value object is defined by its attributes and has no identity.
- All value objects must be immutable. Replace a value object instead of modifying it.
- Validate value objects at creation, so an invalid value object can never exist.
- Compare value objects by value.
- Keep value object behavior free of side effects.

### Domain Behavior

- Put business rules in aggregates, entities, and value objects. Avoid an anemic domain model.
- Use a domain service only for an operation that does not belong to any entity or value object, and keep domain services stateless.
- Use a factory when creating an aggregate is complex enough to obscure its constructor.
- Name domain events in the past tense, after something that happened in the domain.

### Application Layer

- Application services orchestrate: they load aggregates, call them, and save them. They contain no business rules.

### Repositories

- Provide one repository per aggregate root.
- Define the repository interface in the domain layer and implement it in the infrastructure layer.
- Repositories load and save whole aggregates.

### Integration

- Protect the domain model from external models with an anti-corruption layer.
