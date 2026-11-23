# Status

The local pilot supports the [review workflow](SPEC.md) over 24 synthetic cases. Run
`npm run dev` and open `http://127.0.0.1:5173`. The backend seeds `delivery.sqlite3`
on startup. Set `DELIVERY_DB` to use another file. Existing decisions survive restart.

- Select a demo handler, open a case, and generate a recommendation. Groq uses
  `GROQ_API_KEY` from the environment or the repository's `.env`.
- Accept the recommendation or edit its rationale. If Groq is unavailable, select
  the policy action and enter a reason. The report-time evidence determines the
  valid action for the case.
- Refunds and replacements over SAR 500 go to supervisor review. Switch to a
  demo supervisor to approve or return the case with a note. The decision history
  shows who submitted or reviewed it and when.
- Run `npm run check` to verify the workflow. Browser and API tests use temporary
  databases and can run without a Groq key.

## Recommendation evaluation

Run the [paired evaluator](../labs/evaluate_pilot.py) from the repository root.

```powershell
uv run -m labs.evaluate_pilot --group development_smoke --output pilot-eval-smoke.jsonl
```

The evaluator writes per-field matches, exact matches, errors, and withheld
recommendations by dataset, language, and difficulty. Use `--group`, `--offset`,
and `--limit` to run bounded batches. Each paired case uses up to four requests.
Both configurations receive the same report-time evidence and verified history.
The [original notebook](../labs/01-delivery-exception-baseline.ipynb) omitted
verified history from its single-call baseline.

| Live development smoke | Arabic | English | Routine | Hard | Manual | Exact |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Agent with case lookups | 3/3 | 2/2 | 2/2 | 2/2 | 1/1 | 5/5 |
| Single call | 2/3 | 2/2 | 2/2 | 1/2 | 1/1 | 4/5 |

The single-call run got 4/5 actions and 5/5 on each other field. It recommended
waiting despite a confirmed proof mismatch in DED-1003. The policy check withheld
that suggestion. The English agent rationale for DED-1004 cited warehouse receipt,
stock, and the unconfirmed address. The agent explained the evidence for the
Arabic DED-1003 ticket in English despite the language instruction.

The broader 66-case run stopped at a Groq rate limit. Both configurations attempted
four of five smoke cases and one of 45 other held-out cases. The agent withheld one
additional smoke suggestion that cited P4 instead of P5. Each challenge set has
eight cases and zero attempts in that run. The full evaluation remains pending.
