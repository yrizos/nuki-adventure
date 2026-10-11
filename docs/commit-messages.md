# Commit Messages

## Procedure

1. Read complete `git diff --cached`. Never derive messages from conversation, one file or filtered summaries.
2. Select type by the purpose of the whole change. Accompanying documentation/tests never override the code change's type.
3. Write `<type>: <subject>` and optional body using the rules below.

## Types

- `feat`: new user-visible behavior.
- `fix`: correct incorrect behavior.
- `refactor`: restructure without behavior changes.
- `perf`: improve speed without behavior changes.
- `test`: tests, test support or test configuration only.
- `docs`: documentation only, including agent instructions.
- `build`: dependencies, Makefile, Git hooks, compiler/bundler/linter/formatter configuration.
- `ci`: `.github/workflows` only.
- `chore`: none of the above; e.g. license or Git attributes.
- `revert`: revert an earlier commit.

## Message Constraints

- Subject: imperative, lowercase, ≤72 characters, no trailing period.
- Name the change; do not enumerate files, contents or sections.
- Body required when subject does not explain the reason. Explain the motivating problem, never narrate the diff.
- Breaking change: `!` after type plus `BREAKING CHANGE:` footer.
- Claim passing tests or changed behavior only after verification.

## Accepted Examples

- `bbd8a53 feat: pick five of fifteen star spots each time a level starts`: gameplay rule determines `feat` despite glossary, design guide, domain, three layouts and test changes.
- `683a269 build: run check hooks only when their inputs change`: `.pre-commit-config.yaml` only; Git hooks are build tooling.
- `f875632 ci: filter deployments by app and build input changes`: `.github/workflows` only.
- `1d5b694 test: raise the per-test timeout for slow whole-level tests`: `vite.config.mjs` affects tests only. Motivating-problem body: "Whole-level and pixel tests take several seconds each and exceeded the 5 second default when the machine was busy, so the pre-commit hook failed on different tests each run."
- `5a3b198 fix: rebuild joystick on window resize`: names corrected behavior.
- `13a8e2c perf: use packed pixel writes for rendering`: names speedup, not files.

## Rejected Examples

- `70737b8 docs: add Star Spot to glossary`: classified from first file, ignoring level-rule changes across 15 files. Corrected by amendment to `bbd8a53`.
- `76c8c47 chore: add pre-commit configuration with various hooks for linting, testing, and security checks`: wrong type (`build` required); enumerates contents.
- `6fc894c chore: update .editorconfig for Makefile and add Makefile for build automation`: wrong type (`build` required); combines two changes.
- `52f3150 fix: delay door access and correct flower rendering`: unrelated fixes; split commits.
- `e034513 docs: enhance UI layout and visual style documentation with control panel scaling, measurements, and updated element sizes`: exceeds 72 characters; vague verb; enumerates contents.
- `8b4cad1` body beginning "Added package.json with scripts and dependencies": past-tense diff narration, not motivation.
