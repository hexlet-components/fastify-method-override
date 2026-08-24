install:
	npm ci

lint:
	npm run lint
	npm --silent run format:check

lint-fix:
	npm run format
	npm run lint -- --fix

test:
	npm test

test-coverage:
	npm test -- --coverage
