# Code standards

1. Keep code simple. Prefer a direct implementation and comment when the reason
   for a choice needs explaining.
2. Handle errors where the workflow can recover or where a clear failure helps
   the caller act.
3. Use Python 3.12 with uv. Run Python commands through `uv run`.
4. Enable TypeScript strict mode. Avoid `any` by using explicit types or narrowing
   `unknown` after validation.
5. Preserve Arabic and English ticket text as UTF-8.
6. Validate inputs and structured model outputs at their boundaries.
7. Keep evaluation labels out of prompts and agent tool inputs and outputs.
