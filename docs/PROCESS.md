# Process

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

Run the shared check command at the end of the milestone.

## Checks

Add a shared check command and a pre-commit hook when scaffolding the app.
The command should run Python and TypeScript formatting, lint, type, and test
checks, plus the Playwright review workflow. Use the hook for fast checks.

Use the working queue and synthetic fixtures during development. Keep automated
checks independent of Groq with fixtures or stubbed model responses. Run live
model checks separately. Compare fixed configurations on the same cases, keep
held-out labels outside model inputs, and report results by language and
difficulty.
