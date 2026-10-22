# Commit Messages

## Procedure

1. IF the user has staged changes, commit exactly what is staged as one commit. Never split, unstage or restage it, and never add other paths to it.
   Otherwise, stage intended paths by name, never `git add .` or `git add -A`. One logical change per commit.
2. Read the complete `git diff --cached` and confirm every change belongs. Never derive the message from the conversation, one file or a filtered summary.
3. Pick the type from the purpose of the whole change. Accompanying docs or tests never override the code change's type.
4. Run signed `git commit` with hooks. Never run `pre-commit run --all-files` first and never bypass hooks.
5. On hook failure: inspect automatic fixes, fix the rest, restage, recheck the staged diff and retry. Never commit failures.
6. On signing failure: stop and report. Never create an unsigned commit.
7. Verify the commit exists and is signed.

## Types

| Type | Use for |
| --- | --- |
| `feat` | New user-visible behavior |
| `fix` | Corrected behavior |
| `refactor` | Restructure without behavior change |
| `perf` | Speed without behavior change |
| `test` | Tests, test support or test configuration only |
| `docs` | Documentation only, including agent instructions |
| `build` | Dependencies, Makefile, Git hooks, compiler, bundler, linter or formatter configuration |
| `ci` | `.github/workflows` only |
| `chore` | Anything else, such as license or Git attributes |
| `revert` | Reverting an earlier commit |

## Message Constraints

- Format: `<type>: <subject>`. Subject is imperative, lowercase, at most 72 characters, with no trailing period.
- The subject names the change, never files or sections. With several changes, it names the core one and the body covers the rest.
- Add a body when the subject does not explain the reason. The body explains the motivating problem and never narrates the diff.
- Breaking change: `!` after the type plus a `BREAKING CHANGE:` footer.

## Accepted Examples

- `4a39293 fix: lay path under the level 4 boulder`: corrected behavior makes it `fix`, despite the docs change. The body states the problem: a boulder spot always got grass, so the path broke at the boulder.
- `683a269 build: run check hooks only when their inputs change`: `.pre-commit-config.yaml` only. Git hooks are build tooling.
- `6bb09e3 perf: cut the test suite from ten seconds to under three`: speed is the purpose, so test edits do not make it `test`. The body states the problem: deep equality, per-frame assertions and list scans dominated the run.

## Rejected Examples

- `docs: lay path under the level 4 boulder`: typed from `level-design.md`, ignoring the layout code change.
- `6fc894c chore: update .editorconfig for Makefile and add Makefile for build automation`: needs `build`, and combines two changes.
- `8b4cad1` body starting "Added package.json with scripts and dependencies": past-tense diff narration, not motivation.
