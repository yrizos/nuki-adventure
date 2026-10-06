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
- `make typecheck`, `make lint`, `make markdown`, and `make audit` run individual checks.
- `make fix` applies all available code and Markdown lint fixes. It attempts both fixers even if one fails and exits with a failure status if either fails.
- `make check` runs the combined checks without building.
- `make check-push` runs tests and the browser build.

## Check Failures

Fix check and hook failures; do not merely report them. Run configured auto-fix hooks or `make fix`, inspect changes, fix remaining issues manually, and rerun until checks pass. Preserve unrelated work; report a blocker only after exhausting fixes within scope.

## Markdown

Follow the rules configured in [.markdownlint.json](.markdownlint.json) when editing Markdown and run `make markdown` afterward. The pre-commit hook rejects commits with Markdown lint violations.

## User Interface

Read [docs/ui-layout.md](docs/ui-layout.md), which defines layout, sizing, orientation, styling, and controls, before implementing, reviewing, or testing those behaviors.

Use [docs/palette.md](docs/palette.md) as the color source of truth when implementing, reviewing, or testing game art, interface colors, or contrast.

Read [docs/visual-style.md](docs/visual-style.md) before implementing, reviewing, or testing game art, rendering, or animation.

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
2. Run `pre-commit run --all-files` before invoking `git commit`. Never use `git commit` as the first run of the pre-commit checks.
3. Inspect auto-fixes, fix remaining failures, stage only intended paths, and rerun `pre-commit run --all-files` until all hooks pass. File modifications by a hook require another run, not a failure report. Never bypass hooks or commit with failures.
4. Create the commit with a cryptographic signature. Never create an unsigned commit. If signing fails, stop and report the error.
5. Verify that the commit was created and is cryptographically signed.

## Commit Messages

### Format

- Use Conventional Commits: `<type>: <subject>`. Omit `<scope>` when unnecessary.
- Derive the message from the staged diff, not from the task description or conversation.

### Type

Choose the type based on the primary effect of the change.

- `feat`: adds new user-visible or externally observable behavior.
- `fix`: corrects incorrect behavior.
- `refactor`: changes code structure without intentionally changing behavior.
- `perf`: improves performance without changing intended behavior.
- `test`: adds or changes tests without changing production behavior.
- `docs`: changes documentation only.
- `build`: changes build tooling, dependencies, packaging, or build configuration.
- `ci`: changes CI/CD configuration or automation.
- `chore`: maintenance work that does not fit the categories above.
- `revert`: reverts an earlier commit.

When a change could fit more than one type, choose the one that best describes why the change exists, not every file it touches. Never use `chore` as a fallback when a more specific type applies.

### Subject

- Write in imperative mood, lowercase, without a trailing period.
- Keep it concise and specific, preferably 72 characters or fewer.

### Body and Footers

- Add a body when the reason for the change is not obvious from the subject.
- Use the body to explain why the change was necessary, what problem or constraint motivated it, and any important consequences.
- Do not narrate the diff or list implementation details that are already obvious from the code.
- Mark breaking changes with `!` and add a `BREAKING CHANGE:` footer describing the impact.
- Reference issues or pull requests in footers when applicable.

### Accuracy

- Never claim that tests passed, behavior changed, or work was completed unless it was actually verified.

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
