# Commit Messages

## Procedure

1. WHEN explicitly instructed to commit: stage explicit intended paths only, never `git add .` or `git add -A`. Keep one logical change per commit and preserve unrelated work.
2. Read complete `git diff --cached` and verify every change belongs. Never derive messages from conversation, one file or filtered summaries.
3. Select type by the purpose of the whole change. Accompanying documentation/tests never override the code change's type.
4. Write `<type>: <subject>` and optional body using the rules below.
5. Run cryptographically signed `git commit` with installed hooks. Never separately run `pre-commit run --all-files` before committing. Never bypass hooks.
6. On hook failure or edits: inspect automatic fixes, fix remaining failures, stage intended paths, recheck the complete staged diff and retry the signed commit. Never commit failures.
7. On signing failure: stop and report. Never create an unsigned commit.
8. Verify commit creation and cryptographic signature.

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
- Multiple changes in one commit: the subject always names the most impactful, core change. Secondary changes appear only in the body.
- Body required when subject does not explain the reason. Explain the motivating problem, never narrate the diff.
- Breaking change: `!` after type plus `BREAKING CHANGE:` footer.
- Claim passing tests or changed behavior only after verification.

## Accepted Examples

- `bbd8a53 feat: pick five of fifteen star spots each time a level starts`: gameplay rule determines `feat` despite glossary, design guide, domain, three layouts and test changes.
- `683a269 build: run check hooks only when their inputs change`: `.pre-commit-config.yaml` only; Git hooks are build tooling.
- `1d5b694 test: raise the per-test timeout for slow whole-level tests`: `vite.config.mjs` affects tests only. Motivating-problem body: "Whole-level and pixel tests take several seconds each and exceeded the 5 second default when the machine was busy, so the pre-commit hook failed on different tests each run."

## Rejected Examples

- `70737b8 docs: add Star Spot to glossary`: classified from first file, ignoring level-rule changes across 15 files.
- `6fc894c chore: update .editorconfig for Makefile and add Makefile for build automation`: wrong type (`build` required); combines two changes.
- `8b4cad1` body beginning "Added package.json with scripts and dependencies": past-tense diff narration, not motivation.
