# Process

## Setup

From the repository root, run `uv sync --python 3.12` and `npm install`.
The npm setup installs the Git pre-commit hook through Lefthook and downloads
Chromium for Playwright. Run `npm run dev` to start the API and dashboard.

## Checks

- `npm run format` applies Ruff and Prettier formatting.
- `npm run check:python` checks Python formatting and linting with Ruff,
  types with Pyright, and tests with pytest.
- `npm run check:ts` checks formatting with Prettier, linting with ESLint,
  types with TypeScript, and unit tests with Vitest.
- `npm run e2e` starts the local servers and runs Playwright in Chromium.
- `npm run check` runs both language checks and the end-to-end tests.

The pre-commit hook runs both language checks. Fix failures before committing.
Run the full check before handing off work.

## Planning

Write the active milestone plan in `docs/PLAN.md`. Split it into phases that
build on each other. Give each phase a checklist of verifiable outcomes, such
as a passing policy test, an API response, or a working dashboard interaction.

## Implementing

For each phase:

1. Build the phase and run the checks in its checklist.
2. Fix failures and mark verified outcomes in `docs/PLAN.md`.
3. Update [STATUS.md](STATUS.md) with what now works and how to verify it.
4. Commit the completed phase.

## Evaluation

Use the working queue and synthetic fixtures during development. Keep automated
checks independent of Groq with fixtures or stubbed model responses. Run live
model checks separately. Compare fixed configurations on the same cases, keep
held-out labels outside model inputs, and report results by language and
difficulty.
