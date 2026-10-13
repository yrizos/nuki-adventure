.DEFAULT_GOAL := help

.PHONY: sprite-inspect level-map help tools dependencies install dev build test test-file test-watch typecheck lint format fix markdown audit check check-push hooks

help:
	@printf '%-20s %s\n' \
		'make help' 'List available targets' \
		'make sprite-inspect MODE=list' 'Inspect sprites (summary, frames, frame, animations, animation, palette)' \
		'make level-map LEVEL=id' 'Write the level picker card map of a level, or all, to test-output/level-maps' \
		'make tools' 'Check Node.js and npm versions' \
		'make dependencies' 'Check and install dependencies' \
		'make install' 'Check dependencies and install Git hooks' \
		'make dev' 'Start the development server' \
		'make build' 'Typecheck and build the browser application' \
		'make test' 'Run unit tests' \
		'make test-file FILE=path' 'Run a specific test file' \
		'make test-watch' 'Run unit tests in watch mode' \
		'make typecheck' 'Check TypeScript types' \
		'make lint' 'Check code lint rules' \
		'make format' 'Check code formatting' \
		'make fix' 'Apply all available code and lint fixes' \
		'make markdown' 'Check Markdown lint rules' \
		'make audit' 'Check dependencies for security vulnerabilities' \
		'make check' 'Run combined checks without building' \
		'make check-push' 'Run unit tests and the browser build' \
		'make hooks' 'Install Git hooks'

tools:
	@command -v node >/dev/null || { printf 'Node.js is required.\n'; exit 1; }
	@command -v npm >/dev/null || { printf 'npm is required.\n'; exit 1; }
	@node -e 'if (Number(process.versions.node.split(".")[0]) < 26) { console.error("Node.js 26 or newer is required."); process.exit(1); }'
	@test "$$(npm --version)" = "$$(node -p "require('./package.json').packageManager.split('@')[1]")" || { printf 'Use the npm version declared in package.json.\n'; exit 1; }

dependencies: tools
	@if ! npm ls --all --silent >/dev/null 2>&1; then npm ci; fi
	@npm ls --all --silent >/dev/null

install: dependencies hooks

dev: dependencies
	npm run dev

build: dependencies
	npm run build

test: dependencies
	npm test

test-file: dependencies
	@test -n "$(FILE)" || { echo "Usage: make test-file FILE=src/path/file.test.ts"; exit 2; }
	@test -f "$(FILE)" || { echo "Test file not found: $(FILE)"; exit 2; }
	@case "$(FILE)" in src/*.test.ts) ;; *) echo "Expected a test file under src/ ending in .test.ts"; exit 2;; esac
	npm test -- "$(FILE)"

level-map: dependencies
	@test -n "$(LEVEL)" || { echo "Usage: make level-map LEVEL=<level id|all>"; exit 2; }
	LEVEL_MAP="$(LEVEL)" npm test -- src/presentation/level-map.render.test.ts

test-watch: dependencies
	npm run test:watch

typecheck: dependencies
	npm run typecheck

lint: dependencies
	npm run lint

format: dependencies
	npm run format:check

fix: dependencies
	@exit_code=0; \
		npm run format || exit_code=$$?; \
		npm run lint:fix || exit_code=$$?; \
		npm run lint:markdown:fix || exit_code=$$?; \
		exit $$exit_code

markdown: dependencies
	npm run lint:markdown

audit: dependencies
	npm run audit

check: dependencies
	npm run check

check-push: dependencies
	npm run check:push

hooks:
	@command -v pre-commit >/dev/null || { printf 'pre-commit is required.\n'; exit 1; }
	pre-commit install

export MODE SPRITE FRAME ANIMATION FILTER LIMIT OFFSET FADED

sprite-inspect:
	@node scripts/sprite-inspect.mjs
