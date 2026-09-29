install:
	pnpm install --frozen-lockfile

lint:
	pnpm --silent run lint
	pnpm --silent run format:check

lint-fix:
	pnpm run format
	pnpm run lint --fix

test:
	pnpm test

test-coverage:
	pnpm exec vitest run --coverage
