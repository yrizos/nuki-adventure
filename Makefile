.DEFAULT_GOAL := check

.PHONY: help tools dependencies install dev build test test-watch typecheck lint lint-fix markdown markdown-fix audit check check-push hooks

help:
	@printf '%-20s %s\n' \
		'make help' 'List available targets' \
		'make tools' 'Check Node.js and npm versions' \
		'make dependencies' 'Check and install dependencies' \
		'make install' 'Check dependencies and install Git hooks' \
		'make dev' 'Start the development server' \
		'make build' 'Typecheck and build the browser application' \
		'make test' 'Run unit tests' \
		'make test-watch' 'Run unit tests in watch mode' \
		'make typecheck' 'Check TypeScript types' \
		'make lint' 'Check code lint rules' \
		'make lint-fix' 'Apply code lint fixes' \
		'make markdown' 'Check Markdown lint rules' \
		'make markdown-fix' 'Apply Markdown lint fixes' \
		'make audit' 'Check dependencies for security vulnerabilities' \
		'make check' 'Run combined checks without building (default)' \
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

test-watch: dependencies
	npm run test:watch

typecheck: dependencies
	npm run typecheck

lint: dependencies
	npm run lint

lint-fix: dependencies
	npm run lint:fix

markdown: dependencies
	npm run lint:markdown

markdown-fix: dependencies
	npm run lint:markdown:fix

audit: dependencies
	npm run audit

check: dependencies
	npm run check

check-push: dependencies
	npm run check:push

hooks:
	@command -v pre-commit >/dev/null || { printf 'pre-commit is required.\n'; exit 1; }
	pre-commit install
